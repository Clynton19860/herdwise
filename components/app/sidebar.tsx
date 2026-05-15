"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";

const items = [
  { href: "/dashboard",  label: "Overview",   icon: <I.Dashboard size={18} /> },
  { href: "/tracking",   label: "Live map",   icon: <I.Map size={18} />, badge: "Live" },
  { href: "/livestock",  label: "Livestock",  icon: <I.Cow size={18} /> },
  { href: "/owners",     label: "Owners",     icon: <I.Users size={18} /> },
  { href: "/geofences",  label: "Geofences",  icon: <I.Layers size={18} /> },
  { href: "/incidents",  label: "Incidents",  icon: <I.Alert size={18} />, badgeTone: "coral" as const, badge: "14" },
  { href: "/health",     label: "Health",     icon: <I.Stethoscope size={18} /> },
  { href: "/analytics",  label: "Analytics",  icon: <I.Activity size={18} /> },
];

const secondary = [
  { href: "/settings", label: "Settings", icon: <I.Settings size={18} /> },
];

export function Sidebar() {
  const pathname = usePathname() || "";

  return (
    <aside className="hidden lg:flex w-72 shrink-0 sticky top-5 self-start h-[calc(100dvh-2.5rem)]">
      <div className="glass-heavy rounded-3xl w-full p-5 flex flex-col">
        {/* Brand */}
        <div className="px-2 pt-1 pb-3 flex items-center justify-between">
          <Logo />
          <button
            aria-label="Collapse"
            className="h-8 w-8 grid place-items-center rounded-xl text-white/55 hover:text-white hover:bg-white/6 transition-colors"
          >
            <I.Chevron size={14} className="rotate-180" />
          </button>
        </div>

        <div className="px-2 pb-1">
          <Badge tone="aurora" dot>City of Harare · Pilot</Badge>
        </div>

        {/* Navigation */}
        <nav className="mt-6 flex-1 overflow-y-auto pretty-scroll -mr-2 pr-2">
          <div className="px-3 text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2.5">
            Operations
          </div>
          <ul className="nav-stagger space-y-1">
            {items.map((it) => {
              const active =
                pathname === it.href ||
                (it.href !== "/dashboard" && pathname.startsWith(it.href));
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`group relative flex items-center gap-3 px-2.5 h-11 rounded-2xl text-sm transition-all duration-300
                      ${active
                        ? "glass text-white"
                        : "text-white/65 hover:bg-white/6 hover:text-white"}`}
                  >
                    {/* Active indicator bar */}
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-300
                        ${active
                          ? "h-6 bg-[linear-gradient(180deg,#00f5a0,#5be7ff)] shadow-[0_0_12px_#00f5a0]"
                          : "h-0 bg-transparent"}`}
                    />
                    <span
                      className={`flex items-center justify-center h-8 w-8 rounded-xl transition-all duration-300
                        ${active
                          ? "bg-[linear-gradient(135deg,rgba(0,245,160,0.28),rgba(91,231,255,0.18))] text-emerald-200 shadow-[0_0_24px_-6px_rgba(0,245,160,0.6)]"
                          : "bg-white/5 text-white/70 group-hover:text-white group-hover:bg-white/8"}`}
                    >
                      {it.icon}
                    </span>
                    <span className="flex-1 font-medium">{it.label}</span>
                    {it.badge && (
                      <Badge tone={it.badgeTone ?? "veld"} dot={it.badge === "Live"}>
                        {it.badge}
                      </Badge>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="px-3 mt-7 text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2.5">
            Account
          </div>
          <ul className="space-y-1">
            {secondary.map((it) => {
              const active = pathname.startsWith(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`group relative flex items-center gap-3 px-2.5 h-11 rounded-2xl text-sm transition-all duration-300
                      ${active ? "glass text-white" : "text-white/65 hover:bg-white/6 hover:text-white"}`}
                  >
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-300
                        ${active ? "h-6 bg-[linear-gradient(180deg,#00f5a0,#5be7ff)] shadow-[0_0_12px_#00f5a0]" : "h-0 bg-transparent"}`}
                    />
                    <span
                      className={`flex items-center justify-center h-8 w-8 rounded-xl transition-all duration-300
                        ${active
                          ? "bg-[linear-gradient(135deg,rgba(0,245,160,0.28),rgba(91,231,255,0.18))] text-emerald-200"
                          : "bg-white/5 text-white/70 group-hover:bg-white/8 group-hover:text-white"}`}
                    >
                      {it.icon}
                    </span>
                    <span className="font-medium">{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer user card */}
        <div className="mt-5 glass-thin rounded-2xl p-3 flex items-center gap-3 transition-colors hover:bg-white/4">
          <div className="relative h-10 w-10 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] text-emerald-950 font-semibold flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(0,245,160,0.6)]">
            TM
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#0a1612] shadow-[0_0_8px_currentColor]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium leading-tight truncate">Insp. Tatenda M.</div>
            <div className="text-xs text-white/50 leading-tight truncate">
              Ward 7 · Field Officer
            </div>
          </div>
          <button
            aria-label="Sign out"
            className="h-9 w-9 grid place-items-center rounded-xl text-white/55 hover:text-white hover:bg-white/8 transition-colors"
          >
            <I.Logout size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
