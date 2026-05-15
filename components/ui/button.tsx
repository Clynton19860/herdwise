import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "glass" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(135deg,#00f5a0_0%,#1aa05a_100%)] text-[#03190f] hover:brightness-110 shadow-[0_10px_30px_-10px_rgba(0,245,160,0.6)] border border-white/10",
  glass:
    "glass text-white hover:bg-white/10 transition-colors",
  outline:
    "border border-white/20 bg-white/0 hover:bg-white/5 text-white",
  ghost:
    "text-white/80 hover:text-white hover:bg-white/5",
  danger:
    "bg-[linear-gradient(135deg,#ff7a7a,#c44545)] text-white hover:brightness-110 border border-white/10",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm rounded-2xl gap-2",
  lg: "h-13 px-7 text-base rounded-2xl gap-2.5",
};

const base =
  "inline-flex items-center justify-center font-medium tracking-tight transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

type ButtonProps = CommonProps &
  Omit<ComponentProps<"button">, "className" | "children">;

type LinkButtonProps = CommonProps &
  Omit<ComponentProps<typeof Link>, "className" | "children">;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  iconLeft,
  iconRight,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  iconLeft,
  iconRight,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </Link>
  );
}
