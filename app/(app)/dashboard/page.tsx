import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { I } from "@/components/ui/icon";
import { MiniMap } from "@/components/marketing/mini-map";
import { Sparkline } from "@/components/charts/sparkline";
import { Ring } from "@/components/charts/ring";
import { Bars } from "@/components/charts/bars";
import { StatusBadge, BatteryBar } from "@/components/app/indicators";
import {
  animals,
  geofences,
  incidents,
  owners,
  platformStats,
  recentActivity,
  trendSeries,
} from "@/lib/data";

export default function DashboardPage() {
  const alerts = animals.filter((a) => a.status === "Alert" || a.status === "Monitoring").length;
  const grazing = geofences.filter((g) => g.type === "Grazing").length;
  const openIncidents = incidents.filter(
    (i) => i.status === "Open" || i.status === "In progress" || i.status === "Escalated"
  ).length;

  return (
    <>
      <Topbar
        title="Operations overview"
        subtitle="Live livestock telemetry across the City of Harare"
      />

      {/* ===== Hero metric strip ===== */}
      <div className="grid-stagger grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <MetricCard
          label="Registered livestock"
          value={platformStats.registered.toLocaleString()}
          delta="+128 this week"
          tone="veld"
          series={trendSeries.registrations}
          icon={<I.Cow size={18} />}
        />
        <MetricCard
          label="Devices online"
          value={platformStats.liveDevices.toLocaleString()}
          delta="88.8% of fleet"
          tone="cyan"
          color="#5be7ff"
          series={trendSeries.movement}
          icon={<I.Wifi size={18} />}
        />
        <MetricCard
          label="Open incidents"
          value={String(openIncidents)}
          delta={`${platformStats.incidentsToday} today`}
          tone="coral"
          color="#ff8a8a"
          series={trendSeries.incidents}
          icon={<I.Alert size={18} />}
        />
        <MetricCard
          label="Health anomalies"
          value={String(alerts)}
          delta="AI model active"
          tone="violet"
          color="#b3a7ff"
          series={trendSeries.healthAnomalies}
          icon={<I.Heart size={18} />}
        />
      </div>

      {/* ===== Live map + side rail ===== */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Live herd positions</h2>
              <Badge tone="veld" dot>Streaming</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="glass" size="sm" iconLeft={<I.Filter size={14} />}>
                Filters
              </Button>
              <LinkButton href="/tracking" variant="primary" size="sm" iconRight={<I.ArrowRight size={14} />}>
                Open full map
              </LinkButton>
            </div>
          </div>
          <MiniMap className="h-[420px]" />

          {/* Legend / zone counts */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
            <LegendChip color="#34c071" label="Grazing" value={`${grazing} zones`} />
            <LegendChip color="#ffb547" label="Buffer" value="1 zone" />
            <LegendChip color="#ff6b6b" label="Restricted" value="1 zone" />
            <LegendChip color="#5be7ff" label="Watering" value="1 zone" />
            <LegendChip color="#8c7cff" label="Quarantine" value="1 zone" />
          </div>
        </GlassCard>

        <div className="space-y-4 lg:space-y-5">
          {/* Uptime ring + KPIs */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Platform health</h3>
                <p className="text-xs text-white/55 mt-0.5">Realtime · last 24h</p>
              </div>
              <Badge tone="aurora" dot>Nominal</Badge>
            </div>
            <div className="mt-5 flex items-center gap-6">
              <Ring value={99.96} label="99.96%" sublabel="Uptime" />
              <div className="space-y-3 flex-1">
                <RowKpi label="Avg. ingest latency" value="3.2s" tone="text-emerald-300" />
                <RowKpi label="Telemetry queue" value="0.4%" tone="text-cyan-300" />
                <RowKpi label="Alerts dispatched" value="1,284" tone="text-amber-200" />
                <RowKpi label="Failed deliveries" value="3" tone="text-rose-300" />
              </div>
            </div>
          </GlassCard>

          {/* Activity feed */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold tracking-tight">Activity</h3>
              <button className="text-xs text-white/60 hover:text-white transition-colors">View all</button>
            </div>
            <ul className="space-y-3.5 max-h-[280px] overflow-y-auto pretty-scroll pr-1">
              {recentActivity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <div className="mt-1.5">
                    <Badge tone={a.tone}>{a.when}</Badge>
                  </div>
                  <p className="text-sm text-white/80 leading-snug">{a.text}</p>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>

      {/* ===== Charts row ===== */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="lg:col-span-2 p-6 lg:p-7">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Movement volume</h3>
              <p className="text-xs text-white/55 mt-0.5">7-day average kilometres travelled per animal</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="veld">Herd</Badge>
              <Badge tone="cyan">Devices</Badge>
            </div>
          </div>

          <div className="mt-7">
            <Bars
              height={180}
              data={[
                { label: "Mon", value: 44, color: "#00f5a0" },
                { label: "Tue", value: 52, color: "#00f5a0" },
                { label: "Wed", value: 41, color: "#00f5a0" },
                { label: "Thu", value: 58, color: "#5be7ff" },
                { label: "Fri", value: 49, color: "#5be7ff" },
                { label: "Sat", value: 62, color: "#5be7ff" },
                { label: "Sun", value: 71, color: "#5be7ff" },
              ]}
            />
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3">
            <MicroStat label="Active herds" value="62" hint="+4 vs last week" />
            <MicroStat label="Median speed" value="1.6 km/h" hint="grazing pace" />
            <MicroStat label="Distance / day" value="3.4 km" hint="per animal" />
          </div>
        </GlassCard>

        <GlassCard className="p-6 lg:p-7">
          <h3 className="text-base font-semibold tracking-tight">By species</h3>
          <p className="text-xs text-white/55 mt-0.5">Composition of active fleet</p>

          <div className="mt-7 space-y-4">
            <SpeciesRow name="Cattle"  value={68} color="#00f5a0" />
            <SpeciesRow name="Goat"    value={18} color="#5be7ff" />
            <SpeciesRow name="Sheep"   value={9}  color="#ffb547" />
            <SpeciesRow name="Donkey"  value={3}  color="#8c7cff" />
            <SpeciesRow name="Pig"     value={2}  color="#ff8a8a" />
          </div>
        </GlassCard>
      </div>

      {/* ===== Critical / Watchlist ===== */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="lg:col-span-2 p-6 lg:p-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Critical watchlist</h3>
              <p className="text-xs text-white/55">Animals requiring attention now</p>
            </div>
            <LinkButton href="/livestock" variant="ghost" size="sm" iconRight={<I.ArrowRight size={14} />}>
              See all
            </LinkButton>
          </div>

          <div className="overflow-x-auto pretty-scroll -mx-2">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-white/45">
                  <th className="px-2 py-2 font-medium">Tag</th>
                  <th className="px-2 py-2 font-medium">Species</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Zone</th>
                  <th className="px-2 py-2 font-medium">Device</th>
                  <th className="px-2 py-2 font-medium">Battery</th>
                </tr>
              </thead>
              <tbody>
                {animals
                  .filter((a) => a.status !== "Healthy")
                  .map((a) => (
                    <tr
                      key={a.id}
                      className="border-t border-white/5 hover:bg-white/3 transition-colors"
                    >
                      <td className="px-2 py-3 font-mono text-xs text-white/85">
                        {a.tag}
                      </td>
                      <td className="px-2 py-3">{a.species}</td>
                      <td className="px-2 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-2 py-3 text-white/70">{a.location.zone}</td>
                      <td className="px-2 py-3 text-white/70">{a.device.type}</td>
                      <td className="px-2 py-3">
                        <BatteryBar value={a.device.battery} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard className="p-6 lg:p-7">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold tracking-tight">Top owners</h3>
            <Badge tone="violet">By herd size</Badge>
          </div>
          <p className="text-xs text-white/55 mb-5">
            Largest registered herds in the pilot zone
          </p>

          <ul className="space-y-3">
            {owners
              .slice()
              .sort((a, b) => b.herdSize - a.herdSize)
              .slice(0, 5)
              .map((o, i) => (
                <li
                  key={o.id}
                  className="flex items-center gap-3 glass-thin rounded-2xl p-3"
                >
                  <div
                    className="h-9 w-9 rounded-2xl grid place-items-center font-semibold text-emerald-950"
                    style={{
                      background:
                        i === 0
                          ? "linear-gradient(135deg,#ffd57a,#ff9b3a)"
                          : i === 1
                            ? "linear-gradient(135deg,#5be7ff,#8c7cff)"
                            : "linear-gradient(135deg,#00f5a0,#1aa05a)",
                    }}
                  >
                    {o.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{o.fullName}</div>
                    <div className="text-xs text-white/55 truncate">{o.ward}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold">{o.herdSize}</div>
                    <div className="text-[10px] uppercase tracking-wider text-white/45">
                      head
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </GlassCard>
      </div>
    </>
  );
}

/* ---------- helpers ---------- */

function MetricCard({
  label,
  value,
  delta,
  tone,
  color = "#00f5a0",
  series,
  icon,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "veld" | "cyan" | "coral" | "violet";
  color?: string;
  series: number[];
  icon: React.ReactNode;
}) {
  return (
    <GlassCard hover className="p-6 relative overflow-hidden">
      <div
        className="absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl opacity-30"
        style={{ background: color }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <Badge tone={tone}>{label}</Badge>
          <div className="h-9 w-9 rounded-xl glass-thin grid place-items-center text-white/85">
            {icon}
          </div>
        </div>
        <div className="mt-5 text-3xl font-semibold tracking-tight">{value}</div>
        <div className="text-xs text-white/55 mt-1">{delta}</div>
        <div className="mt-4 -mb-1">
          <Sparkline data={series} color={color} height={44} />
        </div>
      </div>
    </GlassCard>
  );
}

function RowKpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/65">{label}</span>
      <span className={`font-medium font-mono ${tone}`}>{value}</span>
    </div>
  );
}

function LegendChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-thin rounded-2xl px-3 py-2 flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 12px ${color}` }}
      />
      <div className="text-xs">
        <div className="text-white/90 leading-tight">{label}</div>
        <div className="text-white/45 leading-tight">{value}</div>
      </div>
    </div>
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
      <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="text-xs text-white/45">{hint}</div>
    </div>
  );
}

function SpeciesRow({
  name,
  value,
  color,
}: {
  name: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span>{name}</span>
        <span className="text-white/55 font-mono text-xs">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color}, ${color}66)`,
            boxShadow: `0 0 12px ${color}80`,
          }}
        />
      </div>
    </div>
  );
}

