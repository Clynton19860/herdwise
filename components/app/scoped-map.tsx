import type { Animal, Geofence } from "@/lib/types";

const zoneColor: Record<string, string> = {
  Grazing: "rgba(0, 245, 160, 0.16)",
  Restricted: "rgba(255, 107, 107, 0.18)",
  Watering: "rgba(91, 231, 255, 0.16)",
  Buffer: "rgba(255, 181, 71, 0.16)",
  Quarantine: "rgba(140, 124, 255, 0.18)",
};
const zoneStroke: Record<string, string> = {
  Grazing: "rgba(0, 245, 160, 0.45)",
  Restricted: "rgba(255, 107, 107, 0.6)",
  Watering: "rgba(91, 231, 255, 0.55)",
  Buffer: "rgba(255, 181, 71, 0.55)",
  Quarantine: "rgba(140, 124, 255, 0.6)",
};

/** A reusable map used on detail pages, accepting a scoped subset. */
export function ScopedMap({
  animals,
  zones,
  highlightZoneId,
  className = "",
  height,
}: {
  animals: Animal[];
  zones: Geofence[];
  /** When set, that zone gets a thicker stroke + glow. */
  highlightZoneId?: string;
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={`map-canvas topo-lines relative overflow-hidden rounded-3xl border border-white/10 ${className}`}
      style={height ? { height } : undefined}
    >
      <div className="absolute inset-0 grid-lines opacity-30" />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {zones.map((g) => {
          const isHero = g.id === highlightZoneId;
          return (
            <polygon
              key={g.id}
              points={g.polygon.map((p) => p.join(",")).join(" ")}
              fill={zoneColor[g.type]}
              stroke={zoneStroke[g.type]}
              strokeWidth={isHero ? "0.5" : "0.2"}
              strokeDasharray={g.type === "Restricted" ? "1 1" : undefined}
              opacity={highlightZoneId && !isHero ? 0.35 : 1}
              style={isHero ? { filter: "drop-shadow(0 0 6px rgba(0,245,160,0.5))" } : undefined}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0">
        {animals.map((a) => {
          const color =
            a.status === "Alert"
              ? "bg-rose-400"
              : a.status === "Monitoring"
                ? "bg-amber-300"
                : a.status === "Quarantined"
                  ? "bg-violet-400"
                  : "bg-emerald-300";
          return (
            <div
              key={a.id}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${a.location.x}%`, top: `${a.location.y}%` }}
            >
              <span className="relative inline-flex h-2.5 w-2.5">
                <span className={`absolute inset-0 rounded-full ${color} opacity-65 animate-pulse-ring`} />
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color} ring-2 ring-white/30 shadow-[0_0_10px_currentColor]`} />
              </span>
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity glass-heavy rounded-xl px-2.5 py-1.5 text-[10px] whitespace-nowrap z-20">
                <div className="font-medium">{a.tag}</div>
                <div className="text-white/55">{a.location.zone}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
