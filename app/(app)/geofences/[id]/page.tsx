import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";
import { PendingAction, PendingNote } from "@/components/ui/pending-action";
import { ArchiveZone } from "@/components/geofences/archive-zone";
import { FieldMap } from "@/components/map/field-map";
import { Ring } from "@/components/charts/ring";
import { Sparkline } from "@/components/charts/sparkline";
import { ZoneTypeBadge, StatusBadge, SeverityBadge, IncidentStatusBadge } from "@/components/app/indicators";
import { getAnimals, getGeofence, getIncidents, getMapAnimals, getMapParcels } from "@/lib/db";

type Params = Promise<{ id: string }>;

function pointInPolygon([x, y]: [number, number], poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonAreaPercent(points: [number, number][]) {
  if (points.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

function perimeterPercent(points: [number, number][]) {
  if (points.length < 2) return 0;
  let p = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    p += Math.hypot(x2 - x1, y2 - y1);
  }
  return p;
}

export default async function GeofenceDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const [zone, animals, incidents, mapAnimals, mapParcels] = await Promise.all([
    getGeofence(id), getAnimals(), getIncidents(),
    getMapAnimals(), getMapParcels(),
  ]);
  if (!zone) notFound();

  const insideAnimals = animals.filter((a) =>
    pointInPolygon([a.location.x, a.location.y], zone.polygon)
  );
  const zoneIncidents = incidents.filter((i) =>
    pointInPolygon([i.location.x, i.location.y], zone.polygon)
  );

  const occPct = Math.round((zone.occupancy / Math.max(zone.capacity, 1)) * 100);
  const hectares = zone.hectares;
  const area = polygonAreaPercent(zone.polygon);
  const perimeter = perimeterPercent(zone.polygon);
  const centroidX = zone.polygon.reduce((s, p) => s + p[0], 0) / zone.polygon.length;
  const centroidY = zone.polygon.reduce((s, p) => s + p[1], 0) / zone.polygon.length;

  return (
    <>
      <Topbar title={zone.name} subtitle={`${zone.ward} · ${zone.type} zone`} />

      {/* Back nav + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/geofences"
          className="inline-flex items-center gap-1.5 text-sm text-white/65 hover:text-white transition-colors"
        >
          <I.ArrowRight size={14} className="rotate-180" />
          Back to zones
        </Link>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <PendingAction size="sm" variant="glass" iconLeft={<I.Layers size={14} />}>Duplicate</PendingAction>
          <PendingAction size="sm" variant="glass" iconLeft={<I.Settings size={14} />}>Edit rules</PendingAction>
          <ArchiveZone id={zone.id} name={zone.name} />
          <PendingNote />
        </div>
      </div>

      {/* ===== Hero map + KPIs ===== */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <ZoneTypeBadge type={zone.type} />
              <h2 className="text-lg font-semibold tracking-tight">{zone.name}</h2>
              <Badge tone="veld" dot>Active</Badge>
            </div>
            <span className="text-xs text-white/45 font-mono">{zone.id.toUpperCase()}</span>
          </div>
          <FieldMap
            animals={mapAnimals}
            parcels={mapParcels}
            className="h-[300px] sm:h-[380px] lg:h-[440px]"
          />
        </GlassCard>

        <div className="space-y-4 lg:space-y-5">
          <GlassCard className="p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="relative">
              <h3 className="text-sm font-medium text-white/65">Occupancy</h3>
              <div className="mt-3 flex items-center gap-4">
                <Ring value={occPct} label={`${occPct}%`} sublabel={`${zone.occupancy}/${zone.capacity || "—"}`} size={120} thickness={11} />
                <ul className="space-y-1.5 text-sm flex-1">
                  <KvRow k="Inside now" v={`${insideAnimals.length}`} mono />
                  <KvRow k="Capacity" v={`${zone.capacity || "—"}`} mono />
                  <KvRow k="Headroom" v={`${Math.max(zone.capacity - zone.occupancy, 0)}`} mono />
                  <KvRow k="Pressure" v={occPct > 80 ? "High" : occPct > 50 ? "Moderate" : "Low"} />
                </ul>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-2 gap-3">
            <Tile label="Hectares" value={hectares.toLocaleString()} tone="text-emerald-300" />
            <Tile label="Vertices" value={zone.polygon.length.toString()} tone="text-cyan-300" />
            <Tile label="Incidents" value={zoneIncidents.length.toString()} tone="text-rose-300" hint="last 14 days" />
            <Tile label="Open alerts" value={zoneIncidents.filter((i) => i.status === "Open" || i.status === "Escalated").length.toString()} tone="text-amber-200" />
          </div>
        </div>
      </div>

      {/* ===== Animals inside + Rules ===== */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Animals currently inside</h3>
              <p className="text-xs text-white/55 mt-0.5">Live points-in-polygon computation</p>
            </div>
            <Badge tone={insideAnimals.length > 0 ? "veld" : "neutral"} dot={insideAnimals.length > 0}>
              {insideAnimals.length} present
            </Badge>
          </div>

          {insideAnimals.length === 0 ? (
            <div className="glass-thin rounded-2xl p-6 text-center text-sm text-white/55">
              No animals are currently inside this zone.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {insideAnimals.map((a) => (
                <Link
                  key={a.id}
                  href={`/livestock/${a.id}`}
                  className="glass-thin rounded-2xl p-3 hover:bg-white/6 hover-lift transition-all flex items-center gap-3"
                >
                  <span className="h-10 w-10 rounded-xl glass-thin grid place-items-center text-emerald-300 shrink-0">
                    <I.Cow size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight truncate">
                      {a.name ?? "Unnamed"}
                    </div>
                    <div className="text-[11px] font-mono text-white/55 truncate">{a.tag}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <h3 className="text-base font-semibold tracking-tight">Rules</h3>
          <p className="text-xs text-white/55 mt-0.5">Behaviour & enforcement</p>

          <ul className="mt-4 space-y-3">
            <RuleRow
              label="Breach action"
              value={
                zone.type === "Restricted"
                  ? "Dispatch patrol"
                  : zone.type === "Quarantine"
                    ? "Lockdown"
                    : "Alert only"
              }
              icon={<I.Shield size={14} />}
            />
            <RuleRow
              label="Active window"
              value={zone.type === "Watering" ? "All hours" : "06:00 – 18:00"}
              icon={<I.Calendar size={14} />}
            />
            <RuleRow
              label="Allowed species"
              value={
                zone.type === "Restricted"
                  ? "None"
                  : zone.type === "Watering"
                    ? "All registered"
                    : "Cattle, Goat, Sheep"
              }
              icon={<I.Cow size={14} />}
            />
            <RuleRow
              label="Auto-escalate"
              value="15 minutes"
              icon={<I.Activity size={14} />}
            />
            <RuleRow
              label="Notify"
              value="Owners · Officers"
              icon={<I.Bell size={14} />}
            />
          </ul>
        </GlassCard>
      </div>

      {/* ===== Breach history + Geometry ===== */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="p-5 sm:p-6 lg:col-span-2">
          <h3 className="text-base font-semibold tracking-tight">Breach history</h3>
          <p className="text-xs text-white/55 mt-0.5">Incidents associated with this zone</p>

          {zoneIncidents.length === 0 ? (
            <div className="glass-thin rounded-2xl p-6 mt-4 text-center">
              <I.Check size={22} className="mx-auto text-emerald-300" />
              <div className="mt-2 text-sm">No breaches on record.</div>
            </div>
          ) : (
            <div className="overflow-x-auto pretty-scroll mt-4">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.14em] text-white/45">
                    <th className="px-2 py-2 font-medium">Ref</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Severity</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {zoneIncidents.map((i) => (
                    <tr key={i.id} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-2 py-3">
                        <Link href={`/incidents/${i.id}`} className="font-mono text-xs text-emerald-200 hover:text-emerald-100">
                          {i.ref}
                        </Link>
                      </td>
                      <td className="px-2 py-3">{i.type}</td>
                      <td className="px-2 py-3"><SeverityBadge severity={i.severity} /></td>
                      <td className="px-2 py-3"><IncidentStatusBadge status={i.status} /></td>
                      <td className="px-2 py-3 font-mono text-xs text-white/65">
                        {new Date(i.reportedAt).toLocaleString("en-ZW", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-medium text-white/85">Activity (14 days)</h4>
              <Badge tone="cyan">Avg 3.4 events/day</Badge>
            </div>
            <div className="mt-3">
              <Sparkline
                data={[2, 3, 4, 3, 5, 4, 6, 3, 4, 5, 4, 3, 4, 5]}
                color="#5be7ff"
                height={90}
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <h3 className="text-base font-semibold tracking-tight">Geometry</h3>
          <p className="text-xs text-white/55 mt-0.5">Computed from the polygon vertices</p>

          <dl className="mt-4 space-y-2.5 text-sm">
            <KvRow k="Hectares" v={`${hectares.toLocaleString()} ha`} />
            <KvRow k="Area (norm.)" v={`${area.toFixed(2)} u²`} mono />
            <KvRow k="Perimeter" v={`${perimeter.toFixed(2)} u`} mono />
            <KvRow k="Vertices" v={zone.polygon.length.toString()} mono />
            <KvRow k="Centroid" v={`${centroidX.toFixed(1)}°E · ${centroidY.toFixed(1)}°S`} mono />
            <KvRow k="Bounding box" v="auto-fit" />
          </dl>

          <div className="mt-5 pt-5 border-t border-white/8 space-y-2 text-xs text-white/55">
            <div className="flex items-center gap-2"><I.Shield size={12} className="text-emerald-300" /> RLS scoped to municipal officers</div>
            <div className="flex items-center gap-2"><I.Activity size={12} className="text-cyan-300" /> Audit logged · v3 (latest)</div>
          </div>
        </GlassCard>
      </div>
    </>
  );
}

/* ---------- helpers ---------- */

function Tile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: string;
  hint?: string;
}) {
  return (
    <div className="glass-thin rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/50">{label}</div>
      <div className={`mt-1 text-xl sm:text-2xl font-semibold tracking-tight ${tone}`}>{value}</div>
      {hint && <div className="text-[11px] text-white/45 mt-0.5">{hint}</div>}
    </div>
  );
}

function KvRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/55">{k}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{v}</span>
    </div>
  );
}

function RuleRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="glass-thin rounded-2xl p-3 flex items-center gap-3">
      <span className="h-8 w-8 rounded-xl glass-thin grid place-items-center text-emerald-300 shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </li>
  );
}
