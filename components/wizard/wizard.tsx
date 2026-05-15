"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

export type WizardStep = {
  id: string;
  title: string;
  description?: string;
  icon: ReactNode;
};

export function StepIndicator({
  steps,
  currentIndex,
}: {
  steps: WizardStep[];
  currentIndex: number;
}) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pretty-scroll pb-1">
      {steps.map((s, i) => {
        const state =
          i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
        return (
          <li key={s.id} className="flex items-center gap-2 shrink-0">
            <div
              className={`flex items-center gap-2.5 px-3.5 h-11 rounded-2xl transition-all duration-300
                ${state === "current"
                  ? "glass-veld text-white shadow-[0_0_28px_-12px_rgba(0,245,160,0.6)]"
                  : state === "done"
                    ? "glass-thin text-emerald-200"
                    : "glass-thin text-white/55"}`}
            >
              <span
                className={`h-7 w-7 rounded-xl grid place-items-center text-xs font-semibold transition-all duration-300
                  ${state === "current"
                    ? "bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] text-emerald-950"
                    : state === "done"
                      ? "bg-emerald-400/20 text-emerald-200"
                      : "bg-white/8 text-white/60"}`}
              >
                {state === "done" ? <I.Check size={14} /> : i + 1}
              </span>
              <span className="text-sm font-medium hidden md:inline">{s.title}</span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={`h-px w-6 md:w-8 transition-colors ${
                  state === "done" ? "bg-emerald-400/50" : "bg-white/10"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function WizardShell({
  title,
  subtitle,
  cancelHref,
  steps,
  currentIndex,
  onBack,
  onNext,
  onSubmit,
  nextDisabled,
  submitting,
  nextLabel,
  submitLabel,
  children,
}: {
  title: string;
  subtitle: string;
  cancelHref: string;
  steps: WizardStep[];
  currentIndex: number;
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  nextDisabled?: boolean;
  submitting?: boolean;
  nextLabel?: string;
  submitLabel?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const isLast = currentIndex === steps.length - 1;
  const current = steps[currentIndex];

  return (
    <>
      {/* Topbar */}
      <GlassCard tone="heavy" className="px-5 py-4 flex items-center gap-4">
        <button
          aria-label="Cancel"
          onClick={() => router.push(cancelHref)}
          className="h-10 w-10 rounded-2xl glass-thin text-white/80 hover:text-white hover:bg-white/8 grid place-items-center transition-colors"
        >
          <I.X size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">
            {title}
          </h1>
          <p className="text-xs text-white/55 truncate mt-0.5">{subtitle}</p>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
            Step {currentIndex + 1} of {steps.length}
          </div>
          <div className="text-sm font-medium">{current.title}</div>
        </div>
      </GlassCard>

      {/* Step indicator */}
      <GlassCard className="p-4">
        <StepIndicator steps={steps} currentIndex={currentIndex} />
      </GlassCard>

      {/* Content */}
      <GlassCard className="p-6 lg:p-8 relative overflow-hidden">
        <div className="flex items-start gap-3 mb-6">
          <div className="h-11 w-11 rounded-2xl glass-thin grid place-items-center text-emerald-200">
            {current.icon}
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{current.title}</h2>
            {current.description && (
              <p className="text-sm text-white/60 mt-1">{current.description}</p>
            )}
          </div>
        </div>
        <div key={current.id} className="page-enter space-y-5">
          {children}
        </div>
      </GlassCard>

      {/* Footer */}
      <GlassCard tone="heavy" className="px-5 py-4 flex items-center justify-between gap-3 sticky bottom-4 z-10">
        <div className="text-xs text-white/55 hidden md:block">
          <span className="font-mono text-white/75">{String(currentIndex + 1).padStart(2, "0")}</span>
          <span className="text-white/35"> / {String(steps.length).padStart(2, "0")}</span>
          <span className="mx-2 text-white/20">·</span>
          {current.title}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {currentIndex > 0 && onBack && (
            <Button
              variant="glass"
              onClick={onBack}
              disabled={submitting}
              iconLeft={<I.ArrowRight size={14} className="rotate-180" />}
            >
              Back
            </Button>
          )}
          {!isLast && onNext && (
            <Button
              onClick={onNext}
              disabled={nextDisabled}
              iconRight={<I.ArrowRight size={14} />}
            >
              {nextLabel ?? "Continue"}
            </Button>
          )}
          {isLast && onSubmit && (
            <Button
              onClick={onSubmit}
              disabled={submitting || nextDisabled}
              iconRight={submitting ? undefined : <I.Check size={16} />}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Submitting…
                </span>
              ) : (
                submitLabel ?? "Submit"
              )}
            </Button>
          )}
        </div>
      </GlassCard>
    </>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 rounded-full border-2 border-emerald-900/30 border-t-emerald-900 animate-spin-slow" />
  );
}
