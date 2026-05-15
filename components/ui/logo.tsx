import Link from "next/link";

type Props = {
  size?: "sm" | "md" | "lg";
  href?: string;
  showWordmark?: boolean;
};

export function Logo({ size = "md", href = "/", showWordmark = true }: Props) {
  const dim = size === "sm" ? 28 : size === "lg" ? 44 : 34;
  const text =
    size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";

  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 group"
      aria-label="Herdwise home"
    >
      <span
        className="relative inline-flex items-center justify-center rounded-2xl glass-veld animate-glow"
        style={{ width: dim, height: dim }}
      >
        <svg
          viewBox="0 0 32 32"
          width={dim * 0.62}
          height={dim * 0.62}
          aria-hidden
        >
          <defs>
            <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#00f5a0" />
              <stop offset="100%" stopColor="#5be7ff" />
            </linearGradient>
          </defs>
          {/* Stylized horn-and-pin mark — livestock + location */}
          <path
            d="M16 4c-3.4 0-6 2.4-6 5.4 0 1.8.9 3.1 2.2 4.2-1.7 1.6-2.7 3.7-2.7 6 0 4.1 2.9 7.4 6.5 7.4s6.5-3.3 6.5-7.4c0-2.3-1-4.4-2.7-6 1.3-1.1 2.2-2.4 2.2-4.2C22 6.4 19.4 4 16 4z"
            fill="url(#lg)"
            opacity="0.95"
          />
          <circle cx="16" cy="20" r="2.4" fill="#03190f" />
        </svg>
      </span>
      {showWordmark && (
        <span className={`font-semibold tracking-tight ${text}`}>
          Herd<span className="text-veld-300">wise</span>
        </span>
      )}
    </Link>
  );
}
