import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { I } from "@/components/ui/icon";

export default function SettingsPage() {
  return (
    <>
      <Topbar
        title="Settings"
        subtitle="Workspace, integrations and platform configuration"
      />

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="p-6 lg:p-7">
          <h3 className="text-base font-semibold tracking-tight">Workspace</h3>
          <p className="text-xs text-white/55">City of Harare · Pilot tenant</p>

          <div className="mt-5 space-y-4">
            <Row label="Tenant" value="City of Harare" />
            <Row label="Region" value="Zimbabwe · ZW-HA" />
            <Row label="Data residency" value="Africa · za-jhb-1" />
            <Row label="Plan" value="Municipal Pilot" badge="Active" />
          </div>
        </GlassCard>

        <GlassCard className="p-6 lg:p-7">
          <h3 className="text-base font-semibold tracking-tight">Integrations</h3>
          <p className="text-xs text-white/55">Connected services</p>

          <ul className="mt-4 space-y-2">
            <Integration name="Supabase" status="Pending" tone="amber" icon={<I.Layers size={16} />} />
            <Integration name="Apple Find My" status="Connected" tone="veld" icon={<I.Pin size={16} />} />
            <Integration name="Mobile money" status="Connected" tone="veld" icon={<I.Tag size={16} />} />
            <Integration name="National Veterinary DB" status="Planned" tone="violet" icon={<I.Stethoscope size={16} />} />
            <Integration name="GIS · ZimSurvey" status="Connected" tone="veld" icon={<I.Map size={16} />} />
          </ul>
        </GlassCard>

        <GlassCard className="p-6 lg:p-7">
          <h3 className="text-base font-semibold tracking-tight">Security</h3>
          <p className="text-xs text-white/55">Authentication, encryption, audit</p>

          <ul className="mt-4 space-y-2">
            <Toggle label="Multi-factor authentication" on />
            <Toggle label="Row-level security (RLS)" on />
            <Toggle label="End-to-end encryption" on />
            <Toggle label="Tamper-resistant audit logs" on />
            <Toggle label="Auto-rotate device tokens" />
          </ul>
          <Button variant="glass" size="sm" className="mt-4 w-full" iconLeft={<I.Shield size={14} />}>
            Open security review
          </Button>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <h3 className="text-base font-semibold tracking-tight">Notification channels</h3>
        <p className="text-xs text-white/55">Where alerts are routed</p>

        <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Channel name="SMS" status="On" hint="Econet · ZWMOBILE" tone="veld" />
          <Channel name="WhatsApp" status="On" hint="Cloud API" tone="veld" />
          <Channel name="Push" status="On" hint="Mobile apps" tone="veld" />
          <Channel name="Email" status="Off" hint="Optional" tone="neutral" />
        </div>
      </GlassCard>
    </>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/55">{label}</span>
      <span className="flex items-center gap-2">
        <span>{value}</span>
        {badge && <Badge tone="veld">{badge}</Badge>}
      </span>
    </div>
  );
}

function Integration({
  name,
  status,
  tone,
  icon,
}: {
  name: string;
  status: string;
  tone: "veld" | "amber" | "violet";
  icon: React.ReactNode;
}) {
  return (
    <li className="glass-thin rounded-2xl p-3 flex items-center gap-3">
      <span className="h-9 w-9 rounded-xl glass-thin grid place-items-center text-white/85">
        {icon}
      </span>
      <span className="text-sm font-medium flex-1">{name}</span>
      <Badge tone={tone}>{status}</Badge>
    </li>
  );
}

function Toggle({ label, on }: { label: string; on?: boolean }) {
  return (
    <li className="flex items-center justify-between py-1.5 text-sm">
      <span>{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
          on ? "bg-emerald-400/60" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            on ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </li>
  );
}

function Channel({
  name,
  status,
  hint,
  tone,
}: {
  name: string;
  status: string;
  hint: string;
  tone: "veld" | "neutral";
}) {
  return (
    <div className="glass-thin rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">{name}</span>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <div className="mt-1.5 text-xs text-white/55">{hint}</div>
    </div>
  );
}
