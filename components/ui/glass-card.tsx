import type { ReactNode } from "react";

type Tone = "neutral" | "veld" | "thin" | "heavy";

const tones: Record<Tone, string> = {
  neutral: "glass",
  thin: "glass-thin",
  heavy: "glass-heavy",
  veld: "glass-veld",
};

type Props = {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
};

export function GlassCard({
  tone = "neutral",
  className = "",
  children,
  as = "div",
}: Props) {
  const Tag = as as keyof React.JSX.IntrinsicElements;
  return (
    <Tag className={`${tones[tone]} rounded-3xl ${className}`}>{children}</Tag>
  );
}
