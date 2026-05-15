"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { LinkButton } from "@/components/ui/button";
import { I } from "@/components/ui/icon";

export function SuccessScreen({
  title,
  subtitle,
  ref,
  primary,
  secondary,
  details,
}: {
  title: string;
  subtitle: string;
  ref: string;
  primary: { href: string; label: string; icon?: ReactNode };
  secondary?: { href: string; label: string };
  details?: { label: string; value: string }[];
}) {
  return (
    <GlassCard tone="heavy" className="p-10 lg:p-14 relative overflow-hidden">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-80 w-[120%] rounded-full bg-emerald-400/30 blur-3xl animate-glow" />
      <div className="absolute -bottom-32 left-1/4 h-80 w-72 rounded-full bg-cyan-400/20 blur-3xl animate-blob" />

      <div className="relative text-center max-w-2xl mx-auto">
        {/* Check icon with rings */}
        <div className="mx-auto relative h-24 w-24 mb-7">
          <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-pulse-ring" />
          <span className="absolute inset-2 rounded-full bg-emerald-400/20 animate-pulse-ring" style={{ animationDelay: "0.4s" }} />
          <div className="relative h-24 w-24 rounded-full bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] grid place-items-center shadow-[0_0_64px_-8px_rgba(0,245,160,0.6)]">
            <I.Check size={42} className="text-emerald-950" strokeWidth={2.4} />
          </div>
        </div>

        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-balance">
          {title}
        </h2>
        <p className="mt-3 text-white/65 text-lg text-pretty max-w-lg mx-auto">
          {subtitle}
        </p>

        <div className="mt-6 inline-flex items-center gap-2 chip">
          <span className="font-mono text-emerald-200">{ref}</span>
          <span className="text-white/40">·</span>
          <span>Saved to ledger</span>
        </div>

        {details && (
          <dl className="mt-8 grid sm:grid-cols-3 gap-3 max-w-xl mx-auto">
            {details.map((d) => (
              <div key={d.label} className="glass-thin rounded-2xl p-4 text-left">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-white/45">
                  {d.label}
                </dt>
                <dd className="mt-1 text-sm font-medium truncate">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <LinkButton href={primary.href} size="lg" iconRight={primary.icon ?? <I.ArrowRight />}>
            {primary.label}
          </LinkButton>
          {secondary && (
            <LinkButton href={secondary.href} size="lg" variant="glass">
              {secondary.label}
            </LinkButton>
          )}
        </div>

        <div className="mt-7 text-xs text-white/40 flex items-center justify-center gap-2">
          <I.Shield size={12} className="text-emerald-300" />
          End-to-end encrypted · audit ledger entry written
          <Link href="/dashboard" className="ml-3 underline-offset-2 hover:underline">
            Go to dashboard
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
