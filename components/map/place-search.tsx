"use client";

import { useEffect, useRef, useState } from "react";
import { I } from "@/components/ui/icon";

export type Place = {
  label: string;
  name: string;
  lat: number;
  lng: number;
  kind: string | null;
  bounds: { south: number; north: number; west: number; east: number } | null;
};

/**
 * Find a place by name, so a field can be drawn where it actually is.
 *
 * Marking out a paddock meant panning across Harare by hand until you
 * recognised a roof. An officer registering a farm in Hatcliffe knows the suburb
 * or the road, not the coordinates, and had no way to tell the map either.
 *
 * Typing is debounced rather than searched on every keystroke: OpenStreetMap's
 * Nominatim asks for no more than one request a second, and a search box that
 * fires on every letter would breach that within a word.
 */
export function PlaceSearch({ onPick }: { onPick: (place: Place) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    // Clearing happens in the change handler rather than here: setting state
    // synchronously inside an effect triggers a second render before the first
    // has painted, for a result the handler already knew.
    if (term.length < 3) return;

    // Cancel the previous search when another letter arrives, so a slow reply
    // cannot land after a faster one and show results for an older query.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data.error ?? "Search is unavailable."); setResults([]); return; }
        setResults(data.results ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Could not reach the server.");
      } finally {
        setBusy(false);
      }
    }, 500);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);

  // Clicking the map should dismiss the list rather than leave it floating over
  // the place you are trying to look at.
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setResults(null);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  return (
    <div ref={box} className="relative w-full max-w-xs">
      <label className="relative block">
        <span className="sr-only">Search for a place</span>
        <I.Search
          size={14}
          aria-hidden
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45 pointer-events-none"
        />
        <input
          value={q}
          onChange={(e) => {
            const v = e.target.value;
            setQ(v);
            if (v.trim().length < 3) { setResults(null); setError(null); }
          }}
          placeholder="Find a suburb, road or landmark…"
          className="w-full h-9 pl-9 pr-3 rounded-2xl glass-heavy bg-transparent outline-none
            text-xs placeholder:text-white/40 focus:ring-2 focus:ring-emerald-400/40"
        />
      </label>

      {(busy || error || results) && (
        <div className="absolute top-11 left-0 right-0 z-20 glass-heavy rounded-2xl overflow-hidden">
          {busy && <div className="px-3 py-2.5 text-[11px] text-white/55">Searching…</div>}

          {error && (
            <div className="px-3 py-2.5 text-[11px] text-rose-200 flex items-start gap-1.5">
              <I.Alert size={12} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {!busy && !error && results?.length === 0 && (
            <div className="px-3 py-2.5 text-[11px] text-white/55">
              Nothing found. Try a suburb or a road name.
            </div>
          )}

          {results?.map((r) => (
            <button
              key={`${r.lat},${r.lng}`}
              type="button"
              onClick={() => { onPick(r); setResults(null); setQ(r.name); }}
              className="w-full text-left px-3 py-2.5 hover:bg-white/8 transition-colors
                focus:outline-none focus:bg-white/8 border-t border-white/8 first:border-t-0"
            >
              <div className="text-xs truncate">{r.name}</div>
              {/* The rest of the display name is the administrative trail —
                  useful for telling two Hatcliffes apart, not for reading. */}
              <div className="text-[10px] text-white/45 truncate">{r.label}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
