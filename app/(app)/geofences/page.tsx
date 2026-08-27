import Link from "next/link";
import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { I } from "@/components/ui/icon";
import { ZoneTypeBadge } from "@/components/app/indicators";
import { getGeofences } from "@/lib/db";

const fillByType: Record<string, string> = {
  Grazing: "rgba(0, 245, 160, 0.22)",
  Restricted: "rgba(255, 107, 107, 0.22)",
  Watering: "rgba(91, 231, 255, 0.22)",
  Buffer: "rgba(255, 181, 71, 0.22)",
  Quarantine: "rgba(140, 124, 255, 0.22)",
};
const strokeByType: Record<string, string> = {
  Grazing: "rgba(0, 245, 160, 0.7)",
  Restricted: "rgba(255, 107, 107, 0.8)",
  Watering: "rgba(91, 231, 255, 0.7)",
  Buffer: "rgba(255, 181, 71, 0.7)",
  Quarantine: "rgba(140, 124, 255, 0.7)",
};

export default async function GeofencesPage() {
  const geofences = await getGeofences();
  const totalHa = geofences.reduce((s, g) => s + g.hectares, 0);
  const capacity = geofences.reduce((s, g) => s + g.capacity, 0);
  const occupancy = geofences.reduce((s, g) => s + g.occupancy, 0);

  return (
    <>
      <Topbar
        title="Geofencing"
        subtitle="Grazing zones, restricted areas and watering points"
      />

      <div className="grid-stagger grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <Kpi label="Active zones" value={geofences.length.toString()} hint="across 6 wards" />
        <Kpi label="Total hectares" value={totalHa.toLocaleString()} hint="under management" />
        <Kpi label="Capacity" value={capacity.toString()} hint="permitted livestock" />
        <Kpi
          label="Occupancy"
          // No zones, or zones with no stated capacity, means there is nothing
          // to be a percentage of — show a dash rather than NaN.
          value={capacity > 0 ? `${Math.round((occupancy / capacity) * 100)}%` : "—"}
          hint={capacity > 0 ? `${occupancy} of ${capacity}` : "no capacity set"}
        />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="veld">Grazing</Badge>
          <Badge tone="amber">Buffer</Badge>
          <Badge tone="coral">Restricted</Badge>
          <Badge tone="cyan">Watering</Badge>
          <Badge tone="violet">Quarantine</Badge>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/tracking" size="sm" variant="glass" iconLeft={<I.Map size={14} />}>Open in map</LinkButton>
          <LinkButton href="/geofences/new" size="sm" variant="primary" iconLeft={<I.Plus size={14} />}>Draw new zone</LinkButton>
        </div>
      </div>

      <div className="grid-stagger grid md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
        {geofences.map((g) => {
          const occPct = Math.round((g.occupancy / Math.max(g.capacity, 1)) * 100);
          return (
            <Link key={g.id} href={`/geofences/${g.id}`} className="block">
            <GlassCard hover className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <ZoneTypeBadge type={g.type} />
                  <h3 className="mt-3 text-lg font-semibold tracking-tight">{g.name}</h3>
                  <p className="text-xs text-white/55">{g.ward}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold tracking-tight">{g.hectares}</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/45">hectares</div>
                </div>
              </div>

              <div className="mt-4 map-canvas topo-lines relative overflow-hidden rounded-2xl h-36 border border-white/10">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  <polygon
                    points={g.polygon.map((p) => p.join(",")).join(" ")}
                    fill={fillByType[g.type]}
                    stroke={strokeByType[g.type]}
                    strokeWidth="0.4"
                    strokeDasharray={g.type === "Restricted" ? "1 1" : undefined}
                  />
                </svg>
                <div className="absolute bottom-2 left-2 chip">{g.polygon.length} vertices</div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/55">Occupancy</span>
                  <span className="font-mono">{g.occupancy} / {g.capacity || "—"}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(occPct, 100)}%`,
                      background:
                        occPct > 90
                          ? "linear-gradient(90deg,#ff8a8a,#ff6b6b)"
                          : occPct > 70
                            ? "linear-gradient(90deg,#ffd57a,#ffb547)"
                            : "linear-gradient(90deg,#00f5a0,#1aa05a)",
                      boxShadow: "0 0 12px rgba(0,245,160,0.4)",
                    }}
                  />
                </div>
              </div>
            </GlassCard>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <GlassCard hover className="p-6">
      <div className="text-xs uppercase tracking-[0.14em] text-white/55">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tighter">{value}</div>
      <div className="text-xs text-white/45 mt-1">{hint}</div>
    </GlassCard>
  );
}
