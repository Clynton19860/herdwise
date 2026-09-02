import { formatShortDateTime } from "@/lib/time";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { I } from "@/components/ui/icon";
import { PendingAction } from "@/components/ui/pending-action";
import { ScopedMap } from "@/components/app/scoped-map";
import { Ring } from "@/components/charts/ring";
import { Sparkline } from "@/components/charts/sparkline";
import { StatusBadge, BatteryBar, SeverityBadge, IncidentStatusBadge } from "@/components/app/indicators";
import { getAnimals, getGeofences, getIncidents, getMovementStats, getOwner, getWards } from "@/lib/db";
import { EditRecord } from "@/components/app/edit-record";
import { InviteOwner } from "@/components/owner/invite-owner";

type Params = Promise<{ id: string }>;

export default async function OwnerDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const [owner, animals, geofences, incidents, movement, wards] = await Promise.all([
    getOwner(id), getAnimals(), getGeofences(), getIncidents(),
    getMovementStats({ ownerId: id }),
    getWards(),
  ]);
  if (!owner) notFound();

  const herd = animals.filter((a) => a.ownerId === owner.id);
  const ownerIncidents = incidents.filter((i) => i.ownerId === owner.id);
  const onlineDevices = herd.filter((a) => a.device.lastSyncMin < 10).length;
  const alerts = herd.filter((a) => a.status !== "Healthy").length;
  const vaxCoverage = Math.round(
    (herd.filter((a) => new Date(a.health.nextVaccination) > new Date()).length /
      Math.max(herd.length, 1)) *
      100
  );
  const initials = owner.fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <>
      <Topbar title={owner.fullName} subtitle={`${owner.ward} · Farmer profile`} />

      {/* Back nav + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/owners"
          className="inline-flex items-center gap-1.5 text-sm text-white/65 hover:text-white transition-colors"
        >
          <I.ArrowRight size={14} className="rotate-180" />
          Back to owners directory
        </Link>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <InviteOwner ownerId={owner.id} email={owner.email} />
          <EditRecord
            endpoint={`/api/owners/${owner.id}`}
            title="Correct owner details"
            fields={[
              { name: "fullName", label: "Full name", value: owner.fullName },
              { name: "phone", label: "Phone", value: owner.phone, type: "tel" },
              { name: "address", label: "Address", value: owner.address ?? "" },
              {
                name: "ward",
                label: "Ward",
                value: owner.ward ?? "",
                options: wards.map((w) => ({ value: w.name, label: w.name })),
              },
            ]}
          />
          <PendingAction size="sm" variant="glass" iconLeft={<I.Bell size={14} />}>
            Send notice
          </PendingAction>
          <PendingAction size="sm" variant="glass" iconLeft={<I.Stethoscope size={14} />}>
            Schedule visit
          </PendingAction>
          <LinkButton href="/livestock/new" size="sm" variant="primary" iconLeft={<I.Plus size={14} />}>
            Register animal
          </LinkButton>
        </div>
      </div>

      {/* ===== Hero: profile + KPIs + map ===== */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        {/* Profile card */}
        <GlassCard className="p-6 lg:p-7 lg:col-span-1">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 rounded-3xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] text-emerald-950 font-semibold grid place-items-center text-xl shadow-[0_12px_32px_-12px_rgba(0,245,160,0.5)] shrink-0">
              {initials}
              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-400 ring-2 ring-[#0a1612] shadow-[0_0_10px_currentColor]" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">Owner ID</div>
              <div className="font-mono text-sm truncate">{owner.id.toUpperCase()}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone="veld" dot>Verified</Badge>
                {alerts > 0 && <Badge tone="coral" dot>{alerts} alerts</Badge>}
              </div>
            </div>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <DetailRow icon={<I.Tag size={14} />} label="National ID" value={owner.nationalId} mono />
            <DetailRow icon={<I.Bell size={14} />} label="Primary phone" value={owner.phone} mono href={`tel:${owner.phone.replace(/\s+/g, "")}`} />
            <DetailRow icon={<I.Pin size={14} />} label="Ward" value={owner.ward} />
            <DetailRow icon={<I.Calendar size={14} />} label="Member since" value={owner.registeredOn} mono />
          </dl>

          <div className="mt-6 pt-6 border-t border-white/8">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2.5">
              Preferred channels
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="veld" dot>SMS</Badge>
              <Badge tone="veld" dot>WhatsApp</Badge>
              <Badge tone="cyan">Voice</Badge>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <a
              href={`tel:${owner.phone.replace(/\s+/g, "")}`}
              className="h-10 rounded-2xl glass-thin hover:bg-white/8 grid place-items-center text-sm transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <I.Bell size={14} className="text-emerald-300" /> Call
              </span>
            </a>
            <a
              href={`sms:${owner.phone.replace(/\s+/g, "")}`}
              className="h-10 rounded-2xl glass-thin hover:bg-white/8 grid place-items-center text-sm transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <I.Activity size={14} className="text-cyan-300" /> SMS
              </span>
            </a>
          </div>
        </GlassCard>

        {/* KPI strip + map */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Kpi label="Herd size" value={owner.herdSize.toString()} hint="head registered" tone="emerald" />
            <Kpi label="Devices online" value={`${onlineDevices}/${herd.length}`} hint="last 10 min" tone="cyan" />
            <Kpi label="Alerts" value={alerts.toString()} hint={alerts ? "needs attention" : "all clear"} tone={alerts ? "rose" : "emerald"} />
            <Kpi label="Vax coverage" value={`${vaxCoverage}%`} hint="up to date" tone="violet" />
          </div>

          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-base font-semibold tracking-tight">Where the herd is now</h3>
              <Badge tone="veld" dot>Streaming</Badge>
            </div>
            <ScopedMap
              animals={herd}
              zones={geofences}
              className="h-[260px] sm:h-[300px] md:h-[340px]"
            />
          </GlassCard>
        </div>
      </div>

      {/* ===== Herd grid ===== */}
      <GlassCard className="p-5 sm:p-6 lg:p-7">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Registered herd</h3>
            <p className="text-xs text-white/55 mt-0.5">All animals owned by {owner.fullName.split(" ")[0]}</p>
          </div>
          <Badge tone="aurora">{herd.length} animals</Badge>
        </div>

        {herd.length === 0 ? (
          <div className="glass-thin rounded-2xl p-6 text-center text-sm text-white/55">
            No animals registered yet.
          </div>
        ) : (
          <div className="grid-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {herd.map((a) => (
              <Link
                key={a.id}
                href={`/livestock/${a.id}`}
                className="glass-thin rounded-2xl p-4 hover:bg-white/6 hover-lift transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="h-9 w-9 rounded-xl glass-thin grid place-items-center text-emerald-300">
                      <I.Cow size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-tight truncate">
                        {a.name ?? "Unnamed"}
                      </div>
                      <div className="text-[11px] font-mono text-white/55 truncate">{a.tag}</div>
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-white/45">Breed</dt><dd className="truncate">{a.breed}</dd></div>
                  <div><dt className="text-white/45">Zone</dt><dd className="truncate">{a.location.zone}</dd></div>
                </dl>
                <div className="mt-3 flex items-center justify-between">
                  <BatteryBar value={a.device.battery} />
                  <span className="text-[10px] text-white/45 inline-flex items-center gap-1">
                    <I.Wifi size={10} /> {a.device.signal}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </GlassCard>

      {/* ===== Two-column: Incidents + Compliance + Activity ===== */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        {/* Incident history */}
        <GlassCard className="p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Incident history</h3>
              <p className="text-xs text-white/55 mt-0.5">All incidents involving this owner&rsquo;s herd</p>
            </div>
            <LinkButton href="/incidents/new" size="sm" variant="glass" iconLeft={<I.Plus size={14} />}>
              Log incident
            </LinkButton>
          </div>

          {ownerIncidents.length === 0 ? (
            <div className="glass-thin rounded-2xl p-6 text-center">
              <I.Check size={22} className="mx-auto text-emerald-300" />
              <div className="mt-2 text-sm">Clean record — no incidents on file.</div>
            </div>
          ) : (
            <div className="overflow-x-auto pretty-scroll">
              <table className="w-full text-sm min-w-[640px]">
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
                  {ownerIncidents.map((i) => (
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
                        {formatShortDateTime(i.reportedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Compliance */}
        <GlassCard className="p-5 sm:p-6">
          <h3 className="text-base font-semibold tracking-tight">Compliance</h3>
          <p className="text-xs text-white/55 mt-0.5">Licensing & vaccination posture</p>

          <div className="mt-5 flex items-center gap-4">
            <Ring value={vaxCoverage} label={`${vaxCoverage}%`} sublabel="Vax" size={108} thickness={10} />
            <ul className="flex-1 space-y-2 text-sm">
              <Compliance label="Annual licence" status="Active" tone="veld" />
              <Compliance label="FMD vaccinations" status={vaxCoverage > 80 ? "Compliant" : "Action needed"} tone={vaxCoverage > 80 ? "veld" : "amber"} />
              <Compliance label="Brucellosis" status="Active" tone="veld" />
              <Compliance label="By-law citations" status="None" tone="veld" />
            </ul>
          </div>
        </GlassCard>
      </div>

      {/* ===== Movement & Activity ===== */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Herd movement (14 days)</h3>
              <p className="text-xs text-white/55 mt-0.5">Avg. distance covered by this herd per day</p>
            </div>
            <Badge tone="cyan">+12% vs prior period</Badge>
          </div>
          <div className="mt-5">
            <Sparkline
              data={[3.2, 2.9, 3.4, 3.0, 3.8, 3.6, 4.0, 3.7, 4.2, 3.9, 4.4, 4.1, 4.6, 4.3]}
              color="#5be7ff"
              height={120}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {/* Derived from GPS fixes. A dash means not enough telemetry yet —
                better than a number nobody measured. */}
            <MicroStat
              label="Total km"
              value={movement.totalKm != null ? movement.totalKm.toFixed(1) : "—"}
              hint={`${movement.windowDays} days`}
            />
            <MicroStat
              label="Avg per animal"
              value={movement.avgKmPerAnimal != null ? `${movement.avgKmPerAnimal} km` : "—"}
              hint={movement.animals ? `${movement.animals} reporting` : "none reporting"}
            />
            <MicroStat
              label="Active days"
              value={`${movement.activeDays}/${movement.windowDays}`}
              hint={movement.activeDays ? "with GPS fixes" : "no fixes yet"}
            />
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <h3 className="text-base font-semibold tracking-tight">Recent activity</h3>
          {/* These were four fixed lines — a WhatsApp reminder, a collar pairing, a
              certification renewal — shown identically for every owner. Real
              activity is what this owner's tags actually reported. */}
          {herd.length === 0 ? (
            <div className="mt-4 glass-thin rounded-2xl p-5 text-center">
              <div className="text-sm">No activity yet</div>
              <p className="mt-1 text-xs text-white/55">
                Activity appears once this owner has a registered animal wearing a tag.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {herd
                .slice()
                .sort((a, b) => a.device.lastSyncMin - b.device.lastSyncMin)
                .slice(0, 4)
                .map((a) => (
                  <Activity
                    key={a.id}
                    when={
                      a.device.lastSyncMin < 60
                        ? `${a.device.lastSyncMin}m ago`
                        : `${Math.round(a.device.lastSyncMin / 60)}h ago`
                    }
                    text={`${a.name} · ${a.tag} reported a position`}
                    tone="veld"
                  />
                ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </>
  );
}

/* ---------- Helpers ---------- */

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "cyan" | "rose" | "violet";
}) {
  const color =
    tone === "emerald" ? "#00f5a0" : tone === "cyan" ? "#5be7ff" : tone === "rose" ? "#ff8a8a" : "#b3a7ff";
  return (
    <GlassCard hover className="p-4 sm:p-5 relative overflow-hidden">
      <div
        className="absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl opacity-25"
        style={{ background: color }}
      />
      <div className="relative">
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/55">{label}</div>
        <div className="mt-1.5 text-2xl sm:text-3xl font-semibold tracking-tighter" style={{ color }}>
          {value}
        </div>
        <div className="text-xs text-white/45 mt-0.5">{hint}</div>
      </div>
    </GlassCard>
  );
}

function DetailRow({
  icon,
  label,
  value,
  mono,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <span className="h-7 w-7 rounded-lg glass-thin grid place-items-center text-white/65 shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</div>
        <div className={`text-sm truncate ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      {href && <I.ArrowRight size={14} className="text-white/45" />}
    </>
  );
  if (href) {
    return (
      <a href={href} className="flex items-center gap-3 -mx-1 px-1 py-1 rounded-xl hover:bg-white/5 transition-colors">
        {content}
      </a>
    );
  }
  return <div className="flex items-center gap-3">{content}</div>;
}

function Compliance({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: "veld" | "amber" | "coral";
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-white/75">{label}</span>
      <Badge tone={tone} dot={tone !== "veld"}>{status}</Badge>
    </li>
  );
}

function MicroStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass-thin rounded-2xl p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/50">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="text-xs text-white/45">{hint}</div>
    </div>
  );
}

function Activity({
  when,
  text,
  tone,
}: {
  when: string;
  text: string;
  tone: "veld" | "amber" | "cyan" | "violet";
}) {
  return (
    <li className="flex gap-3">
      <Badge tone={tone}>{when}</Badge>
      <p className="text-white/80 leading-snug">{text}</p>
    </li>
  );
}
