import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";
import { getGatewayStatus, getStaff, getWards, isDatabaseConfigured } from "@/lib/db";
import { currentStaff } from "@/lib/session";
import { InviteStaff } from "@/components/settings/invite-staff";

/**
 * This page states the platform's real posture.
 *
 * It previously showed toggles reading "Multi-factor authentication: on" and
 * "End-to-end encryption: on" for a deployment with no authentication of any
 * kind, integrations to Apple Find My and mobile money that do not exist, and
 * SMS, WhatsApp and Push channels marked On that have never sent a message. A
 * settings page is where somebody checks a compliance claim, so it is the last
 * place that can afford to flatter the build.
 *
 * The toggles are gone. A toggle implies something you can switch; these are
 * observations, and several are deliberately not on yet.
 */
export default async function SettingsPage() {
  const dbReady = isDatabaseConfigured();
  const assistantReady = Boolean(process.env.ANTHROPIC_API_KEY);

  const me = dbReady ? await currentStaff() : null;
  const [team, wards] = dbReady ? await Promise.all([getStaff(), getWards()]) : [[], []];

  const { hoursSinceFix, live: gatewayLive } = dbReady
    ? await getGatewayStatus()
    : { hoursSinceFix: null, live: false };

  return (
    <>
      <Topbar
        title="Settings"
        subtitle="What is connected, and what is not"
      />

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <GlassCard className="p-6 lg:p-7">
          <h3 className="text-base font-semibold tracking-tight">Workspace</h3>
          <p className="text-xs text-white/55">Pilot tenant · one ward live</p>

          <div className="mt-5 space-y-4">
            <Row label="Tenant" value="City of Harare" />
            <Row label="Target deployment" value="Zimbabwe · ZW-HA" />
            <Row label="Data residency" value="West EU · aws-eu-west-1 (Ireland)" />
            <Row label="Plan" value="Municipal Pilot" badge="Active" />
          </div>
        </GlassCard>

        <GlassCard className="p-6 lg:p-7">
          <h3 className="text-base font-semibold tracking-tight">Integrations</h3>
          <p className="text-xs text-white/55">Connected services</p>

          <ul className="mt-4 space-y-2">
            <Integration
              name="Supabase · PostgreSQL + PostGIS"
              status={dbReady ? "Connected" : "Not configured"}
              tone={dbReady ? "veld" : "amber"}
              icon={<I.Layers size={16} />}
            />
            <Integration
              name="Tag gateway · Azure"
              status={
                gatewayLive
                  ? "Receiving"
                  : hoursSinceFix != null
                    ? `Quiet ${Math.round(hoursSinceFix)}h`
                    : "No data"
              }
              tone={gatewayLive ? "veld" : "amber"}
              icon={<I.Wifi size={16} />}
            />
            <Integration
              name="Herdwise assistant · Claude"
              status={assistantReady ? "Connected" : "Not configured"}
              tone={assistantReady ? "veld" : "amber"}
              icon={<I.Sparkle size={16} />}
            />
            <Integration name="National Veterinary DB" status="Planned" tone="violet" icon={<I.Stethoscope size={16} />} />
            <Integration name="Mobile money" status="Planned" tone="violet" icon={<I.Tag size={16} />} />
          </ul>
        </GlassCard>

        <GlassCard className="p-6 lg:p-7">
          <h3 className="text-base font-semibold tracking-tight">Security</h3>
          <p className="text-xs text-white/55">Authentication, encryption, audit</p>

          <ul className="mt-4 space-y-1">
            <Posture label="Authentication" state="on" note="Password, then a six-digit code. Sessions last 12 hours" />
            <Posture label="Anonymous access" state="on" note="Revoked — the public key can no longer read any table" />
            <Posture label="Row-level security" state="partial" note="Policies written; the application role still bypasses them" />
            <Posture label="Code delivery" state="off" note="No mail provider connected — codes are written to the server log" />
            <Posture label="Database transport" state="on" note="TLS with a pinned root certificate" />
            <Posture label="Ear tag transport" state="off" note="The HCS048 protocol is plaintext TCP — no TLS available" />
            <Posture label="Device identity" state="partial" note="IMEI only; the protocol offers nothing to rotate" />
            <Posture label="Incident trail" state="partial" note="Breaches and incidents are recorded, but not tamper-proof" />
          </ul>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight">People</h3>
            <p className="text-xs text-white/55">
              Who can sign in, and what they are allowed to do
            </p>
          </div>
        </div>

        <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {team.map((t) => (
            <li key={t.id} className="glass-thin rounded-2xl p-3 flex items-center gap-3">
              <span className="h-9 w-9 rounded-xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] text-emerald-950 text-xs font-semibold grid place-items-center shrink-0">
                {t.name
                  .replace(/^(Insp\.|Sgt\.|Dr\.|Mr\.|Mrs\.|Ms\.)\s*/i, "")
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm truncate">{t.name}</span>
                <span className="block text-xs text-white/50 capitalize">{t.role}</span>
              </span>
            </li>
          ))}
        </ul>

        {me?.role === "admin" ? (
          <InviteStaff wards={wards.map((w) => w.name)} />
        ) : (
          <p className="mt-4 text-xs text-white/45">
            Only an administrator can add people.
          </p>
        )}
      </GlassCard>

      <GlassCard className="p-6">
        <h3 className="text-base font-semibold tracking-tight">Notification channels</h3>
        <p className="text-xs text-white/55">How an alert would reach a person</p>

        <div className="mt-4 glass-thin rounded-2xl p-5 flex items-start gap-3">
          <I.Alert size={16} className="text-amber-300 mt-0.5 shrink-0" />
          <div className="text-sm text-white/75">
            No delivery channel is connected yet. Breaches are recorded and shown in
            the platform, but nothing is sent to an owner or officer outside it.
            <span className="block mt-1 text-xs text-white/50">
              SMS, WhatsApp and push were previously listed here as active. They were not.
            </span>
          </div>
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



/**
 * Three states, not two.
 *
 * The switches this replaces could only say on or off, so "row-level security"
 * had to be shown as fully on when the truth is that the policies exist but are
 * not enforced yet. Most of this platform's security posture is partial, and a
 * binary control cannot express that without lying in one direction.
 */
function Posture({
  label,
  state,
  note,
}: {
  label: string;
  state: "on" | "partial" | "off";
  note: string;
}) {
  const dot =
    state === "on" ? "bg-emerald-400" : state === "partial" ? "bg-amber-300" : "bg-white/30";
  const word = state === "on" ? "Active" : state === "partial" ? "Partial" : "Not active";
  const tone = state === "on" ? "text-emerald-200" : state === "partial" ? "text-amber-200" : "text-white/50";
  return (
    <li className="py-2 border-b border-white/5 last:border-b-0">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2.5">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
          {label}
        </span>
        <span className={`text-xs ${tone}`}>{word}</span>
      </div>
      <p className="mt-0.5 ml-4 text-xs text-white/50 leading-snug">{note}</p>
    </li>
  );
}
