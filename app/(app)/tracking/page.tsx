import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { I } from "@/components/ui/icon";
import { BigMap } from "@/components/app/big-map";
import { StatusBadge, BatteryBar } from "@/components/app/indicators";
import { animals, geofences, recentActivity } from "@/lib/data";

export default function TrackingPage() {
  const live = animals.filter((a) => a.device.lastSyncMin < 10).length;
  const offline = animals.length - live;

  return (
    <>
      <Topbar
        title="Live tracking"
        subtitle="Realtime telemetry across municipal wards"
      />

      <div className="grid lg:grid-cols-[1fr_380px] gap-4 lg:gap-5">
        {/* ===== Map ===== */}
        <GlassCard className="p-3">
          <BigMap className="h-[calc(100dvh-220px)] min-h-[520px]" />

          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Devices online" value={live.toString()} tone="text-emerald-300" />
            <Tile label="Devices offline" value={offline.toString()} tone="text-amber-200" />
            <Tile label="Active geofences" value={geofences.length.toString()} tone="text-cyan-300" />
            <Tile label="Alerts" value={animals.filter((a) => a.status === "Alert").length.toString()} tone="text-rose-300" />
          </div>
        </GlassCard>

        {/* ===== Side rail ===== */}
        <div className="space-y-4 lg:space-y-5">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold tracking-tight">Layers</h3>
              <Badge tone="aurora">5 active</Badge>
            </div>
            <ul className="space-y-2">
              <LayerToggle color="#34c071" label="Animal positions" hint="12 active pins" on />
              <LayerToggle color="#5be7ff" label="Watering points" hint="1 cluster" on />
              <LayerToggle color="#ffb547" label="Grazing zones"   hint="3 polygons" on />
              <LayerToggle color="#ff6b6b" label="Restricted areas" hint="1 polygon" on />
              <LayerToggle color="#8c7cff" label="Quarantine zones" hint="1 polygon" on />
              <LayerToggle color="#ffffff" label="Movement trails"  hint="last 24h" />
              <LayerToggle color="#00f5a0" label="Heatmap density"  hint="grazing pressure" />
            </ul>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold tracking-tight">Watchlist</h3>
              <Button size="sm" variant="ghost">Manage</Button>
            </div>
            <ul className="space-y-2 max-h-[280px] overflow-y-auto pretty-scroll pr-1">
              {animals
                .filter((a) => a.status !== "Healthy")
                .map((a) => (
                  <li
                    key={a.id}
                    className="glass-thin rounded-2xl p-3 flex items-start gap-3"
                  >
                    <div className="h-9 w-9 rounded-xl glass-thin grid place-items-center">
                      <I.Cow size={18} className="text-emerald-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono text-xs truncate">{a.tag}</div>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="text-xs text-white/55 truncate">{a.location.zone}</div>
                      <div className="mt-1.5">
                        <BatteryBar value={a.device.battery} />
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="text-base font-semibold tracking-tight">Live feed</h3>
            <ul className="mt-4 space-y-3">
              {recentActivity.slice(0, 5).map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <Badge tone={a.tone}>{a.when}</Badge>
                  <p className="text-white/80 leading-snug">{a.text}</p>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="glass-thin rounded-2xl p-3">
      <div className={`text-2xl font-semibold tracking-tight ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/50 mt-0.5">
        {label}
      </div>
    </div>
  );
}

function LayerToggle({
  color,
  label,
  hint,
  on = false,
}: {
  color: string;
  label: string;
  hint: string;
  on?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}` }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm">{label}</div>
        <div className="text-[11px] text-white/50">{hint}</div>
      </div>
      <span
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
          on ? "bg-emerald-400/60" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            on ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </li>
  );
}
