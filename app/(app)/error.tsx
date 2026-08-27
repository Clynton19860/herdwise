"use client";

import { useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { I } from "@/components/ui/icon";

/**
 * The dashboard reads live data, so a database that is down or unconfigured is
 * a state users will actually meet. Say what went wrong and what to do about it
 * — an empty screen that looks like "no livestock registered" is worse than an
 * error, because it is quietly wrong.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[herdwise]", error);
  }, [error]);

  return (
    <GlassCard tone="heavy" className="p-8 sm:p-12 max-w-2xl mx-auto mt-10">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-2xl bg-rose-400/15 text-rose-300 grid place-items-center shrink-0">
          <I.Alert size={20} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            Couldn&rsquo;t load this page
          </h1>
          <p className="mt-2 text-sm text-white/65 leading-relaxed">
            A query failed while loading this page. Next redacts server error
            details from the browser, so the cause is in the server log — quote
            the digest below when reporting it.
          </p>
          {error.digest && (
            <p className="mt-3 text-[11px] font-mono text-white/40">digest {error.digest}</p>
          )}
          <div className="mt-6">
            <Button onClick={reset} iconLeft={<I.Activity size={14} />}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
