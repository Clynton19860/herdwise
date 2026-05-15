import { animals, geofences } from "@/lib/data";
import { I } from "@/components/ui/icon";

const zoneColor: Record<string, string> = {
  Grazing: "rgba(0, 245, 160, 0.18)",
  Restricted: "rgba(255, 107, 107, 0.22)",
  Watering: "rgba(91, 231, 255, 0.20)",
  Buffer: "rgba(255, 181, 71, 0.20)",
  Quarantine: "rgba(140, 124, 255, 0.20)",
};
const zoneStroke: Record<string, string> = {
  Grazing: "rgba(0, 245, 160, 0.6)",
  Restricted: "rgba(255, 107, 107, 0.7)",
  Watering: "rgba(91, 231, 255, 0.65)",
  Buffer: "rgba(255, 181, 71, 0.65)",
  Quarantine: "rgba(140, 124, 255, 0.65)",
};

export function BigMap({ className = "" }: { className?: string }) {
  return (
    <div
      className={`map-canvas topo-lines relative overflow-hidden rounded-3xl border border-white/10 ${className}`}
    >
      <div className="absolute inset-0 grid-lines opacity-40" />

      {/* Polygons + labels */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {geofences.map((g) => {
          const cx = g.polygon.reduce((s, p) => s + p[0], 0) / g.polygon.length;
          const cy = g.polygon.reduce((s, p) => s + p[1], 0) / g.polygon.length;
          return (
            <g key={g.id}>
              <polygon
                points={g.polygon.map((p) => p.join(",")).join(" ")}
                fill={zoneColor[g.type]}
                stroke={zoneStroke[g.type]}
                strokeWidth="0.25"
                strokeDasharray={g.type === "Restricted" ? "1 1" : undefined}
              />
              <text
                x={cx}
                y={cy}
                fill="rgba(255,255,255,0.85)"
                fontSize="1.6"
                fontWeight="500"
                textAnchor="middle"
                className="font-sans"
                style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.4)", strokeWidth: 0.4 }}
              >
                {g.name}
              </text>
            </g>
          );
        })}
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
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${a.location.x}%`, top: `${a.location.y}%` }}
            >
              <span className="relative inline-flex h-3 w-3">
                <span className={`absolute inset-0 rounded-full ${color} opacity-60 animate-pulse-ring`} />
                <span
                  className={`relative inline-flex h-3 w-3 rounded-full ${color} ring-2 ring-white/30 shadow-[0_0_12px_currentColor]`}
                />
              </span>
              {/* Hover tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity glass-heavy rounded-xl px-3 py-2 text-xs whitespace-nowrap z-20">
                <div className="font-medium">{a.tag}</div>
                <div className="text-white/55">{a.location.zone}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compass */}
      <div className="absolute top-4 right-4 glass-thin rounded-2xl h-14 w-14 grid place-items-center text-white/85">
        <div className="relative h-9 w-9">
          <span className="absolute inset-0 rounded-full border border-white/20" />
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 text-[10px] font-semibold">N</span>
          <span className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1 text-[10px] text-white/55">W</span>
          <span className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1 text-[10px] text-white/55">E</span>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 text-[10px] text-white/55">S</span>
        </div>
      </div>

      {/* Layer controls */}
      <div className="absolute top-4 left-4 glass-thin rounded-2xl p-1.5 flex items-center gap-1">
        <button className="px-3 h-8 rounded-xl text-xs bg-white/10">Live</button>
        <button className="px-3 h-8 rounded-xl text-xs text-white/65 hover:bg-white/5">Heatmap</button>
        <button className="px-3 h-8 rounded-xl text-xs text-white/65 hover:bg-white/5">History</button>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 glass-thin rounded-2xl flex flex-col">
        <button className="h-9 w-9 grid place-items-center text-white/85 hover:bg-white/8 rounded-t-2xl">
          <I.Plus size={16} />
        </button>
        <div className="h-px bg-white/10" />
        <button className="h-9 w-9 grid place-items-center text-white/85 hover:bg-white/8 rounded-b-2xl">
          <I.X size={16} className="rotate-45" />
        </button>
      </div>

      {/* Scale */}
      <div className="absolute bottom-4 left-4 text-xs text-white/60 font-mono flex items-center gap-2">
        <div className="h-1 w-16 bg-white/40 rounded-full" />
        2 km
      </div>
    </div>
  );
}
