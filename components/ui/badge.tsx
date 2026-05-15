import type { ReactNode } from "react";

type Tone =
  | "neutral"
  | "veld"
  | "amber"
  | "coral"
  | "violet"
  | "cyan"
  | "aurora";

const tones: Record<Tone, string> = {
  neutral: "bg-white/8 text-white/85 border-white/15",
  veld:    "bg-emerald-400/15 text-emerald-200 border-emerald-300/30",
  amber:   "bg-amber-400/15 text-amber-200 border-amber-300/30",
  coral:   "bg-rose-400/15 text-rose-200 border-rose-300/30",
  violet:  "bg-violet-400/15 text-violet-200 border-violet-300/30",
  cyan:    "bg-cyan-400/15 text-cyan-200 border-cyan-300/30",
  aurora:  "bg-[linear-gradient(135deg,rgba(0,245,160,0.18),rgba(91,231,255,0.18))] text-[#c8ffe9] border-[rgba(0,245,160,0.35)]",
};

type Props = {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  dot?: boolean;
};

export function Badge({ tone = "neutral", className = "", children, dot }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-md ${tones[tone]} ${className}`}
    >
      {dot && (
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            tone === "veld"
              ? "bg-emerald-400"
              : tone === "amber"
                ? "bg-amber-400"
                : tone === "coral"
                  ? "bg-rose-400"
                  : tone === "violet"
                    ? "bg-violet-400"
                    : tone === "cyan"
                      ? "bg-cyan-400"
                      : tone === "aurora"
                        ? "bg-emerald-300"
                        : "bg-white"
          }`}
        >
          <span className="absolute inset-0 rounded-full bg-current opacity-60 animate-pulse-ring" />
        </span>
      )}
      {children}
    </span>
  );
}
