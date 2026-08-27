"use client";

import Link from "next/link";
import type { Operator } from "@/lib/db";
import { operatorLabel } from "@/components/app/operator";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  badgeTone?: "veld" | "coral" | "amber" | "violet" | "cyan" | "aurora";
};

const items: NavItem[] = [
  { href: "/dashboard",  label: "Overview",   icon: <I.Dashboard size={18} /> },
  { href: "/tracking",   label: "Live map",   icon: <I.Map size={18} />, badge: "Live" },
  { href: "/livestock",  label: "Livestock",  icon: <I.Cow size={18} /> },
  { href: "/owners",     label: "Owners",     icon: <I.Users size={18} /> },
  { href: "/geofences",  label: "Geofences",  icon: <I.Layers size={18} /> },
  { href: "/incidents",  label: "Incidents",  icon: <I.Alert size={18} /> },
  { href: "/health",     label: "Health",     icon: <I.Stethoscope size={18} /> },
  { href: "/analytics",  label: "Analytics",  icon: <I.Activity size={18} /> },
];

const secondary: NavItem[] = [
  { href: "/settings", label: "Settings", icon: <I.Settings size={18} /> },
];

const STORAGE_KEY = "herdwise.sidebar.collapsed";

export function Sidebar({ operator }: { operator?: Operator | null }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the collapsed preference from localStorage (deferred to satisfy lint rule)
  useEffect(() => {
    const seed = setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "1") setCollapsed(true);
      } catch {
        // ignore
      }
      setHydrated(true);
    }, 0);
    return () => clearTimeout(seed);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed, hydrated]);

  const handleSignOut = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    router.push("/");
  };

  const width = collapsed ? "w-[88px]" : "w-72";

  return (
    <aside
      className={`hidden lg:flex shrink-0 sticky top-5 self-start h-[calc(100dvh-2.5rem)] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${width}`}
      data-collapsed={collapsed ? "1" : "0"}
    >
      <div className="glass-heavy rounded-3xl w-full p-3 lg:p-4 flex flex-col">
        {/* Brand row */}
        <div className={`flex items-center ${collapsed ? "flex-col gap-3" : "justify-between"} px-1.5 pt-1 pb-3`}>
          {collapsed ? (
            <Logo size="sm" showWordmark={false} />
          ) : (
            <Logo />
          )}
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((v) => !v)}
            className="h-8 w-8 grid place-items-center rounded-xl text-white/65 hover:text-white hover:bg-white/8 transition-colors"
          >
            <I.Chevron
              size={14}
              className={`transition-transform duration-500 ${collapsed ? "rotate-0" : "rotate-180"}`}
            />
          </button>
        </div>

        {!collapsed && (
          <div className="px-2 pb-1 animate-[fade-in_0.4s_ease-out]">
            <Badge tone="aurora" dot>{operator?.ward ? `${operator.ward} · Pilot` : "Pilot"}</Badge>
          </div>
        )}

        {/* Navigation */}
        <nav className="mt-5 flex-1 overflow-y-auto pretty-scroll -mr-1 pr-1">
          {!collapsed && (
            <div className="px-3 text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2.5">
              Operations
            </div>
          )}
          <ul className="nav-stagger space-y-1">
            {items.map((it) => (
              <SidebarItem
                key={it.href}
                item={it}
                active={
                  pathname === it.href ||
                  (it.href !== "/dashboard" && pathname.startsWith(it.href))
                }
                collapsed={collapsed}
              />
            ))}
          </ul>

          {!collapsed && (
            <div className="px-3 mt-6 text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2.5">
              Account
            </div>
          )}
          {collapsed && <div className="my-5 h-px bg-white/8" />}
          <ul className="space-y-1">
            {secondary.map((it) => (
              <SidebarItem
                key={it.href}
                item={it}
                active={pathname.startsWith(it.href)}
                collapsed={collapsed}
              />
            ))}
            <SignOutItem onClick={handleSignOut} collapsed={collapsed} />
          </ul>
        </nav>

        {/* Footer user card */}
        <UserCard collapsed={collapsed} onSignOut={handleSignOut} operator={operator} />
      </div>
    </aside>
  );
}

/* ---------- SidebarItem with tooltip ---------- */

function SidebarItem({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <li className="relative group">
      <Link
        href={item.href}
        className={`relative flex items-center gap-3 h-11 rounded-2xl text-sm transition-all duration-300
          ${collapsed ? "px-1.5 justify-center" : "px-2.5"}
          ${active
            ? "glass text-white"
            : "text-white/65 hover:bg-white/6 hover:text-white"}`}
      >
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-300
            ${active
              ? "h-6 bg-[linear-gradient(180deg,#00f5a0,#5be7ff)] shadow-[0_0_12px_#00f5a0]"
              : "h-0 bg-transparent"}`}
        />
        <span
          className={`flex items-center justify-center h-8 w-8 rounded-xl shrink-0 transition-all duration-300
            ${active
              ? "bg-[linear-gradient(135deg,rgba(0,245,160,0.28),rgba(91,231,255,0.18))] text-emerald-200 shadow-[0_0_24px_-6px_rgba(0,245,160,0.6)]"
              : "bg-white/5 text-white/70 group-hover:text-white group-hover:bg-white/8"}`}
        >
          {item.icon}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 font-medium truncate">{item.label}</span>
            {item.badge && (
              <Badge tone={item.badgeTone ?? "veld"} dot={item.badge === "Live"}>
                {item.badge}
              </Badge>
            )}
          </>
        )}
        {collapsed && item.badge && (
          <span
            className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]
              ${item.badgeTone === "coral"
                ? "bg-rose-400"
                : item.badgeTone === "amber"
                  ? "bg-amber-300"
                  : "bg-emerald-300"}`}
          />
        )}
      </Link>

      {/* Tooltip — only when collapsed */}
      {collapsed && (
        <Tooltip label={item.label} badge={item.badge} />
      )}
    </li>
  );
}

function SignOutItem({
  onClick,
  collapsed,
}: {
  onClick: () => void;
  collapsed: boolean;
}) {
  return (
    <li className="relative group">
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 h-11 rounded-2xl text-sm transition-all duration-300 text-white/65 hover:bg-rose-400/10 hover:text-rose-200
          ${collapsed ? "px-1.5 justify-center" : "px-2.5"}`}
      >
        <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-white/5 text-white/70 group-hover:bg-rose-400/15 group-hover:text-rose-200 transition-colors shrink-0">
          <I.Logout size={18} />
        </span>
        {!collapsed && <span className="flex-1 text-left font-medium">Sign out</span>}
      </button>
      {collapsed && <Tooltip label="Sign out" />}
    </li>
  );
}

function Tooltip({ label, badge }: { label: string; badge?: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap
        opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
        focus-within:opacity-100 focus-within:translate-x-0
        transition-all duration-200 ease-out
        glass-heavy rounded-xl px-3 py-1.5 text-xs font-medium text-white
        shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]"
    >
      <span className="flex items-center gap-2">
        {label}
        {badge && (
          <span className="text-[10px] text-emerald-200 font-mono">{badge}</span>
        )}
      </span>
      {/* Arrow */}
      <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 h-2 w-2 rotate-45 bg-[#0a1612] border-l border-b border-white/15" />
    </span>
  );
}

function UserCard({
  collapsed,
  onSignOut,
  operator,
}: {
  collapsed: boolean;
  onSignOut: () => void;
  operator?: Operator | null;
}) {
  const who = operatorLabel(operator);
  if (collapsed) {
    return (
      <div className="mt-4 grid place-items-center group relative">
        <button
          className="relative h-11 w-11 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] text-emerald-950 font-semibold grid place-items-center shadow-[0_8px_24px_-8px_rgba(0,245,160,0.6)]"
          onClick={onSignOut}
          aria-label="Signed in — click to sign out"
        >
          {who.initials}
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#0a1612] shadow-[0_0_8px_currentColor]" />
        </button>
        <Tooltip label={`${who.name} — sign out`} />
      </div>
    );
  }
  return (
    <div className="mt-4 glass-thin rounded-2xl p-3 flex items-center gap-3 transition-colors hover:bg-white/4">
      <div className="relative h-10 w-10 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] text-emerald-950 font-semibold flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(0,245,160,0.6)]">
        {who.initials}
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#0a1612] shadow-[0_0_8px_currentColor]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-tight truncate">{who.name}</div>
        <div className="text-xs text-white/50 leading-tight truncate">{who.sub}</div>
      </div>
      <button
        onClick={onSignOut}
        aria-label="Sign out"
        className="h-9 w-9 grid place-items-center rounded-xl text-white/55 hover:text-rose-300 hover:bg-rose-400/10 transition-colors"
      >
        <I.Logout size={16} />
      </button>
    </div>
  );
}
