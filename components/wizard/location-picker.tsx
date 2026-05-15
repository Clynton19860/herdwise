"use client";

import { useRef } from "react";
import { geofences } from "@/lib/data";

type Point = { x: number; y: number };

export function LocationPicker({
  value,
  onChange,
  height = 360,
  accent = "#ff8a8a",
}: {
  value: Point | null;
  onChange: (p: Point) => void;
  height?: number;
  accent?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const click = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onChange({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
  };

  return (
    <div
      ref={ref}
      onClick={click}
      className="map-canvas topo-lines relative overflow-hidden rounded-3xl border border-white/10 cursor-crosshair"
      style={{ height }}
    >
      <div className="absolute inset-0 grid-lines opacity-30 pointer-events-none" />

      {/* Context zones (faint) */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
        {geofences.map((g) => (
          <polygon
            key={g.id}
            points={g.polygon.map((p) => p.join(",")).join(" ")}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.2"
            strokeDasharray="0.5 0.5"
          />
        ))}
      </svg>

      {value && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{ left: `${value.x}%`, top: `${value.y}%` }}
        >
          <div className="relative">
            <span
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 inline-flex h-3 w-3"
            >
              <span
                className="absolute inset-0 rounded-full animate-pulse-ring"
                style={{ background: accent, opacity: 0.65 }}
              />
              <span
                className="relative h-3 w-3 rounded-full ring-2 ring-white/40 shadow-[0_0_16px_currentColor]"
                style={{ background: accent, color: accent }}
              />
            </span>
            <div
              className="glass-heavy rounded-xl px-3 py-1.5 text-[11px] font-mono whitespace-nowrap"
              style={{ borderColor: `${accent}55` }}
            >
              {value.x.toFixed(2)}°E · {value.y.toFixed(2)}°S
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 chip">
        Click anywhere on the map to pin the incident location
      </div>
    </div>
  );
}
