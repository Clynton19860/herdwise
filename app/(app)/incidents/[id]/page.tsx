import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/app/topbar";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { I } from "@/components/ui/icon";
import { SeverityBadge, IncidentStatusBadge, StatusBadge } from "@/components/app/indicators";
import { getAnimal, getGeofences, getIncident, getOwner } from "@/lib/db";
import { generateAiSummary } from "@/lib/ai-server";

type Params = Promise<{ id: string }>;

const severityHex = (s: string) =>
  s === "Critical" ? "#ff6b6b" : s === "High" ? "#ffb547" : s === "Medium" ? "#5be7ff" : "#34c071";

export default async function IncidentDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const [incident, geofences] = await Promise.all([getIncident(id), getGeofences()]);
  if (!incident) notFound();

  const [animal, owner] = await Promise.all([
    incident.animalId ? getAnimal(incident.animalId) : null,
    incident.ownerId ? getOwner(incident.ownerId) : null,
  ]);
  const reported = new Date(incident.reportedAt);
  const accent = severityHex(incident.severity);
  const officerName = incident.officer;
  const officerInitials = officerName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  const auditHash = `0x${incident.id.replace(/[^a-z0-9]/gi, "")}b3f02a`;

  const aiSummary = await generateAiSummary({
    system:
      "You are Herdwise, a livestock platform AI assistant for the City of Harare. You write tight, decision-oriented executive summaries for municipal incident case files. Output 2-3 plain prose sentences. Be specific with tags, names, severity and time. No headings, no bullets, no preamble.",
    user: JSON.stringify({
      ref: incident.ref,
      type: incident.type,
      severity: incident.severity,
      status: incident.status,
      reported_at: incident.reportedAt,
      location: incident.location.label,
      officer: officerName,
      notes: incident.notes,
      animal: animal
        ? {
            tag: animal.tag,
            name: animal.name,
            species: animal.species,
            breed: animal.breed,
            status: animal.status,
            zone: animal.location.zone,
          }
        : null,
      owner: owner
        ? { name: owner.fullName, ward: owner.ward, herd_size: owner.herdSize, phone: owner.phone }
        : null,
    }),
    maxTokens: 400,
    effort: "low",
  });

  return (
    <>
      <Topbar title={`Case ${incident.ref}`} subtitle={`${incident.type} · ${incident.location.label}`} />

      {/* Back nav + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/incidents"
          className="inline-flex items-center gap-1.5 text-sm text-white/65 hover:text-white transition-colors"
        >
          <I.ArrowRight size={14} className="rotate-180" />
          Back to incident board
        </Link>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="glass" iconLeft={<I.Bell size={14} />}>Acknowledge</Button>
          <Button size="sm" variant="glass" iconLeft={<I.Alert size={14} />}>Escalate</Button>
          <Button size="sm" variant="primary" iconLeft={<I.Check size={14} />}>Resolve</Button>
        </div>
      </div>

      {/* ===== Case file header ===== */}
      <GlassCard tone="heavy" className="p-6 lg:p-8 relative overflow-hidden">
        <div
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-30"
          style={{ background: accent }}
        />
        <div className="relative flex flex-wrap items-start gap-5">
          <div
            className="h-14 w-14 rounded-2xl grid place-items-center shadow-[0_12px_32px_-12px_currentColor] shrink-0"
            style={{ background: accent, color: "#0a1612" }}
          >
            <I.Alert size={26} strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-white/65">{incident.ref}</span>
              <SeverityBadge severity={incident.severity} />
              <IncidentStatusBadge status={incident.status} />
            </div>
            <h2 className="mt-2 text-2xl lg:text-3xl font-semibold tracking-tight">
              {incident.type}
            </h2>
            <p className="mt-1.5 text-sm text-white/70 leading-snug max-w-3xl">
              {incident.notes}
            </p>
            <div className="mt-4 flex items-center flex-wrap gap-x-5 gap-y-2 text-xs text-white/55">
              <span className="flex items-center gap-1.5"><I.Pin size={13} className="text-emerald-300" /> {incident.location.label}</span>
              <span className="flex items-center gap-1.5"><I.Calendar size={13} /> {reported.toLocaleString("en-ZW", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="flex items-center gap-1.5"><I.Users size={13} /> {incident.officer}</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ===== AI executive summary ===== */}
      {aiSummary && (
        <GlassCard className="p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="h-10 w-10 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] grid place-items-center text-emerald-950 shrink-0 shadow-[0_8px_24px_-8px_rgba(0,245,160,0.6)]">
              <I.Sparkle size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs uppercase tracking-[0.14em] text-white/55">
                  Herdwise AI · Executive summary
                </span>
                <Badge tone="aurora">Claude Opus 4.7</Badge>
              </div>
              <p className="text-sm sm:text-[15px] text-white/90 leading-relaxed text-pretty">
                {aiSummary}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ===== Two-column body ===== */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        {/* Left: timeline, map, evidence, communications */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-5">
          {/* Map */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-2">
              <h3 className="text-base font-semibold tracking-tight">Location</h3>
              <span className="text-xs text-white/45 font-mono">
                {incident.location.x.toFixed(2)}°E · {incident.location.y.toFixed(2)}°S
              </span>
            </div>
            <div className="map-canvas topo-lines relative overflow-hidden rounded-2xl border border-white/10 h-[280px] sm:h-[340px]">
              <div className="absolute inset-0 grid-lines opacity-30" />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                {geofences.map((g) => (
                  <polygon
                    key={g.id}
                    points={g.polygon.map((p) => p.join(",")).join(" ")}
                    fill="rgba(255,255,255,0.04)"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="0.2"
                    strokeDasharray="0.5 0.5"
                  />
                ))}
              </svg>
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${incident.location.x}%`, top: `${incident.location.y}%` }}
              >
                <span className="relative inline-flex h-3.5 w-3.5">
                  <span className="absolute inset-0 rounded-full animate-pulse-ring" style={{ background: accent, opacity: 0.65 }} />
                  <span className="relative h-3.5 w-3.5 rounded-full ring-2 ring-white/40 shadow-[0_0_16px_currentColor]" style={{ background: accent, color: accent }} />
                </span>
              </div>
              <div className="absolute bottom-3 left-3 chip">{incident.location.label}</div>
            </div>
          </GlassCard>

          {/* Timeline */}
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-base font-semibold tracking-tight">Case timeline</h3>
              <Badge tone="aurora" dot>Audit trail</Badge>
            </div>

            <ul className="relative pl-6 space-y-5 before:content-[''] before:absolute before:left-2 before:top-1.5 before:bottom-1.5 before:w-px before:bg-white/10">
              <TimelineItem
                icon={<I.Alert size={12} />}
                title="Incident reported"
                body={`By ${incident.officer} — ${incident.type}.`}
                when={reported.toLocaleString("en-ZW", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                tone="amber"
              />
              <TimelineItem
                icon={<I.Bell size={12} />}
                title="Owner notified"
                body={`SMS + WhatsApp delivered to ${owner?.fullName ?? "owner"} at ${owner?.phone ?? ""}.`}
                when="+ 2 min"
                tone="cyan"
              />
              {incident.status !== "Open" && (
                <TimelineItem
                  icon={<I.Eye size={12} />}
                  title="Acknowledged"
                  body={`${incident.officer} accepted the assignment.`}
                  when="+ 5 min"
                  tone="cyan"
                />
              )}
              {(incident.status === "In progress" || incident.status === "Escalated" || incident.status === "Resolved") && (
                <TimelineItem
                  icon={<I.Pin size={12} />}
                  title="On scene"
                  body="Officer reported arrival at the incident location."
                  when="+ 18 min"
                  tone="violet"
                />
              )}
              {incident.status === "Escalated" && (
                <TimelineItem
                  icon={<I.Alert size={12} />}
                  title="Escalated"
                  body="Auto-escalated to municipal supervisor after threshold breach."
                  when="+ 28 min"
                  tone="coral"
                />
              )}
              {incident.status === "Resolved" && (
                <TimelineItem
                  icon={<I.Check size={12} />}
                  title="Resolved"
                  body="Case closed. Citation issued; restitution recorded."
                  when="+ 42 min"
                  tone="veld"
                />
              )}
            </ul>
          </GlassCard>

          {/* Photo evidence */}
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Evidence</h3>
                <p className="text-xs text-white/55 mt-0.5">Court-grade · cryptographically signed</p>
              </div>
              <Badge tone="veld">3 attachments</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <EvidenceTile label="On-scene · wide" id="EV-01" tone="emerald" />
              <EvidenceTile label="Tag close-up" id="EV-02" tone="cyan" />
              <EvidenceTile label="Witness statement" id="EV-03" tone="violet" file />
            </div>
          </GlassCard>

          {/* Communications */}
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-semibold tracking-tight">Communications log</h3>
                <p className="text-xs text-white/55 mt-0.5">All messages dispatched on this case</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              <CommItem channel="SMS" recipient={owner?.fullName ?? "Owner"} status="Delivered" body="Your livestock has been involved in a reported incident. Officer is on the way." />
              <CommItem channel="WhatsApp" recipient={owner?.fullName ?? "Owner"} status="Read" body="Reference: " caseRef={incident.ref} />
              <CommItem channel="Push" recipient="Insp. Tatenda M." status="Tapped" body="New incident assigned to you." />
              <CommItem channel="Email" recipient="Veterinary services" status="Delivered" body="Disease anomaly alert in your ward." />
            </ul>
          </GlassCard>
        </div>

        {/* Right rail: subject, officer, actions */}
        <div className="space-y-4 lg:space-y-5">
          {/* Subject */}
          <GlassCard className="p-5 sm:p-6">
            <h3 className="text-base font-semibold tracking-tight">Subject</h3>
            <p className="text-xs text-white/55 mt-0.5">Animal & owner involved</p>

            {animal && (
              <div className="mt-4 glass-thin rounded-2xl p-3 flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl glass-thin grid place-items-center text-emerald-300 shrink-0">
                  <I.Cow size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight truncate">
                    {animal.name ?? "Unnamed"}
                  </div>
                  <div className="text-[11px] font-mono text-white/55 truncate">{animal.tag}</div>
                </div>
                <Link
                  href={`/livestock/${animal.id}`}
                  className="text-xs text-emerald-200 hover:text-emerald-100 inline-flex items-center gap-1"
                >
                  Open <I.ArrowRight size={12} />
                </Link>
              </div>
            )}

            {animal && (
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <KV k="Species" v={animal.species} />
                <KV k="Breed" v={animal.breed} />
                <KV k="Status" v={<StatusBadge status={animal.status} />} />
                <KV k="Zone" v={animal.location.zone} />
              </dl>
            )}

            {owner && (
              <div className="mt-5 pt-5 border-t border-white/8">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 mb-2">
                  Registered owner
                </div>
                <Link
                  href={`/owners/${owner.id}`}
                  className="glass-thin rounded-2xl p-3 flex items-center gap-3 hover:bg-white/6 transition-colors"
                >
                  <span className="h-9 w-9 rounded-xl bg-[linear-gradient(135deg,#ffd57a,#ff9b3a)] text-emerald-950 font-semibold grid place-items-center text-xs">
                    {owner.fullName.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{owner.fullName}</div>
                    <div className="text-[11px] font-mono text-white/55 truncate">{owner.phone}</div>
                  </div>
                  <I.ArrowRight size={14} className="text-white/45" />
                </Link>
              </div>
            )}
          </GlassCard>

          {/* Officer */}
          <GlassCard className="p-5 sm:p-6">
            <h3 className="text-base font-semibold tracking-tight">Assigned officer</h3>
            <div className="mt-4 glass-thin rounded-2xl p-3 flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-[linear-gradient(135deg,#5be7ff,#8c7cff)] text-emerald-950 font-semibold grid place-items-center text-xs">
                {officerInitials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{officerName}</div>
                <div className="text-[11px] text-white/55 truncate">Enforcement · on shift</div>
              </div>
              <Badge tone="veld" dot>Active</Badge>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="glass" size="sm" iconLeft={<I.Bell size={12} />}>Page</Button>
              <Button variant="glass" size="sm" iconLeft={<I.Map size={12} />}>Track</Button>
            </div>
          </GlassCard>

          {/* Actions */}
          <GlassCard tone="veld" className="p-5">
            <h3 className="text-base font-semibold tracking-tight">Quick actions</h3>
            <ul className="mt-4 space-y-2">
              <ActionButton icon={<I.Stethoscope size={14} />} label="Dispatch veterinary team" />
              <ActionButton icon={<I.Shield size={14} />} label="Issue citation" />
              <ActionButton icon={<I.Layers size={14} />} label="Create related incident" />
              <ActionButton icon={<I.Activity size={14} />} label="Export PDF report" />
            </ul>
          </GlassCard>

          {/* Audit hash */}
          <GlassCard className="p-4">
            <div className="flex items-start gap-3">
              <I.Shield size={14} className="text-emerald-300 mt-0.5 shrink-0" />
              <div className="text-[11px] text-white/55 leading-relaxed">
                Audit hash{" "}
                <span className="font-mono text-white/75">{auditHash}…</span>
                <br />Tamper-resistant ledger entry.
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

/* ---------- Helpers ---------- */

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-white/45">{k}</dt>
      <dd className="mt-0.5 text-white/90">{v}</dd>
    </div>
  );
}

function TimelineItem({
  icon,
  title,
  body,
  when,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  when: string;
  tone: "veld" | "amber" | "cyan" | "violet" | "coral";
}) {
  const bg =
    tone === "veld" ? "bg-emerald-300"
    : tone === "amber" ? "bg-amber-300"
    : tone === "cyan" ? "bg-cyan-300"
    : tone === "violet" ? "bg-violet-300"
    : "bg-rose-300";
  return (
    <li className="relative">
      <span className={`absolute -left-[22px] top-1 h-5 w-5 rounded-full ${bg} grid place-items-center text-emerald-950 shadow-[0_0_12px_currentColor]`}>
        {icon}
      </span>
      <div className="text-xs text-white/55 font-mono">{when}</div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-white/65 mt-0.5">{body}</div>
    </li>
  );
}

function EvidenceTile({
  label,
  id,
  tone,
  file,
}: {
  label: string;
  id: string;
  tone: "emerald" | "cyan" | "violet";
  file?: boolean;
}) {
  const grad =
    tone === "emerald" ? "from-emerald-400/30 to-cyan-400/10"
    : tone === "cyan" ? "from-cyan-400/30 to-violet-400/10"
    : "from-violet-400/30 to-emerald-400/10";
  return (
    <div className="group relative aspect-square rounded-2xl overflow-hidden glass-thin">
      <div className={`absolute inset-0 bg-gradient-to-br ${grad}`} />
      <div className="absolute inset-0 grid-lines opacity-30" />
      <div className="absolute inset-0 grid place-items-center">
        {file ? <I.Layers size={32} className="text-white/40" /> : <I.Eye size={32} className="text-white/40" />}
      </div>
      <div className="absolute top-2 left-2 chip">{id}</div>
      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
        <div className="text-[11px] text-white/85 truncate">{label}</div>
      </div>
    </div>
  );
}

function CommItem({
  channel,
  recipient,
  status,
  body,
  caseRef,
}: {
  channel: string;
  recipient: string;
  status: string;
  body: string;
  caseRef?: string;
}) {
  const tone =
    channel === "SMS" ? "veld"
    : channel === "WhatsApp" ? "veld"
    : channel === "Push" ? "cyan"
    : "violet";
  return (
    <li className="glass-thin rounded-2xl p-3 flex items-start gap-3">
      <Badge tone={tone as "veld" | "cyan" | "violet"}>{channel}</Badge>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-white/55">To {recipient}</div>
        <div className="text-sm leading-snug">
          {body}
          {caseRef && <span className="font-mono text-emerald-200">{caseRef}</span>}
        </div>
      </div>
      <Badge tone="veld" dot>{status}</Badge>
    </li>
  );
}

function ActionButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li>
      <button className="w-full flex items-center gap-3 px-3 h-10 rounded-2xl glass-thin hover:bg-white/8 text-sm transition-colors text-left">
        <span className="h-7 w-7 rounded-lg glass-thin grid place-items-center text-emerald-300 shrink-0">
          {icon}
        </span>
        <span className="flex-1 truncate">{label}</span>
        <I.ArrowRight size={12} className="text-white/45" />
      </button>
    </li>
  );
}
