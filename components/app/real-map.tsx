"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Animal, Geofence } from "@/lib/types";
import { HARARE_BOUNDS, HARARE_CENTER, polygonToLatLng, toLatLng } from "@/lib/geo";

const zoneColor: Record<string, { fill: string; stroke: string }> = {
  Grazing:    { fill: "rgba(0, 245, 160, 0.28)", stroke: "rgba(0, 245, 160, 0.9)" },
  Restricted: { fill: "rgba(255, 107, 107, 0.30)", stroke: "rgba(255, 107, 107, 1)" },
  Watering:   { fill: "rgba(91, 231, 255, 0.28)", stroke: "rgba(91, 231, 255, 0.95)" },
  Buffer:     { fill: "rgba(255, 181, 71, 0.28)", stroke: "rgba(255, 181, 71, 0.95)" },
  Quarantine: { fill: "rgba(140, 124, 255, 0.30)", stroke: "rgba(140, 124, 255, 0.95)" },
};

function statusColor(status: Animal["status"]) {
  switch (status) {
    case "Alert":       return "#ff6b6b";
    case "Monitoring":  return "#ffb547";
    case "Quarantined": return "#8c7cff";
    default:            return "#34c071";
  }
}

function animalIcon(animal: Animal) {
  const color = statusColor(animal.status);
  return L.divIcon({
    className: "herdwise-pin",
    html: `
      <span style="position:relative;display:inline-flex;height:14px;width:14px;">
        <span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:0.55;animation:pulse-ring 2.4s cubic-bezier(0.215,0.61,0.355,1) infinite;"></span>
        <span style="position:relative;display:inline-block;height:14px;width:14px;border-radius:9999px;background:${color};box-shadow:0 0 12px ${color},inset 0 0 0 2px rgba(255,255,255,0.35);"></span>
      </span>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function RealMap({
  animals,
  zones,
  highlightZoneId,
  className = "",
  height,
  fitToZone,
}: {
  animals: Animal[];
  zones: Geofence[];
  /** Render the named zone with a thicker stroke + auto-fit map to it. */
  highlightZoneId?: string;
  className?: string;
  /** Optional fixed pixel height. When omitted, className (e.g. h-full) controls height. */
  height?: number;
  fitToZone?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Stable references so React renders once and we manage the map imperatively
  const zonesData = useMemo(() => zones, [zones]);
  const animalsData = useMemo(() => animals, [animals]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: HARARE_CENTER,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
      maxBounds: [
        [HARARE_BOUNDS.south - 0.06, HARARE_BOUNDS.west - 0.06],
        [HARARE_BOUNDS.north + 0.06, HARARE_BOUNDS.east + 0.06],
      ],
      maxBoundsViscosity: 0.85,
      minZoom: 11,
      maxZoom: 18,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }
    ).addTo(map);

    // Zoom control on the right so it doesn't conflict with our overlays
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers: L.Layer[] = [];

    for (const zone of zonesData) {
      const c = zoneColor[zone.type] ?? zoneColor.Grazing;
      const isHero = zone.id === highlightZoneId;
      const latLngs = polygonToLatLng(zone.polygon);
      const poly = L.polygon(latLngs, {
        color: c.stroke,
        weight: isHero ? 3 : 1.5,
        fillColor: c.fill,
        fillOpacity: 1,
        dashArray: zone.type === "Restricted" ? "6 6" : undefined,
        smoothFactor: 0.5,
      }).addTo(map);
      poly.bindTooltip(`${zone.name} · ${zone.type}`, {
        direction: "top",
        offset: [0, -6],
        opacity: 0.95,
        className: "herdwise-tooltip",
      });
      layers.push(poly);

      if (isHero && fitToZone) {
        map.fitBounds(poly.getBounds(), { padding: [40, 40], maxZoom: 15 });
      }
    }

    return () => {
      for (const l of layers) map.removeLayer(l);
    };
  }, [zonesData, highlightZoneId, fitToZone]);

  // Animal markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: L.Marker[] = [];

    for (const animal of animalsData) {
      const [lat, lng] = toLatLng(animal.location.x, animal.location.y);
      const marker = L.marker([lat, lng], {
        icon: animalIcon(animal),
        keyboard: false,
      }).addTo(map);
      marker.bindTooltip(
        `<strong>${animal.tag}</strong><br/><span style="color:rgba(255,255,255,0.6)">${animal.location.zone}</span>`,
        {
          direction: "top",
          offset: [0, -10],
          opacity: 0.95,
          className: "herdwise-tooltip",
        }
      );
      markers.push(marker);
    }

    return () => {
      for (const m of markers) map.removeLayer(m);
    };
  }, [animalsData]);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 ${className}`}
      style={height ? { height } : undefined}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {/* Top-left chip */}
      <div className="absolute top-3 left-3 z-[400] pointer-events-none">
        <span className="chip">Live · OpenStreetMap · CARTO</span>
      </div>
    </div>
  );
}
