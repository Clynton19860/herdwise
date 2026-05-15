import { animals, geofences } from "@/lib/data";

const zoneColor: Record<string, string> = {
  Grazing: "rgba(0, 245, 160, 0.18)",
  Restricted: "rgba(255, 107, 107, 0.18)",
  Watering: "rgba(91, 231, 255, 0.18)",
  Buffer: "rgba(255, 181, 71, 0.18)",
  Quarantine: "rgba(140, 124, 255, 0.18)",
};
const zoneStroke: Record<string, string> = {
  Grazing: "rgba(0, 245, 160, 0.55)",
  Restricted: "rgba(255, 107, 107, 0.55)",
  Watering: "rgba(91, 231, 255, 0.55)",
  Buffer: "rgba(255, 181, 71, 0.55)",
  Quarantine: "rgba(140, 124, 255, 0.55)",
};

export function MiniMap({ className = "" }: { className?: string }) {
  return (
    <div
      className={`map-canvas topo-lines relative overflow-hidden rounded-3xl border border-white/10 ${className}`}
    >
      {/* Soft grid */}
      <div className="absolute inset-0 grid-lines opacity-40" />

      {/* Polygons */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {geofences.map((g) => (
          <polygon
            key={g.id}
            points={g.polygon.map((p) => p.join(",")).join(" ")}
            fill={zoneColor[g.type]}
            stroke={zoneStroke[g.type]}
            strokeWidth="0.25"
            strokeDasharray={g.type === "Restricted" ? "1 1" : undefined}
          />
        ))}
      </svg>

      {/* Animal pins */}
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
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${a.location.x}%`, top: `${a.location.y}%` }}
            >
              <span className="relative inline-flex h-2.5 w-2.5">
                <span
                  className={`absolute inset-0 rounded-full ${color} opacity-60 animate-pulse-ring`}
                />
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color} ring-2 ring-white/30 shadow-[0_0_12px_currentColor]`}
                />
              </span>
            </div>
          );
        })}
      </div>

      {/* Compass + scale chips */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <span className="chip">Live · Harare</span>
        <span className="chip">{animals.length.toLocaleString()} tracked</span>
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 text-[10px] uppercase tracking-wider text-white/60">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_currentColor]" />
          Healthy
          <span className="ml-2 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_currentColor]" />
          Monitoring
          <span className="ml-2 h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_currentColor]" />
          Alert
        </div>
      </div>
    </div>
  );
}
