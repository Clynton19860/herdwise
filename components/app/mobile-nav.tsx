"use client";

import Link from "next/link";
import type { Operator } from "@/lib/db";
import { operatorLabel } from "@/components/app/operator";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const MobileNavCtx = createContext<Ctx | null>(null);

export function MobileNavProvider({ children, operator }: { children: ReactNode; operator?: Operator | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change — deferred so setState fires from an external callback
  useEffect(() => {
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  // Lock body scroll while open
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open]);

  return (
    <MobileNavCtx.Provider value={{ open, setOpen }}>
      {children}
      <MobileDrawer operator={operator} />
    </MobileNavCtx.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavCtx);
  if (!ctx) {
    return { open: false, setOpen: () => {} };
  }
  return ctx;
}

/* ---------- Hamburger trigger (used by topbar) ---------- */

export function MobileNavTrigger() {
  const { open, setOpen } = useMobileNav();
  return (
    <button
      aria-label={open ? "Close menu" : "Open menu"}
      onClick={() => setOpen(!open)}
      className="lg:hidden h-11 w-11 grid place-items-center rounded-2xl glass-thin text-white/85 hover:text-white hover:bg-white/8 transition-colors shrink-0"
    >
      {open ? <I.X size={20} /> : <I.Menu size={20} />}
    </button>
  );
}

/* ---------- Drawer ---------- */

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

function MobileDrawer({ operator }: { operator?: Operator | null }) {
  const who = operatorLabel(operator);
  const { open, setOpen } = useMobileNav();
  const pathname = usePathname() || "";
  const router = useRouter();

  const close = useCallback(() => setOpen(false), [setOpen]);

  const signOut = () => {
    try {
      window.localStorage.removeItem("herdwise.sidebar.collapsed");
    } catch {
      // ignore
    }
    close();
    router.push("/");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        aria-hidden
        className={`lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300
          ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`lg:hidden fixed top-3 bottom-3 left-3 z-50 w-[300px] max-w-[88vw]
          transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${open ? "translate-x-0" : "-translate-x-[calc(100%+1rem)]"}`}
      >
        <div className="glass-heavy rounded-3xl h-full p-4 flex flex-col">
          <div className="flex items-center justify-between px-1.5 pt-1 pb-3">
            <Logo />
            <button
              onClick={close}
              aria-label="Close menu"
              className="h-9 w-9 grid place-items-center rounded-xl text-white/65 hover:text-white hover:bg-white/8 transition-colors"
            >
              <I.X size={18} />
            </button>
          </div>

          <div className="px-2 pb-1">
            <Badge tone="aurora" dot>{operator?.ward ? `${operator.ward} · Pilot` : "Pilot"}</Badge>
          </div>

          <nav className="mt-5 flex-1 overflow-y-auto pretty-scroll -mr-1 pr-1">
            <div className="px-3 text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2.5">
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
                      onClick={close}
                      className={`group relative flex items-center gap-3 px-2.5 h-12 rounded-2xl text-sm transition-all duration-300
                        ${active
                          ? "glass text-white"
                          : "text-white/70 hover:bg-white/6 hover:text-white"}`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-300
                          ${active
                            ? "h-7 bg-[linear-gradient(180deg,#00f5a0,#5be7ff)] shadow-[0_0_12px_#00f5a0]"
                            : "h-0 bg-transparent"}`}
                      />
                      <span
                        className={`flex items-center justify-center h-9 w-9 rounded-xl shrink-0 transition-all duration-300
                          ${active
                            ? "bg-[linear-gradient(135deg,rgba(0,245,160,0.28),rgba(91,231,255,0.18))] text-emerald-200"
                            : "bg-white/5 text-white/75"}`}
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

            <div className="px-3 mt-6 text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2.5">
              Account
            </div>
            <ul className="space-y-1">
              {secondary.map((it) => {
                const active = pathname.startsWith(it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={close}
                      className={`relative flex items-center gap-3 px-2.5 h-12 rounded-2xl text-sm transition-all duration-300
                        ${active ? "glass text-white" : "text-white/70 hover:bg-white/6 hover:text-white"}`}
                    >
                      <span className="flex items-center justify-center h-9 w-9 rounded-xl bg-white/5">
                        {it.icon}
                      </span>
                      <span className="font-medium">{it.label}</span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-3 px-2.5 h-12 rounded-2xl text-sm transition-all duration-300 text-white/70 hover:bg-rose-400/10 hover:text-rose-200"
                >
                  <span className="flex items-center justify-center h-9 w-9 rounded-xl bg-white/5 text-white/75">
                    <I.Logout size={18} />
                  </span>
                  <span className="font-medium text-left flex-1">Sign out</span>
                </button>
              </li>
            </ul>
          </nav>

          {/* User card */}
          <div className="mt-3 glass-thin rounded-2xl p-3 flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] text-emerald-950 font-semibold flex items-center justify-center">
              {who.initials}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#0a1612]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium leading-tight truncate">{who.name}</div>
              <div className="text-xs text-white/50 leading-tight truncate">{who.sub}</div>
            </div>
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="h-9 w-9 grid place-items-center rounded-xl text-white/55 hover:text-rose-300 hover:bg-rose-400/10 transition-colors"
            >
              <I.Logout size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
