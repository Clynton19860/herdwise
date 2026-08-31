import Link from "next/link";
import { I } from "@/components/ui/icon";

export const metadata = { title: "Not found — Herdwise" };

/**
 * A mistyped URL used to drop out of the platform entirely and land on Next's
 * default page. Somebody who has lost their way needs the way back, not a
 * stack-trace aesthetic.
 */
export default function NotFound() {
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="glass-solid rounded-3xl p-8 sm:p-10 max-w-md text-center">
        <span className="h-12 w-12 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] grid place-items-center text-emerald-950 mx-auto">
          <I.Cow size={24} />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          There&rsquo;s nothing at this address
        </h1>
        <p className="mt-2 text-sm text-white/60 leading-snug">
          The page may have been renamed, or the link that brought you here may be
          out of date.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="h-10 px-4 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] text-emerald-950 text-sm font-medium inline-flex items-center"
          >
            Go to the dashboard
          </Link>
          <Link
            href="/tracking"
            className="h-10 px-4 rounded-2xl glass-thin text-sm inline-flex items-center hover:bg-white/6 transition-colors"
          >
            Open the map
          </Link>
        </div>
      </div>
    </main>
  );
}
