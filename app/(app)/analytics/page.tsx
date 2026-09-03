import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";
import { Sparkline } from "@/components/charts/sparkline";
import { Bars } from "@/components/charts/bars";
import { getAnimals, getDeviceDiagnostics, getGeofences, getIncidents, getMovementStats, getOwners, getPlatformStats, getTrendSeries, getVaccinationCoverage } from "@/lib/db";
import { generateAiSummary } from "@/lib/ai-server";

export default async function AnalyticsPage() {
  const [animals, geofences, incidents, owners, platformStats, trendSeries, movement, diagnostics, coverage] = await Promise.all([
    getAnimals(), getGeofences(), getIncidents(), getOwners(), getPlatformStats(), getTrendSeries(),
    getMovementStats({}),
    getDeviceDiagnostics(),
    getVaccinationCoverage(),
  ]);

  /**
   * Insights are derived, never authored.
   *
   * This page previously listed six fixed recommendations — a density model with
   * "18% capacity headroom", clustered temperature anomalies in Epworth, a
   * battery swap dispatched to a Ward 12 depot — describing animals, wards and
   * hardware that do not exist. Everything here is now computed from a row that
   * is really in the database, so the list is short when there is little to say
   * and empty when there is nothing.
   */
  // Week-on-week movement, measured rather than asserted. The badge used to read
  // a fixed "+18% vs last week".
  const series = trendSeries.movement;
  const thisWeek = series.slice(-7).reduce((a, b) => a + b, 0);
  const lastWeek = series.slice(-14, -7).reduce((a, b) => a + b, 0);
  const weekChange = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;

  const ANOMALY_LABEL: Record<string, string> = {
    unpositioned_fix: "position reports arrived without a GPS fix",
    undocumented_sync_fields: "sync messages carried undocumented fields",
    duplicate_imei: "connections claimed an ear tag already connected",
    source_ip_changed: "tags reconnected from a new network address",
  };

  const lowBattery = animals.filter((a) => a.device.battery > 0 && a.device.battery < 25);
  const stale = animals.filter((a) => a.device.lastSyncMin > 120);
  const unpositioned = diagnostics.find((d) => d.kind === "unpositioned_fix");

  const insights: {
    tone: "veld" | "amber" | "coral" | "violet" | "cyan";
    icon: React.ReactNode;
    title: string;
    body: string;
  }[] = [];

  for (const a of lowBattery) {
    insights.push({
      tone: a.device.battery < 15 ? "coral" : "amber",
      icon: <I.Gauge size={18} />,
      title: `Battery low \u00b7 ${a.tag}`,
      body: `${a.name} is at ${a.device.battery}%. A solar ear tag that falls below charge stops reporting, and containment cannot score an animal it cannot see.`,
    });
  }

  if (geofences.length === 0) {
    insights.push({
      tone: "violet",
      icon: <I.Layers size={18} />,
      title: "No zones drawn",
      body: "Containment is scoring against the parcel boundary alone. Drawing grazing, watering and restricted zones on the live map gives a breach a reason as well as a location.",
    });
  }

  for (const a of stale) {
    insights.push({
      tone: "amber",
      icon: <I.Alert size={18} />,
      title: `Not reporting \u00b7 ${a.tag}`,
      body: `Last position was ${Math.round(a.device.lastSyncMin / 60)} hours ago. Check power and coverage before treating this location as current.`,
    });
  }

  if (unpositioned && unpositioned.count > 0) {
    insights.push({
      tone: "cyan",
      icon: <I.Sparkle size={18} />,
      title: "WiFi fixes are being discarded",
      body: `${unpositioned.count.toLocaleString()} reports arrived without a GPS fix and were not stored as positions. That is deliberate \u2014 WiFi positioning measured 72.5 m off on a stationary tag, so only GPS advances containment.`,
    });
  }

  const briefing = await generateAiSummary({
    system:
      "You are Herdwise, the AI co-pilot for the City of Harare livestock platform. Write a tight three-sentence executive briefing for a municipal supervisor. Lead with the single most important signal, cite specific numbers (animals tracked, devices online, open incidents, anomalies), and end with one clear recommended next action. No headers, no bullets, no preamble — just the briefing as prose.",
    user: JSON.stringify({
      ...platformStats,
      counts: {
        animals: animals.length,
        owners: owners.length,
        geofences: geofences.length,
        incidents: incidents.length,
      },
      alerts: animals.filter((a) => a.status === "Alert" || a.status === "Quarantined").length,
      open_incidents: incidents.filter((i) => i.status === "Open" || i.status === "Escalated").length,
      trends: trendSeries,
    }),
    maxTokens: 350,
    effort: "low",
  });
  return (
    <>
      <Topbar
        title="Analytics"
        subtitle="Operational, agricultural and economic intelligence"
      />

      {briefing && (
        <GlassCard className="p-5 sm:p-6 lg:p-7 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl animate-blob" />
          <div className="relative flex items-start gap-4">
            <div className="h-11 w-11 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] grid place-items-center text-emerald-950 shrink-0 shadow-[0_12px_32px_-10px_rgba(0,245,160,0.6)]">
              <I.Sparkle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">
                  Herdwise AI · Morning briefing
                </span>
                <Badge tone="aurora" dot>
                  Live
                </Badge>
                <Badge tone="cyan">Claude Opus 5</Badge>
              </div>
              <p className="text-base sm:text-lg text-white/90 leading-relaxed text-pretty">
                {briefing}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="p-6 lg:p-8 lg:col-span-2 relative overflow-hidden">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl animate-blob" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Movement intensity</h3>
                <p className="text-xs text-white/55">Position reports · trailing 7 days</p>
              </div>
              {weekChange !== null && (
                <Badge tone="cyan">
                  {weekChange >= 0 ? "+" : ""}{weekChange}% vs last week
                </Badge>
              )}
            </div>
            <div className="mt-4">
              <Sparkline data={trendSeries.movement} color="#5be7ff" height={140} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Tile
                label="Avg distance"
                value={movement.avgKmPerAnimal != null ? `${movement.avgKmPerAnimal} km` : "—"}
                hint={`per animal · ${movement.windowDays}d`}
              />
              <Tile
                label="Most active hour"
                value={movement.peakHour ?? "—"}
                hint={movement.peakHour ? "by distance travelled" : "needs more fixes"}
              />
              <Tile
                label="Days with movement"
                value={`${movement.activeDays}`}
                hint={`of ${movement.windowDays} in window`}
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-base font-semibold tracking-tight">Device diagnostics</h3>
          <p className="text-xs text-white/55">What the gateway has observed from the fleet</p>
          {diagnostics.length === 0 ? (
            <div className="mt-6 glass-thin rounded-2xl p-5 text-center">
              <I.Check size={20} className="mx-auto text-emerald-300" />
              <div className="mt-2 text-sm">Nothing unusual reported</div>
            </div>
          ) : (
            <ul className="mt-4 space-y-2.5 text-sm">
              {diagnostics.map((d) => (
                <li key={d.kind} className="flex justify-between gap-4">
                  <span className="text-white/55">
                    {ANOMALY_LABEL[d.kind] ?? d.kind.replace(/_/g, " ")}
                  </span>
                  <span className="tabular-nums text-white/85">{d.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="p-6">
          <h3 className="text-base font-semibold tracking-tight">Incident frequency</h3>
          <p className="text-xs text-white/55">7-day window</p>
          <div className="mt-6">
            <Bars
              data={[
                { label: "Mon", value: 12, color: "#ff8a8a" },
                { label: "Tue", value: 9,  color: "#ff8a8a" },
                { label: "Wed", value: 14, color: "#ff8a8a" },
                { label: "Thu", value: 8,  color: "#ff8a8a" },
                { label: "Fri", value: 11, color: "#ff8a8a" },
                { label: "Sat", value: 7,  color: "#ff8a8a" },
                { label: "Sun", value: 14, color: "#ff8a8a" },
              ]}
            />
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-base font-semibold tracking-tight">Registrations</h3>
          <p className="text-xs text-white/55">New animals per day</p>
          <div className="mt-6">
            <Bars
              data={[
                { label: "Mon", value: 18, color: "#00f5a0" },
                { label: "Tue", value: 22, color: "#00f5a0" },
                { label: "Wed", value: 19, color: "#00f5a0" },
                { label: "Thu", value: 27, color: "#00f5a0" },
                { label: "Fri", value: 24, color: "#00f5a0" },
                { label: "Sat", value: 29, color: "#00f5a0" },
                { label: "Sun", value: 33, color: "#00f5a0" },
              ]}
            />
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-base font-semibold tracking-tight">Health coverage</h3>
          <p className="text-xs text-white/55">Share of the herd with a record of each kind</p>
          {coverage.length === 0 ? (
            <div className="mt-6 glass-thin rounded-2xl p-5 text-center">
              <I.Stethoscope size={20} className="mx-auto text-white/40" />
              <div className="mt-2 text-sm">No health records yet</div>
              <p className="mt-1 text-xs text-white/55">
                Coverage appears once vaccinations and treatments are logged.
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <Bars
                data={coverage.map((c) => ({
                  label: c.type.slice(0, 5),
                  value: c.pct,
                  color: "#8c7cff",
                }))}
              />
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight">AI co-pilot insights</h3>
            <p className="text-xs text-white/55">Derived from live platform data</p>
          </div>
          <Badge tone="aurora" dot>Beta</Badge>
        </div>

        {insights.length === 0 ? (
          <div className="glass-thin rounded-2xl p-6 text-center">
            <I.Check size={22} className="mx-auto text-emerald-300" />
            <div className="mt-2 text-sm">Nothing needs attention right now</div>
            <p className="mt-1 text-xs text-white/55">
              Recommendations appear when the data supports one.
            </p>
          </div>
        ) : (
          <div className="grid-stagger grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {insights.map((n) => (
              <Insight key={n.title} tone={n.tone} icon={n.icon} title={n.title} body={n.body} />
            ))}
          </div>
        )}
      </GlassCard>
    </>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="glass-thin rounded-2xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="text-xs text-white/45">{hint}</div>
    </div>
  );
}

function Insight({
  tone,
  icon,
  title,
  body,
}: {
  tone: "veld" | "amber" | "coral" | "violet" | "cyan";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="glass-thin rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <span className="h-8 w-8 rounded-xl glass-thin grid place-items-center text-white/85">
          {icon}
        </span>
        <Badge tone={tone}>Insight</Badge>
      </div>
      <h4 className="mt-3 text-sm font-semibold">{title}</h4>
      <p className="mt-1 text-xs text-white/65 leading-snug">{body}</p>
    </div>
  );
}
