import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  if (status === "Healthy")     return <Badge tone="veld" dot>Healthy</Badge>;
  if (status === "Monitoring")  return <Badge tone="amber" dot>Monitoring</Badge>;
  if (status === "Alert")       return <Badge tone="coral" dot>Alert</Badge>;
  if (status === "Quarantined") return <Badge tone="violet" dot>Quarantined</Badge>;
  return <Badge>{status}</Badge>;
}

export function BatteryBar({ value }: { value: number }) {
  const color = value > 60 ? "#34c071" : value > 30 ? "#ffb547" : "#ff6b6b";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="relative h-2 w-16 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
      <span className="text-xs font-mono text-white/65">{value}%</span>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "Critical") return <Badge tone="coral" dot>Critical</Badge>;
  if (severity === "High")     return <Badge tone="amber" dot>High</Badge>;
  if (severity === "Medium")   return <Badge tone="cyan">Medium</Badge>;
  return <Badge>Low</Badge>;
}

export function IncidentStatusBadge({ status }: { status: string }) {
  if (status === "Open")        return <Badge tone="amber" dot>Open</Badge>;
  if (status === "In progress") return <Badge tone="cyan" dot>In progress</Badge>;
  if (status === "Resolved")    return <Badge tone="veld">Resolved</Badge>;
  if (status === "Escalated")   return <Badge tone="coral" dot>Escalated</Badge>;
  return <Badge>{status}</Badge>;
}

export function ZoneTypeBadge({ type }: { type: string }) {
  if (type === "Grazing")    return <Badge tone="veld">Grazing</Badge>;
  if (type === "Buffer")     return <Badge tone="amber">Buffer</Badge>;
  if (type === "Restricted") return <Badge tone="coral">Restricted</Badge>;
  if (type === "Watering")   return <Badge tone="cyan">Watering</Badge>;
  if (type === "Quarantine") return <Badge tone="violet">Quarantine</Badge>;
  return <Badge>{type}</Badge>;
}
