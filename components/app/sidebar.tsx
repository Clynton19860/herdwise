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
    <aside className="hidden lg:flex w-72 shrink-0 sticky top-4 self-start h-[calc(100dvh-2rem)] ml-4 my-4">
      <div className="glass-heavy rounded-3xl w-full p-4 flex flex-col">
        <div className="px-2 py-2">
          <Logo />
        </div>

        <div className="mt-4 px-2">
          <Badge tone="aurora" dot>City of Harare · Pilot</Badge>
        </div>

        <nav className="mt-6 flex-1 overflow-y-auto pretty-scroll pr-1">
          <div className="px-2 text-[11px] uppercase tracking-wider text-white/40 mb-2">
            Operations
          </div>
          <ul className="space-y-1">
            {items.map((it) => {
              const active =
                pathname === it.href ||
                (it.href !== "/dashboard" && pathname.startsWith(it.href));
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`group flex items-center gap-3 px-3 h-10 rounded-2xl text-sm transition-all
                      ${active
                        ? "glass text-white"
                        : "text-white/70 hover:bg-white/6 hover:text-white"}`}
                  >
                    <span
                      className={`flex items-center justify-center h-8 w-8 rounded-xl
                        ${active
                          ? "bg-[linear-gradient(135deg,rgba(0,245,160,0.25),rgba(91,231,255,0.15))] text-emerald-200 shadow-[0_0_24px_-6px_rgba(0,245,160,0.6)]"
                          : "bg-white/5 text-white/70 group-hover:text-white"}`}
                    >
                      {it.icon}
                    </span>
                    <span className="flex-1">{it.label}</span>
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

          <div className="px-2 mt-6 text-[11px] uppercase tracking-wider text-white/40 mb-2">
            Account
          </div>
          <ul className="space-y-1">
            {secondary.map((it) => {
              const active = pathname.startsWith(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`group flex items-center gap-3 px-3 h-10 rounded-2xl text-sm transition-all
                      ${active ? "glass text-white" : "text-white/70 hover:bg-white/6 hover:text-white"}`}
                  >
                    <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-white/5">
                      {it.icon}
                    </span>
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer user card */}
        <div className="mt-4 glass-thin rounded-2xl p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] text-emerald-950 font-semibold flex items-center justify-center">
            TM
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium leading-tight truncate">Insp. Tatenda M.</div>
            <div className="text-xs text-white/50 leading-tight truncate">
              Ward 7 · Field Officer
            </div>
          </div>
          <button
            aria-label="Sign out"
            className="ml-auto h-9 w-9 grid place-items-center rounded-xl text-white/60 hover:text-white hover:bg-white/5"
          >
            <I.Logout size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
