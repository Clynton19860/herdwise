"use client";

import { useState } from "react";
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
  const now = new Date();
  const dateLabel = now.toLocaleString("en-ZW", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="glass-heavy rounded-3xl px-4 py-3 flex items-center gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">
            {title}
          </h1>
          <Badge tone="veld" dot>
            Live
          </Badge>
        </div>
        {subtitle && (
          <p className="text-xs text-white/55 truncate">{subtitle}</p>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label className="hidden md:flex items-center gap-2 glass-thin h-10 rounded-2xl px-3 w-72">
          <I.Search size={16} className="text-white/55" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search animals, owners, tags…"
            className="bg-transparent outline-none text-sm placeholder:text-white/40 flex-1"
          />
          <kbd className="text-[10px] font-mono text-white/40 border border-white/10 rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </label>

        <button className="h-10 w-10 grid place-items-center rounded-2xl glass-thin text-white/80 hover:text-white relative">
          <I.Bell size={18} />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_currentColor]" />
        </button>

        <div className="hidden md:flex items-center gap-2 h-10 px-3 rounded-2xl glass-thin">
          <I.Calendar size={16} className="text-white/55" />
          <span className="text-xs text-white/65 font-mono">{dateLabel}</span>
        </div>
      </div>
    </div>
  );
}
