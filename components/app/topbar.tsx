"use client";

import { useEffect, useState } from "react";
import { I } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";

export function Topbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
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
    <div className="glass-heavy rounded-3xl px-5 py-4 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">
            {title}
          </h1>
          <Badge tone="veld" dot>Live</Badge>
        </div>
        {subtitle && (
          <p className="mt-0.5 text-xs text-white/55 truncate">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <label
          className={`hidden md:flex items-center gap-2 h-11 rounded-2xl px-3.5 w-80 transition-all duration-300
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

        <div className="hidden lg:flex items-center gap-2 h-11 px-3.5 rounded-2xl glass-thin">
          <I.Calendar size={16} className="text-white/55" />
          <span className="text-xs text-white/70 font-mono">{dateLabel}</span>
        </div>
      </div>
    </div>
  );
}
