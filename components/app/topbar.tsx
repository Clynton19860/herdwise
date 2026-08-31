"use client";

import { useEffect, useState } from "react";
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
  const [focused, setFocused] = useState(false);
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
        <label
          className={`hidden md:flex items-center gap-2 h-11 rounded-2xl px-3.5 w-60 lg:w-80 transition-all duration-300
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

        {/* Mobile search button */}
        <button
          aria-label="Search"
          onClick={() => setSearchOpen(true)}
          className="md:hidden h-11 w-11 grid place-items-center rounded-2xl glass-thin text-white/80 hover:text-white hover:bg-white/8 transition-colors"
        >
          <I.Search size={18} />
        </button>

        <button
          aria-label="Notifications"
          className="h-11 w-11 grid place-items-center rounded-2xl glass-thin text-white/80 hover:text-white hover:bg-white/8 transition-colors relative"
        >
          <I.Bell size={18} />
          <span className="absolute top-2.5 right-2.5 inline-flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-rose-400 opacity-70 animate-pulse-ring" />
            <span className="relative h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_currentColor]" />
          </span>
        </button>

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
          </div>
        </div>
      )}
    </div>
  );
}
