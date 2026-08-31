"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SearchHit } from "@/lib/db";
import { I } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { MobileNavTrigger } from "@/components/app/mobile-nav";

export function Topbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const [q, setQ] = useState("");
  /**
   * The field used to collect keystrokes and do nothing with them.
   *
   * Only the completed result is held in state, and "searching" is derived from
   * whether that result matches what is currently typed. Storing a loading flag
   * would mean setting state synchronously inside the effect, which causes a
   * cascading render — and this way a stale response can never be shown, because
   * it simply does not match the current term.
   */
  const [result, setResult] = useState<{ term: string; hits: SearchHit[] }>({ term: "", hits: [] });
  const term = q.trim();
  const hits = result.term === term ? result.hits : [];
  const searching = term.length >= 2 && result.term !== term;

  useEffect(() => {
    if (term.length < 2) return;
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: SearchHit[]) => setResult({ term, hits: rows }))
        .catch(() => setResult({ term, hits: [] }));
    }, 220);
    return () => clearTimeout(t);
  }, [term]);
  const [focused, setFocused] = useState(false);

  /**
   * Real alerts behind the bell.
   *
   * The dot used to pulse permanently whether or not anything had happened,
   * which is worse than showing nothing: an indicator that is always on trains
   * people to ignore it on the day it matters.
   */
  const [alerts, setAlerts] = useState<{ tone: string; text: string; href: string }[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/alerts")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { if (live) setAlerts(d.items ?? []); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const seed = setTimeout(update, 0);
    const tick = setInterval(update, 60_000);
    return () => {
      clearTimeout(seed);
      clearInterval(tick);
    };
  }, []);

  const dateLabel = now
    ? now.toLocaleString("en-ZW", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="glass-heavy rounded-3xl px-3 sm:px-4 lg:px-5 py-3 sm:py-4 flex items-center gap-2.5 sm:gap-3 lg:gap-4">
      <MobileNavTrigger />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <h1 className="text-base sm:text-xl md:text-2xl font-semibold tracking-tight truncate">
            {title}
          </h1>
          <Badge tone="veld" dot>Live</Badge>
        </div>
        {subtitle && (
          <p className="mt-0.5 text-[11px] sm:text-xs text-white/55 truncate">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Desktop search */}
        <div className="hidden md:block relative">
        <label
          className={`flex items-center gap-2 h-11 rounded-2xl px-3.5 w-60 lg:w-80 transition-all duration-300
            ${focused
              ? "glass ring-2 ring-emerald-400/40 shadow-[0_0_32px_-12px_rgba(0,245,160,0.6)]"
              : "glass-thin hover:bg-white/6"}`}
        >
          <I.Search size={16} className={focused ? "text-emerald-300" : "text-white/55"} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search animals, owners, tags…"
            className="bg-transparent outline-none text-sm placeholder:text-white/40 flex-1 min-w-0"
          />
          <kbd className="text-[10px] font-mono text-white/45 border border-white/10 rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </label>
        {q.trim().length >= 2 && (
          <div className="absolute right-0 mt-2 w-[26rem] z-50">
            <Results hits={hits} searching={searching} q={q} onPick={() => setQ("")} />
          </div>
        )}
        </div>

        {/* Mobile search button */}
        <button
          aria-label="Search"
          onClick={() => setSearchOpen(true)}
          className="md:hidden h-11 w-11 grid place-items-center rounded-2xl glass-thin text-white/80 hover:text-white hover:bg-white/8 transition-colors"
        >
          <I.Search size={18} />
        </button>

        <div className="relative">
          <button
            aria-label={
              alerts.length
                ? `Notifications — ${alerts.length} needing attention`
                : "Notifications — nothing needs attention"
            }
            aria-expanded={alertsOpen}
            onClick={() => setAlertsOpen((v) => !v)}
            className="h-11 w-11 grid place-items-center rounded-2xl glass-thin text-white/80 hover:text-white hover:bg-white/8 transition-colors relative"
          >
            <I.Bell size={18} />
            {alerts.length > 0 && (
              <span className="absolute top-2.5 right-2.5 inline-flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-rose-400 opacity-70 animate-pulse-ring" />
                <span className="relative h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_currentColor]" />
              </span>
            )}
          </button>
          {alertsOpen && (
            <>
              <button
                aria-label="Close notifications"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setAlertsOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-80 z-50 glass-solid rounded-2xl overflow-hidden">
                {alerts.length === 0 ? (
                  <div className="px-4 py-5 text-center">
                    <I.Check size={20} className="mx-auto text-emerald-300" />
                    <div className="mt-2 text-sm">Nothing needs attention</div>
                  </div>
                ) : (
                  alerts.map((a) => (
                    <Link
                      key={a.href + a.text}
                      href={a.href}
                      onClick={() => setAlertsOpen(false)}
                      className="flex items-start gap-2.5 px-4 py-3 hover:bg-white/6 transition-colors border-b border-white/5 last:border-b-0"
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                          a.tone === "coral" ? "bg-rose-400" : "bg-amber-300"
                        }`}
                        aria-hidden
                      />
                      <span className="text-sm text-white/85 leading-snug">{a.text}</span>
                    </Link>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="hidden xl:flex items-center gap-2 h-11 px-3.5 rounded-2xl glass-thin">
          <I.Calendar size={16} className="text-white/55" />
          <span className="text-xs text-white/70 font-mono">{dateLabel}</span>
        </div>
      </div>

      {/* Mobile search overlay */}
      {searchOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-start justify-center p-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="glass-heavy rounded-3xl w-full max-w-xl mt-16 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="flex items-center gap-2 h-12 rounded-2xl px-3.5 glass-thin focus-within:bg-white/8 focus-within:ring-2 focus-within:ring-emerald-400/40">
              <I.Search size={18} className="text-emerald-300" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search animals, owners, tags…"
                className="bg-transparent outline-none text-base placeholder:text-white/40 flex-1 min-w-0"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="h-8 w-8 grid place-items-center rounded-xl text-white/60 hover:text-white hover:bg-white/8 transition-colors"
              >
                <I.X size={16} />
              </button>
            </label>
            {q.trim().length >= 2 && (
              <div className="mt-2">
                <Results
                  hits={hits}
                  searching={searching}
                  q={q}
                  onPick={() => { setQ(""); setSearchOpen(false); }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Results({
  hits,
  searching,
  q,
  onPick,
}: {
  hits: SearchHit[];
  searching: boolean;
  q: string;
  onPick: () => void;
}) {
  if (q.trim().length < 2) return null;
  return (
    <div className="glass-solid rounded-2xl overflow-hidden max-h-80 overflow-y-auto pretty-scroll">
      {searching && hits.length === 0 && (
        <div className="px-4 py-3 text-sm text-white/55">Searching…</div>
      )}
      {!searching && hits.length === 0 && (
        <div className="px-4 py-3 text-sm text-white/55">
          Nothing matches &ldquo;{q.trim()}&rdquo;.
        </div>
      )}
      {hits.map((h) => (
        <Link
          key={`${h.type}-${h.href}-${h.label}`}
          href={h.href}
          onClick={onPick}
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/6 transition-colors border-b border-white/5 last:border-b-0"
        >
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/40 w-16 shrink-0">
            {h.type}
          </span>
          <span className="text-sm flex-1 min-w-0 truncate">{h.label}</span>
          {h.sub && <span className="text-xs text-white/45 truncate max-w-[40%]">{h.sub}</span>}
        </Link>
      ))}
    </div>
  );
}
