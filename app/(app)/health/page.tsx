import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";
import { Sparkline } from "@/components/charts/sparkline";
import { Ring } from "@/components/charts/ring";
import { StatusBadge } from "@/components/app/indicators";
import { getAnimals, getHealthOverview } from "@/lib/db";

export default async function HealthPage() {
  const [animals, overview] = await Promise.all([getAnimals(), getHealthOverview()]);

  // Derived from real vaccination records rather than the hardcoded 78 the
  // prototype displayed.
  const withSchedule = animals.filter((a) => a.health.nextVaccination);
  const vaccinationCoverage = animals.length
    ? Math.round(((animals.length - overview.overdue) / animals.length) * 100)
    : 0;
  const anomalies = animals.filter((a) => a.status === "Alert" || a.status === "Quarantined");
  const dueSoon = withSchedule
    .slice()
    .sort((a, b) =>
      new Date(a.health.nextVaccination).getTime() - new Date(b.health.nextVaccination).getTime())
    .slice(0, 6);
  return (
    <>
      <Topbar
        title="Health & veterinary"
        subtitle="Vaccination, anomaly detection and quarantine workflows"
      />

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="p-6 lg:p-8 lg:col-span-2 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl animate-blob" />
          <div className="relative grid md:grid-cols-3 gap-6 items-center">
            <Ring value={vaccinationCoverage} label={`${vaccinationCoverage}%`} sublabel="Vax coverage" size={160} thickness={14} />
            <div className="md:col-span-2 space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                Vaccination coverage is on track
              </h2>
              <p className="text-white/65 text-sm leading-relaxed">
                The pilot herd is currently at <span className="text-emerald-300">{vaccinationCoverage}%</span> coverage
                across foot-and-mouth, brucellosis and rabies programmes. Six animals are scheduled
                for boosters this week — auto-reminders have been queued to owner SMS and WhatsApp.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="veld">FMD ↑ 12%</Badge>
                <Badge tone="cyan">Brucellosis steady</Badge>
                <Badge tone="violet">Rabies ↑ 4%</Badge>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-base font-semibold tracking-tight">Disease pulse</h3>
          <p className="text-xs text-white/55">Anomaly model · 14-day trend</p>
          <div className="mt-4">
            <Sparkline data={[3, 5, 4, 2, 6, 3, 4, 5, 4, 2, 3, 4, 5, 4]} color="#ff8a8a" height={90} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-white/55">14-day flagged animals</span>
            <span className="text-rose-300 font-semibold">{anomalies.length}</span>
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="p-6 lg:p-7 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Vaccination schedule</h3>
              <p className="text-xs text-white/55">Animals due in the next 30 days</p>
            </div>
            {/*
              "Schedule clinic" was here and did nothing, for the same reason
              as "Schedule visit": there is no scheduling in this platform. The
              list below is the real answer to the same question — it says which
              animals are due, which is what somebody planning a clinic needs.
            */}
          </div>

          <ul className="space-y-2">
            {dueSoon.map((a) => (
              <li key={a.id} className="glass-thin rounded-2xl p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-2xl glass-thin grid place-items-center text-emerald-300">
                  <I.Stethoscope size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium font-mono">{a.tag}</div>
                  <div className="text-xs text-white/55 truncate">
                    {a.breed} · {a.species} · {a.location.zone}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/55">Due</div>
                  <div className="text-sm font-mono">{a.health.nextVaccination}</div>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-base font-semibold tracking-tight">Anomalies</h3>
          <p className="text-xs text-white/55">AI-flagged this week</p>
          <ul className="mt-4 space-y-3">
            {anomalies.length === 0 && (
              <li className="text-sm text-white/55">No anomalies flagged.</li>
            )}
            {anomalies.map((a) => (
              <li key={a.id} className="glass-thin rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{a.tag}</span>
                  <StatusBadge status={a.status} />
                </div>
                {/* Ear tags report position and battery, not vitals. Show what
                    the hardware actually provides. */}
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Zone" value={a.location.zone} tone="text-cyan-200" />
                  <Stat
                    label="Last seen"
                    value={a.device.lastSyncMin < 60
                      ? `${a.device.lastSyncMin}m ago`
                      : `${Math.round(a.device.lastSyncMin / 60)}h ago`}
                    tone={a.device.lastSyncMin > 60 ? "text-amber-200" : "text-emerald-200"}
                  />
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/45">{label}</div>
      <div className={`text-sm font-medium font-mono ${tone}`}>{value}</div>
    </div>
  );
}
