"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase, realtimeEnabled } from "@/lib/supabase-browser";
import type { MapAnimal, MapParcel } from "@/lib/db";
import { I } from "@/components/ui/icon";

/**
 * The live field map.
 *
 * Real coordinates throughout — no canvas projection. Parcels are drawn from
 * PostGIS GeoJSON, animals from their last GPS fix, and both update in place as
 * Realtime pushes changes.
 */

type Mode = "2d" | "3d";

const STATUS_COLOUR: Record<string, string> = {
  healthy: "#00f5a0",
  monitoring: "#ffb547",
  alert: "#ff6b6b",
  quarantined: "#8c7cff",
  deceased: "#7c877f",
};

/** Outside its allocation overrides health colour — that is the urgent fact. */
const BREACH_COLOUR = "#ff3b3b";

/**
 * The map opens where the herd actually is.
 *
 * It used to open on a fixed regional centre and rely on the fit effect to fly
 * to the data afterwards. When a pilot's animals sit a thousand kilometres from
 * that centre, the first thing an operator sees is empty countryside with no pin
 * in it — and if the fit is ever skipped or delayed, that is the whole
 * impression. Deriving the opening view from the data removes the dependency
 * rather than tuning it.
 *
 * The regional centre survives only as the last resort for an empty database,
 * which is also why no real coordinate is committed to this repository.
 */
const REGION_FALLBACK: [number, number] = [31.05, -17.83]; // Harare

function openingView(animals: MapAnimal[], parcels: MapParcel[]) {
  for (const a of animals) {
    if (a.lat != null && a.lng != null) return { center: [a.lng, a.lat] as [number, number], zoom: 17 };
  }
  for (const p of parcels) {
    const ring = (p.geojson.coordinates[0] ?? []) as number[][];
    if (ring.length) {
      return {
        center: [
          ring.reduce((s, c) => s + c[0], 0) / ring.length,
          ring.reduce((s, c) => s + c[1], 0) / ring.length,
        ] as [number, number],
        zoom: 16,
      };
    }
  }
  return { center: REGION_FALLBACK, zoom: 12 };
}

/**
 * A raster style rather than a vector one: raster tiles need no API key, no
 * account and no vendor lock, and the tiles are cacheable for the offline
 * requirement. Swap the source for a paid provider later without touching
 * anything else here.
 */
function baseStyle(mode: Mode): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Esri, Maxar, Earthstar Geographics",
      },
      labels: {
        type: "raster",
        tiles: ["https://basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}{r}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors © CARTO",
      },
      ...(mode === "3d"
        ? {
            terrain: {
              type: "raster-dem" as const,
              // Terrarium-encoded elevation, open data, no key required.
              tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 15,
              encoding: "terrarium" as const,
              attribution: "Mapzen / AWS Terrain Tiles",
            },
          }
        : {}),
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#0a1612" } },
      { id: "satellite", type: "raster", source: "satellite", paint: { "raster-opacity": 0.92 } },
      { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.55 } },
    ],
    ...(mode === "3d" ? { terrain: { source: "terrain", exaggeration: 1.4 } } : {}),
  };
}

export function FieldMap({
  animals: initialAnimals,
  parcels,
  className = "",
  focus,
  onDrawComplete,
  drawing = false,
}: {
  animals: MapAnimal[];
  parcels: MapParcel[];
  className?: string;
  /** [lng, lat] to centre on; otherwise fits everything. */
  focus?: [number, number];
  /** Called with a closed ring of [lng, lat] when a parcel is drawn. */
  onDrawComplete?: (ring: [number, number][]) => void;
  drawing?: boolean;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [mode, setMode] = useState<Mode>("2d");
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);
  const [animals, setAnimals] = useState(initialAnimals);
  const [draft, setDraft] = useState<[number, number][]>([]);

  // Server data wins whenever the page re-renders. Adjusted during render
  // rather than in an effect, which would cost an extra render every refresh.
  const [lastServerData, setLastServerData] = useState(initialAnimals);
  if (initialAnimals !== lastServerData) {
    setLastServerData(initialAnimals);
    setAnimals(initialAnimals);
  }

  const [wasDrawing, setWasDrawing] = useState(drawing);
  if (drawing !== wasDrawing) {
    setWasDrawing(drawing);
    if (!drawing) setDraft([]);
  }

  /* ------------------------------------------------ map creation */

  // Computed once, from the server-rendered data, before the map exists.
  const opening = useRef(openingView(initialAnimals, parcels)).current;

  useEffect(() => {
    if (!holder.current || map.current) return;
    const m = new maplibregl.Map({
      container: holder.current,
      style: baseStyle("2d"),
      center: focus ?? opening.center,
      zoom: focus ? 17 : opening.zoom,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    m.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
    m.on("load", () => { map.current = m; setReady(true); });

    // MapLibre sizes its canvas once at construction. If the container has no
    // height yet — CSS still settling, a collapsed panel — the map renders
    // nothing forever. Watch the box and tell it to resize.
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(holder.current);

    return () => { ro.disconnect(); m.remove(); map.current = null; setReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------ parcels */

  const drawParcels = useCallback((m: MLMap, list: MapParcel[]) => {
    const data = {
      type: "FeatureCollection" as const,
      features: list.map((p) => ({
        type: "Feature" as const,
        properties: { id: p.id, name: p.name, ha: Number(p.area_ha), animals: Number(p.animal_count) },
        geometry: p.geojson as GeoJSON.Polygon,
      })),
    };
    const src = m.getSource("parcels") as maplibregl.GeoJSONSource | undefined;
    if (src) { src.setData(data); return; }

    m.addSource("parcels", { type: "geojson", data });
    m.addLayer({
      id: "parcel-fill", type: "fill", source: "parcels",
      paint: { "fill-color": "#00f5a0", "fill-opacity": 0.12 },
    });
    m.addLayer({
      id: "parcel-line", type: "line", source: "parcels",
      paint: { "line-color": "#00f5a0", "line-width": 2, "line-opacity": 0.85 },
    });
    m.addLayer({
      id: "parcel-label", type: "symbol", source: "parcels",
      layout: {
        "text-field": ["concat", ["get", "name"], "\n", ["to-string", ["round", ["get", "ha"]]], " ha"],
        "text-size": 11, "text-anchor": "center", "text-allow-overlap": false,
      },
      paint: { "text-color": "#eafbf1", "text-halo-color": "#04150f", "text-halo-width": 1.5 },
    });
  }, []);

  /* ------------------------------------------------ 2D / 3D */

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.setStyle(baseStyle(mode));
    m.once("styledata", () => {
      if (mode === "3d") {
        m.setTerrain({ source: "terrain", exaggeration: 1.4 });
        m.easeTo({ pitch: 60, bearing: -20, duration: 900 });
      } else {
        m.setTerrain(null);
        m.easeTo({ pitch: 0, bearing: 0, duration: 700 });
      }
      drawParcels(m, parcels);
    });
  }, [mode, ready, parcels, drawParcels]);


  useEffect(() => {
    if (map.current && ready) drawParcels(map.current, parcels);
  }, [parcels, ready, drawParcels]);

  /* ------------------------------------------------ animals */

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const seen = new Set<string>();
    for (const a of animals) {
      if (a.lat == null || a.lng == null) continue;
      seen.add(a.animal_id);
      const breached = a.containment_state === "outside";
      const colour = breached ? BREACH_COLOUR : (STATUS_COLOUR[a.status] ?? "#00f5a0");

      let marker = markers.current.get(a.animal_id);
      if (!marker) {
        const el = document.createElement("div");
        el.className = "hw-pin";
        el.innerHTML = `<span class="hw-pin-ring"></span><span class="hw-pin-dot"></span>`;
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([a.lng, a.lat])
          .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }))
          .addTo(m);
        markers.current.set(a.animal_id, marker);
      } else {
        // Animate rather than jump, so a live update reads as movement.
        marker.setLngLat([a.lng, a.lat]);
      }

      const el = marker.getElement();
      el.style.setProperty("--pin", colour);
      el.classList.toggle("hw-pin-breach", breached);
      marker.getPopup()?.setHTML(popupHtml(a));
    }

    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) { marker.remove(); markers.current.delete(id); }
    }
  }, [animals, ready]);

  /* ------------------------------------------------ fit bounds */

  /**
   * Fit to where the herd actually is, not to every point on the platform.
   *
   * A naive fitBounds over all data zooms out to contain the furthest outlier —
   * one animal a thousand kilometres away, a mis-imported parcel — and shows a
   * continent with nothing readable on it. Instead, take the median position
   * (robust to outliers in a way the mean is not) and fit only to points within
   * a working radius of it. `Fit all` stays available so nothing is unreachable.
   */
  const OUTLIER_RADIUS_KM = 40;

  const fitTo = useCallback((m: MLMap, all: boolean) => {
    const pts: [number, number][] = [];
    for (const a of animals) if (a.lat != null && a.lng != null) pts.push([a.lng, a.lat]);
    if (!pts.length) {
      for (const p of parcels) for (const c of p.geojson.coordinates[0] ?? []) pts.push(c as [number, number]);
    }
    if (pts.length < 1) return;

    let keep = pts;
    if (!all && pts.length > 1) {
      const median = (xs: number[]) => {
        const s = [...xs].sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)];
      };
      const mLng = median(pts.map((p) => p[0]));
      const mLat = median(pts.map((p) => p[1]));
      const km = (lng: number, lat: number) => {
        const dLat = (lat - mLat) * 111.32;
        const dLng = (lng - mLng) * 111.32 * Math.cos((mLat * Math.PI) / 180);
        return Math.hypot(dLat, dLng);
      };
      const near = pts.filter(([lng, lat]) => km(lng, lat) <= OUTLIER_RADIUS_KM);
      if (near.length) keep = near;

      // Include any parcel that overlaps the kept cluster, so a field is never
      // half off-screen.
      for (const p of parcels) {
        for (const c of p.geojson.coordinates[0] ?? []) {
          const [lng, lat] = c as [number, number];
          if (km(lng, lat) <= OUTLIER_RADIUS_KM) keep.push([lng, lat]);
        }
      }
    } else if (all) {
      for (const p of parcels) for (const c of p.geojson.coordinates[0] ?? []) keep.push(c as [number, number]);
    }

    if (keep.length === 1) {
      m.easeTo({ center: keep[0], zoom: 17, duration: 600 });
      return;
    }
    const b = keep.reduce((acc, pt) => acc.extend(pt), new maplibregl.LngLatBounds(keep[0], keep[0]));
    m.fitBounds(b, { padding: 70, maxZoom: 17, duration: all ? 800 : 0 });
  }, [animals, parcels]);

  const didFit = useRef(false);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || focus || didFit.current) return;
    if (!animals.length && !parcels.length) return;
    fitTo(m, false);
    didFit.current = true;
  }, [ready, focus, animals.length, parcels.length, fitTo]);

  /* ------------------------------------------------ realtime */

  useEffect(() => {
    const client = supabase;
    if (!realtimeEnabled || !client) return;
    const channel = client
      .channel("herdwise-map")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "devices" }, (payload) => {
        const row = payload.new as { animal_id: string | null; last_position: unknown; battery_pct: number | null };
        if (!row.animal_id) return;
        // The geography column arrives as WKB; refetch the projected view
        // rather than decoding it in the browser.
        void refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "containment_events" }, () => {
        void refresh();
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    async function refresh() {
      const res = await fetch("/api/map/animals", { cache: "no-store" });
      if (res.ok) setAnimals(await res.json());
    }

    return () => { void client.removeChannel(channel); };
  }, []);

  /* ------------------------------------------------ drawing */

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.getCanvas().style.cursor = drawing ? "crosshair" : "";
    if (!drawing) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      setDraft((d) => [...d, [e.lngLat.lng, e.lngLat.lat]]);
    };
    m.on("click", onClick);
    return () => { m.off("click", onClick); };
  }, [drawing, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const data = {
      type: "FeatureCollection" as const,
      features: draft.length
        ? [{
            type: "Feature" as const, properties: {},
            geometry: draft.length >= 3
              ? { type: "Polygon" as const, coordinates: [[...draft, draft[0]]] }
              : { type: "LineString" as const, coordinates: draft },
          }]
        : [],
    };
    const src = m.getSource("draft") as maplibregl.GeoJSONSource | undefined;
    if (src) { src.setData(data); return; }
    m.addSource("draft", { type: "geojson", data });
    m.addLayer({ id: "draft-fill", type: "fill", source: "draft", paint: { "fill-color": "#5be7ff", "fill-opacity": 0.2 } });
    m.addLayer({ id: "draft-line", type: "line", source: "draft", paint: { "line-color": "#5be7ff", "line-width": 2, "line-dasharray": [2, 1] } });
  }, [draft, ready]);

  return (
    <div className={`relative min-h-[280px] ${className}`}>
      {/* Sized with h-full rather than `absolute inset-0`: maplibre-gl.css sets
          `.maplibregl-map { position: relative }`, which wins over Tailwind's
          `absolute` and silently drops `inset-0`, collapsing the map to zero
          height. Explicit dimensions are immune to that conflict. */}
      <div ref={holder} className="h-full w-full rounded-3xl overflow-hidden" />

      {/* 2D / 3D + live indicator */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="glass-thin rounded-2xl p-1 flex items-center gap-1">
          {(["2d", "3d"] as const).map((mo) => (
            <button
              key={mo}
              onClick={() => setMode(mo)}
              className={`h-8 px-3 rounded-xl text-xs font-medium transition-all uppercase tracking-wide
                ${mode === mo ? "bg-[linear-gradient(135deg,rgba(0,245,160,0.25),rgba(91,231,255,0.15))] text-white" : "text-white/60 hover:text-white"}`}
            >
              {mo}
            </button>
          ))}
        </div>
        <button
          onClick={() => map.current && fitTo(map.current, false)}
          className="chip hover:bg-white/10 transition-colors"
          title="Centre on the main group of animals"
        >
          <I.Map size={11} className="mr-1" /> Herd
        </button>
        <button
          onClick={() => map.current && fitTo(map.current, true)}
          className="chip hover:bg-white/10 transition-colors"
          title="Zoom out to include every animal and field, however far away"
        >
          <I.Globe size={11} className="mr-1" /> All
        </button>
        <span className="chip" title={live ? "Live updates connected" : "Not receiving live updates"}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${live ? "bg-emerald-300 animate-pulse" : "bg-white/30"}`} />
          {live ? "Live" : "Static"}
        </span>
      </div>

      {drawing && (
        <div className="absolute top-3 right-3 z-10 glass-heavy rounded-2xl p-3 max-w-[240px]">
          <div className="text-xs font-medium flex items-center gap-1.5">
            <I.Layers size={13} className="text-cyan-300" /> Drawing a field
          </div>
          <p className="text-[11px] text-white/60 mt-1 leading-snug">
            Click to place corners. Three or more closes the shape.
          </p>
          <div className="mt-2 text-[11px] font-mono text-white/70">{draft.length} corners</div>
          <div className="mt-2 flex gap-1.5">
            <button
              disabled={draft.length < 3}
              onClick={() => { onDrawComplete?.([...draft, draft[0]]); setDraft([]); }}
              className="flex-1 h-8 rounded-xl text-xs font-medium bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] text-emerald-950 disabled:opacity-35"
            >
              Save
            </button>
            <button
              onClick={() => setDraft((d) => d.slice(0, -1))}
              disabled={!draft.length}
              className="h-8 px-2.5 rounded-xl text-xs glass-thin text-white/75 disabled:opacity-35"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function popupHtml(a: MapAnimal) {
  const esc = (s: unknown) =>
    String(s ?? "—").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const breach = a.containment_state === "outside";
  return `
    <div class="hw-popup">
      <div class="hw-popup-tag">${esc(a.tag)}</div>
      <div class="hw-popup-name">${esc(a.name)} · ${esc(a.species)}</div>
      <dl>
        <dt>Owner</dt><dd>${esc(a.owner_name)}</dd>
        <dt>Field</dt><dd>${esc(a.parcel_name)}</dd>
        <dt>Status</dt><dd${breach ? ' class="bad"' : ""}>${breach ? `outside by ${Math.round(a.distance_m ?? 0)} m` : esc(a.containment_state ?? a.status)}</dd>
        <dt>Battery</dt><dd>${esc(a.battery_pct)}%</dd>
        <dt>Fix</dt><dd>${esc(a.last_fix_type)}</dd>
      </dl>
    </div>`;
}
