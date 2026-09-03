import { generateAiSummary } from "@/lib/ai-server";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";

/**
 * The morning briefing, streamed rather than waited for.
 *
 * This used to be awaited inside the analytics page, before a single byte was
 * sent. The page's database work takes about two hundred milliseconds; the
 * model takes four and a half seconds — so an officer opening Analytics looked
 * at a blank screen for nearly five seconds while a summary of numbers they
 * could already have been reading was written for them.
 *
 * Nothing on the page depends on it. Rendered as its own component inside a
 * Suspense boundary, the figures and charts arrive at once and the briefing
 * fills in when it is ready.
 */
export async function Briefing({ facts }: { facts: unknown }) {
  const briefing = await generateAiSummary({
    system:
      "You are Herdwise, the AI co-pilot for the City of Harare livestock platform. " +
      "Write a tight three-sentence executive briefing for a municipal supervisor. " +
      "Lead with the single most important signal, cite specific numbers (animals tracked, " +
      "devices online, open incidents, anomalies), and end with one clear recommended next " +
      "action. No headers, no bullets, no preamble — just the briefing as prose.",
    user: JSON.stringify(facts),
    maxTokens: 350,
    effort: "low",
  });

  // The assistant being unavailable is not worth an empty card or an apology;
  // the page is complete without it.
  if (!briefing) return null;

  return (
    <BriefingShell>
      <p className="text-base sm:text-lg text-white/90 leading-relaxed text-pretty">{briefing}</p>
    </BriefingShell>
  );
}

/**
 * What sits there while the model is writing.
 *
 * Deliberately the same shape and height as the finished card, so the rest of
 * the page does not jump when the text arrives.
 */
export function BriefingPending() {
  return (
    <BriefingShell>
      <div className="space-y-2.5 animate-pulse" aria-hidden>
        <div className="h-4 rounded bg-white/10 w-[92%]" />
        <div className="h-4 rounded bg-white/10 w-[78%]" />
        <div className="h-4 rounded bg-white/10 w-[45%]" />
      </div>
      <span className="sr-only">Writing the briefing…</span>
    </BriefingShell>
  );
}

function BriefingShell({ children }: { children: React.ReactNode }) {
  return (
    <GlassCard className="p-5 sm:p-6 lg:p-7 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl animate-blob" />
      <div className="relative flex items-start gap-4">
        <div className="h-11 w-11 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] grid place-items-center text-emerald-950 shrink-0 shadow-[0_12px_32px_-10px_rgba(0,245,160,0.6)]">
          <I.Sparkle size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">
              Herdwise AI · Morning briefing
            </span>
            <Badge tone="aurora" dot>Live</Badge>
            <Badge tone="cyan">Claude Opus 5</Badge>
          </div>
          {children}
        </div>
      </div>
    </GlassCard>
  );
}
