import Link from "next/link";
import { redirect } from "next/navigation";
import { currentPrincipal } from "@/lib/principal";
import { I } from "@/components/ui/icon";
import { OwnerSignOut } from "@/components/owner/sign-out";

export const dynamic = "force-dynamic";

/**
 * The farm owner's surface.
 *
 * Deliberately not the officer interface with things hidden. A farmer reaching
 * an officer page must be turned away rather than shown a filtered version of
 * it — a filter that has to be remembered on twenty queries will be forgotten on
 * one, and the failure is silent and somebody else's private data.
 *
 * Staff are redirected out for the same reason in reverse: this shell resolves
 * one owner's herd, and there is no owner for a member of staff to be.
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const principal = await currentPrincipal();
  if (!principal) redirect("/login?next=/my");
  if (principal.kind !== "owner") redirect("/dashboard");

  const initials = principal.name
    .split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 px-3 sm:px-5 pt-3 sm:pt-5">
        <div className="glass-heavy rounded-3xl px-4 sm:px-5 py-3.5 flex items-center gap-3">
          <span className="h-10 w-10 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] grid place-items-center text-emerald-950 shrink-0">
            <I.Cow size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold tracking-tight truncate">
              Herd<span className="text-emerald-300">wise</span>
            </div>
            <div className="text-xs text-white/50 truncate">
              {principal.name}{principal.ward ? ` · ${principal.ward}` : ""}
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1.5">
            <Link href="/my" className="h-9 px-3.5 rounded-2xl text-sm text-white/70 hover:text-white hover:bg-white/6 transition-colors">
              My herd
            </Link>
            <Link href="/my/profile" className="h-9 px-3.5 rounded-2xl text-sm text-white/70 hover:text-white hover:bg-white/6 transition-colors">
              My details
            </Link>
          </nav>

          <span className="h-9 w-9 rounded-xl bg-white/10 grid place-items-center text-xs font-semibold shrink-0">
            {initials}
          </span>
          <OwnerSignOut />
        </div>
      </header>

      <main className="page-enter px-3 sm:px-5 py-4 sm:py-5 space-y-4 sm:space-y-5 pb-16">
        {children}
      </main>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 glass-heavy border-t border-white/8 flex">
        <Link href="/my" className="flex-1 py-3 text-center text-sm text-white/75">My herd</Link>
        <Link href="/my/profile" className="flex-1 py-3 text-center text-sm text-white/75">My details</Link>
      </nav>
    </div>
  );
}
