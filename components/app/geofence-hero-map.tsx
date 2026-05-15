"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { I } from "@/components/ui/icon";
import { ScopedMap } from "@/components/app/scoped-map";
import type { Animal, Geofence } from "@/lib/types";

const RealMap = dynamic(() => import("./real-map").then((m) => m.RealMap), {
  ssr: false,
  loading: () => (
    <div className="map-canvas topo-lines h-full w-full grid place-items-center text-white/55 text-sm rounded-3xl border border-white/10">
      Loading realistic map…
    </div>
  ),
});

export function GeofenceHeroMap({
  animals,
  zones,
  highlightZoneId,
  className = "",
}: {
  animals: Animal[];
  zones: Geofence[];
  highlightZoneId: string;
  className?: string;
}) {
  const [mode, setMode] = useState<"stylized" | "realistic">("stylized");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 glass-thin rounded-2xl p-1 w-fit">
          <Toggle active={mode === "stylized"} onClick={() => setMode("stylized")} icon={<I.Sparkle size={14} />}>
            Stylized
          </Toggle>
          <Toggle active={mode === "realistic"} onClick={() => setMode("realistic")} icon={<I.Globe size={14} />}>
            Realistic
          </Toggle>
        </div>
        <span className="text-[11px] text-white/45">
          {mode === "realistic" ? "Auto-fits to the zone boundary" : "Bespoke view"}
        </span>
      </div>
      <div className={`relative ${className}`}>
        {mode === "stylized" ? (
          <ScopedMap
            animals={animals}
            zones={zones}
            highlightZoneId={highlightZoneId}
            className="h-full w-full"
          />
        ) : (
          <RealMap
            animals={animals}
            zones={zones}
            highlightZoneId={highlightZoneId}
            fitToZone
            className="h-full w-full"
          />
        )}
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-3.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5
        ${active
          ? "bg-[linear-gradient(135deg,rgba(0,245,160,0.25),rgba(91,231,255,0.15))] text-white shadow-[0_0_18px_-6px_rgba(0,245,160,0.6)]"
          : "text-white/65 hover:text-white"}`}
    >
      {icon}
      {children}
    </button>
  );
}
