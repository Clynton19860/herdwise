"use client";

import { useRef, useState, useEffect } from "react";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { geofences } from "@/lib/data";

type Point = [number, number];

const zoneColor: Record<string, { fill: string; stroke: string }> = {
  Grazing:    { fill: "rgba(0, 245, 160, 0.30)", stroke: "rgba(0, 245, 160, 0.9)" },
  Restricted: { fill: "rgba(255, 107, 107, 0.30)", stroke: "rgba(255, 107, 107, 0.95)" },
  Watering:   { fill: "rgba(91, 231, 255, 0.30)", stroke: "rgba(91, 231, 255, 0.95)" },
  Buffer:     { fill: "rgba(255, 181, 71, 0.30)", stroke: "rgba(255, 181, 71, 0.95)" },
  Quarantine: { fill: "rgba(140, 124, 255, 0.30)", stroke: "rgba(140, 124, 255, 0.95)" },
};

function polygonAreaPercent(points: Point[]) {
  if (points.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Convert a viewBox-percentage area into a fake-but-plausible hectares value. */
function percentAreaToHectares(p: number) {
  // The pilot's mapped region is roughly 9,000 ha. Map 100% area → 9,000 ha.
  return Math.round((p / 100) * 9000);
}

export function PolygonDrawer({
  zoneType,
  points,
  onChange,
}: {
  zoneType: string;
  points: Point[];
  onChange: (pts: Point[]) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const c = zoneColor[zoneType] ?? zoneColor.Grazing;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && points.length > 0) onChange([]);
      if ((e.key === "Backspace" || e.key === "z") && points.length > 0)
        onChange(points.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [points, onChange]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onChange([...points, [Number(x.toFixed(2)), Number(y.toFixed(2))]]);
  };

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) {
      setHover(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setHover([x, y]);
  };

  const ha = percentAreaToHectares(polygonAreaPercent(points));
  const closed = points.length >= 3;

  // Build SVG path; if hovering and closed not yet, preview line to cursor
  const pointsStr = points.map((p) => p.join(",")).join(" ");
  const previewLine =
    points.length > 0 && hover ? [points[points.length - 1], hover] : null;

  return (
    <div className="space-y-3">
      <div
        ref={ref}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        className="map-canvas topo-lines relative overflow-hidden rounded-3xl border border-white/10 cursor-crosshair h-[520px]"
      >
        <div className="absolute inset-0 grid-lines opacity-30 pointer-events-none" />

        {/* Existing zones shown as faint context */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
          {geofences.map((g) => (
            <polygon
              key={g.id}
              points={g.polygon.map((p) => p.join(",")).join(" ")}
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="0.4 0.6"
              strokeWidth="0.15"
            />
          ))}
        </svg>

        {/* Live polygon */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
          {points.length >= 3 && (
            <polygon
              points={pointsStr}
              fill={c.fill}
              stroke={c.stroke}
              strokeWidth="0.35"
            />
          )}
          {points.length === 2 && (
            <line
              x1={points[0][0]}
              y1={points[0][1]}
              x2={points[1][0]}
              y2={points[1][1]}
              stroke={c.stroke}
              strokeWidth="0.35"
            />
          )}
          {previewLine && (
            <line
              x1={previewLine[0][0]}
              y1={previewLine[0][1]}
              x2={previewLine[1][0]}
              y2={previewLine[1][1]}
              stroke={c.stroke}
              strokeWidth="0.25"
              strokeDasharray="0.7 0.5"
              opacity="0.7"
            />
          )}
          {/* Closing line preview */}
          {points.length >= 3 && hover && (
            <line
              x1={points[points.length - 1][0]}
              y1={points[points.length - 1][1]}
              x2={points[0][0]}
              y2={points[0][1]}
              stroke={c.stroke}
              strokeWidth="0.2"
              strokeDasharray="0.5 0.4"
              opacity="0.5"
            />
          )}
        </svg>

        {/* Vertex dots */}
        <div className="absolute inset-0 pointer-events-none">
          {points.map((p, i) => (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p[0]}%`, top: `${p[1]}%` }}
            >
              <span className="block h-3 w-3 rounded-full bg-emerald-300 ring-2 ring-white/30 shadow-[0_0_12px_currentColor]" />
            </div>
          ))}
          {hover && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${hover[0]}%`, top: `${hover[1]}%` }}
            >
              <span className="block h-2 w-2 rounded-full bg-white/70 ring-1 ring-white/40" />
            </div>
          )}
        </div>

        {/* Helper overlay */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
          <span className="chip">Click to add vertices</span>
          <span className="chip">Press Z to undo · Esc to clear</span>
        </div>

        <div className="absolute bottom-4 left-4 chip">
          {points.length} vertices · {ha.toLocaleString()} ha
        </div>

        {closed && (
          <div className="absolute bottom-4 right-4 chip">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_currentColor]" />
            Polygon closed
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="glass"
          size="sm"
          onClick={() => onChange(points.slice(0, -1))}
          disabled={points.length === 0}
          iconLeft={<I.ArrowRight size={14} className="rotate-180" />}
        >
          Undo
        </Button>
        <Button
          variant="glass"
          size="sm"
          onClick={() => onChange([])}
          disabled={points.length === 0}
          iconLeft={<I.X size={14} />}
        >
          Clear
        </Button>
        <div className="ml-auto text-xs text-white/55">
          Minimum 3 vertices to form a zone.
        </div>
      </div>
    </div>
  );
}
