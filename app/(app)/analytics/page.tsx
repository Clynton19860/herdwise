import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";
import { Sparkline } from "@/components/charts/sparkline";
import { Bars } from "@/components/charts/bars";
import { Ring } from "@/components/charts/ring";
import { getAnimals, getGeofences, getIncidents, getMovementStats, getOwners, getPlatformStats, getTrendSeries } from "@/lib/db";
import { generateAiSummary } from "@/lib/ai-server";

export default async function AnalyticsPage() {
  const [animals, geofences, incidents, owners, platformStats, trendSeries, movement] = await Promise.all([
    getAnimals(), getGeofences(), getIncidents(), getOwners(), getPlatformStats(), getTrendSeries(),
    getMovementStats({}),
  ]);
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
                <Badge tone="cyan">Claude Opus 4.7</Badge>
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
                <p className="text-xs text-white/55">All wards · trailing 7 days</p>
              </div>
              <Badge tone="cyan">+18% vs last week</Badge>
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
              <Tile label="Rest periods" value="3.1" hint="avg. per day" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-base font-semibold tracking-tight">Theft risk score</h3>
          <p className="text-xs text-white/55">Predictive · weighted by ward</p>
          <div className="mt-4 flex items-center gap-4">
            <Ring value={32} label="Low" sublabel="Risk index" color="#34c071" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-white/55">Hatcliffe</span>
                <span className="text-emerald-300">Low</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/55">Mabvuku</span>
                <span className="text-amber-200">Medium</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/55">Kuwadzana</span>
                <span className="text-rose-300">High</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/55">Highfield</span>
                <span className="text-emerald-300">Low</span>
              </div>
            </div>
          </div>
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
          <h3 className="text-base font-semibold tracking-tight">Vaccination uplift</h3>
          <p className="text-xs text-white/55">Programme coverage</p>
          <div className="mt-6">
            <Bars
              data={[
                { label: "FMD",   value: 88, color: "#8c7cff" },
                { label: "Bru.",  value: 64, color: "#8c7cff" },
                { label: "Rab.",  value: 72, color: "#8c7cff" },
                { label: "Anth.", value: 41, color: "#8c7cff" },
              ]}
            />
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight">AI co-pilot insights</h3>
            <p className="text-xs text-white/55">Generated by the herd analytics model</p>
          </div>
          <Badge tone="aurora" dot>Beta</Badge>
        </div>

        <div className="grid-stagger grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          <Insight
            tone="veld"
            icon={<I.Sparkle size={18} />}
            title="Open Hatcliffe-North grazing corridor"
            body="Density model suggests 18% capacity headroom; opening reduces pressure on Mabvuku."
          />
          <Insight
            tone="coral"
            icon={<I.Alert size={18} />}
            title="Disease watch · Epworth"
            body="Three animals show clustered temperature anomalies. Recommend vet inspection within 24h."
          />
          <Insight
            tone="cyan"
            icon={<I.Gauge size={18} />}
            title="Battery rotation · Mabvuku"
            body="6 smart-collar batteries below 30%. Auto-dispatch swap kit to Ward 12 depot."
          />
          <Insight
            tone="violet"
            icon={<I.Users size={18} />}
            title="Owner onboarding"
            body="12 farmers in Ward 9 have visited the registration site but not completed. Trigger SMS follow-up."
          />
          <Insight
            tone="amber"
            icon={<I.Layers size={18} />}
            title="Geofence drift"
            body="Highfield grazing centroid moved 220m west over 30 days — update polygon."
          />
          <Insight
            tone="veld"
            icon={<I.Heart size={18} />}
            title="Breeding window"
            body="14 cows are entering optimal breeding window — notify owners."
          />
        </div>
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
