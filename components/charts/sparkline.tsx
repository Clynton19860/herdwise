type Props = {
  data: number[];
  /** Hex or rgba — the stroke gradient end color. The start is fixed brand. */
  color?: string;
  height?: number;
  fill?: boolean;
  className?: string;
};

export function Sparkline({
  data,
  color = "#00f5a0",
  height = 56,
  fill = true,
  className = "",
}: Props) {
  if (data.length < 2) return null;
  const w = 100;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);

  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return [x, y] as const;
  });

  const path =
    "M " +
    pts
      .map(([x, y], i) => {
        if (i === 0) return `${x.toFixed(2)} ${y.toFixed(2)}`;
        const [px, py] = pts[i - 1];
        const cx = (px + x) / 2;
        return `Q ${cx.toFixed(2)} ${py.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  const gradId = `g-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gradId})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" />
      {/* Last point dot */}
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="1.6"
        fill={color}
      />
    </svg>
  );
}
