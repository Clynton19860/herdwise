type Props = {
  data: { label: string; value: number; color?: string }[];
  height?: number;
};

export function Bars({ data, height = 160 }: Props) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div
      className="grid gap-2 items-end"
      style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`, height }}
    >
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        const color = d.color ?? "#00f5a0";
        return (
          <div key={d.label} className="flex flex-col items-center gap-2 h-full">
            <div className="flex-1 w-full flex items-end">
              <div
                className="w-full rounded-t-xl"
                style={{
                  height: `${pct}%`,
                  background: `linear-gradient(180deg, ${color} 0%, ${color}33 100%)`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 0 24px -8px ${color}`,
                }}
              />
            </div>
            <div className="text-[10px] text-white/55 uppercase tracking-wider">
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
