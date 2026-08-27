import { GlassCard } from "@/components/ui/glass-card";
import { I } from "@/components/ui/icon";

/**
 * Rendered by the layout when DATABASE_URL is unset.
 *
 * This check has to happen on the server. Next redacts server error messages
 * before they reach a client error boundary — only the digest survives — so an
 * error.tsx cannot tell "misconfigured" apart from "query failed" and would
 * show the wrong advice.
 */
export function DatabaseSetupNotice() {
  return (
    <GlassCard tone="heavy" className="p-8 sm:p-12 max-w-2xl mx-auto mt-10">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-2xl bg-amber-400/15 text-amber-300 grid place-items-center shrink-0">
          <I.Alert size={20} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">No database connected</h1>
          <p className="mt-2 text-sm text-white/65 leading-relaxed">
            Herdwise reads live telemetry from Postgres. Set{" "}
            <code className="font-mono text-xs bg-white/8 border border-white/10 rounded px-1.5 py-0.5">
              DATABASE_URL
            </code>{" "}
            and restart.
          </p>
          <pre className="mt-5 text-[11px] font-mono bg-white/5 border border-white/10 rounded-xl p-4 overflow-x-auto text-white/75 leading-relaxed">
{`createdb herdwise_dev
for f in supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -d herdwise_dev -f "$f"
done
psql -d herdwise_dev -f supabase/seed.sql

DATABASE_URL=postgres://localhost/herdwise_dev npm run dev`}
          </pre>
          <p className="mt-4 text-[11px] text-white/45">
            Full setup in <span className="font-mono">supabase/README.md</span>.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
