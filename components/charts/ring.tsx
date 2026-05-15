type Props = {
  value: number; // 0..100
  size?: number;
  thickness?: number;
  color?: string;
  label?: string;
  sublabel?: string;
};

export function Ring({
  value,
  size = 140,
  thickness = 12,
  color = "#00f5a0",
  label,
  sublabel,
}: Props) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const dash = (v / 100) * c;
  const gradId = `r-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor="#5be7ff" stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={thickness}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradId})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          fill="none"
          style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-2xl font-semibold tracking-tight">{label ?? `${v}%`}</div>
          {sublabel && (
            <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/55">
              {sublabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
