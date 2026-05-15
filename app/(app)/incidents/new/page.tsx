"use client";

import { useState } from "react";
import { WizardShell, type WizardStep } from "@/components/wizard/wizard";
import { SuccessScreen } from "@/components/wizard/success";
import { PhotoUpload, type UploadedPhoto } from "@/components/wizard/photo-upload";
import { LocationPicker } from "@/components/wizard/location-picker";
import {
  Checkbox,
  FormField,
  RadioCardGroup,
  type RadioCardOption,
  SearchPicker,
  Select,
  Slider,
  Textarea,
  TextInput,
} from "@/components/ui/form";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";
import { animals, findOwner, owners } from "@/lib/data";

const steps: WizardStep[] = [
  { id: "type",     title: "Type",     description: "What kind of incident are you reporting?",           icon: <I.Alert size={20} /> },
  { id: "subject", title: "Subject",   description: "Link the report to an animal or owner if known.",    icon: <I.Cow size={20} /> },
  { id: "where",   title: "Location",  description: "Pin the incident location on the map.",              icon: <I.Pin size={20} /> },
  { id: "details", title: "Details",   description: "Severity, evidence and officer assignment.",         icon: <I.Stethoscope size={20} /> },
  { id: "review",  title: "Review",    description: "Confirm details and dispatch.",                      icon: <I.Check size={20} /> },
];

const typeOptions: RadioCardOption[] = [
  { value: "Stray",            label: "Stray animal",      description: "Animal in an unauthorised area",      icon: <I.Cow size={20} /> },
  { value: "Theft",            label: "Theft",             description: "Suspected or confirmed theft",        icon: <I.Shield size={20} /> },
  { value: "Boundary breach",  label: "Boundary breach",   description: "Restricted/quarantine zone entered",  icon: <I.Layers size={20} /> },
  { value: "Disease alert",    label: "Disease alert",     description: "Suspected disease outbreak",          icon: <I.Stethoscope size={20} /> },
  { value: "Injured",          label: "Injured animal",    description: "Visible injury requiring vet care",   icon: <I.Heart size={20} /> },
  { value: "Death",            label: "Animal death",      description: "Loss of an animal",                   icon: <I.Alert size={20} /> },
];

const officers = [
  { value: "Insp. T. Moyo",   label: "Insp. T. Moyo",   hint: "Hatcliffe · on shift" },
  { value: "Sgt. P. Ncube",   label: "Sgt. P. Ncube",   hint: "Mabvuku · on shift" },
  { value: "Dr. R. Chivasa",  label: "Dr. R. Chivasa",  hint: "Veterinary · on call" },
  { value: "Officer F. Dube", label: "Officer F. Dube", hint: "Kuwadzana · on shift" },
  { value: "Insp. M. Sibanda",label: "Insp. M. Sibanda",hint: "Epworth · on shift" },
];

const severityColor = (s: number) =>
  s >= 80 ? "#ff6b6b" : s >= 60 ? "#ffb547" : s >= 40 ? "#5be7ff" : "#34c071";
const severityLabel = (s: number) =>
  s >= 80 ? "Critical" : s >= 60 ? "High" : s >= 40 ? "Medium" : "Low";

type SubjectKind = "animal" | "owner" | "unknown";

export default function ReportIncidentPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [issuedRef, setIssuedRef] = useState<string | null>(null);

  const [type, setType] = useState<string>("");
  const [subjectKind, setSubjectKind] = useState<SubjectKind>("animal");
  const [animalId, setAnimalId] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [location, setLocation] = useState<{ x: number; y: number } | null>(null);
  const [zoneLabel, setZoneLabel] = useState<string>("");
  const [severity, setSeverity] = useState<number>(60);
  const [notes, setNotes] = useState<string>("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [officer, setOfficer] = useState<string>("");
  const [dispatchNow, setDispatchNow] = useState<boolean>(true);
  const [witness, setWitness] = useState<string>("");
  const [notifyOwner, setNotifyOwner] = useState<boolean>(true);
  const [escalateAfter, setEscalateAfter] = useState<number>(15);

  const selectedAnimal = animals.find((a) => a.id === animalId) || null;
  const selectedOwner = owners.find((o) => o.id === ownerId) || (selectedAnimal ? findOwner(selectedAnimal.ownerId) : null);

  const canAdvance = () => {
    switch (stepIndex) {
      case 0: return !!type;
      case 1:
        if (subjectKind === "animal") return !!animalId;
        if (subjectKind === "owner")  return !!ownerId;
        return true;
      case 2: return !!location && location !== null;
      case 3: return !!officer && notes.trim().length >= 10;
      case 4: return true;
      default: return true;
    }
  };

  const onNext = () => setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  const onBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const onSubmit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1300));
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, "")
      .slice(0, 12);
    setIssuedRef(`INC-${stamp}`);
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted && issuedRef) {
    return (
      <SuccessScreen
        title={dispatchNow ? "Incident filed & patrol dispatched" : "Incident filed"}
        subtitle={`${type} — ${severityLabel(severity)} severity. ${officer} is on the case.`}
        ref={issuedRef}
        details={[
          { label: "Severity", value: severityLabel(severity) },
          { label: "Officer", value: officer },
          { label: "Location", value: zoneLabel || (location ? `${location.x.toFixed(1)}°E · ${location.y.toFixed(1)}°S` : "—") },
        ]}
        primary={{ href: "/incidents", label: "Open incident board" }}
        secondary={{ href: "/incidents/new", label: "Report another" }}
      />
    );
  }

  return (
    <WizardShell
      title="Report incident"
      subtitle="Capture an incident for the by-law enforcement queue."
      cancelHref="/incidents"
      steps={steps}
      currentIndex={stepIndex}
      onBack={onBack}
      onNext={onNext}
      onSubmit={onSubmit}
      nextDisabled={!canAdvance()}
      submitting={submitting}
      submitLabel={dispatchNow ? "File & dispatch" : "File incident"}
    >
      {stepIndex === 0 && (
        <FormField label="Incident type" required>
          <RadioCardGroup
            options={typeOptions}
            value={type}
            onChange={setType}
            columns={3}
          />
        </FormField>
      )}

      {stepIndex === 1 && (
        <div className="space-y-6">
          <FormField label="Subject of the report" required>
            <RadioCardGroup
              options={[
                { value: "animal",  label: "Specific animal", description: "Tag is known", icon: <I.Cow size={20} /> },
                { value: "owner",   label: "Specific owner",  description: "No tag, but owner is known", icon: <I.Users size={20} /> },
                { value: "unknown", label: "Unknown",         description: "Subject not yet identified", icon: <I.Search size={20} /> },
              ]}
              value={subjectKind}
              onChange={(v) => {
                setSubjectKind(v as SubjectKind);
                setAnimalId("");
                setOwnerId("");
              }}
              columns={3}
            />
          </FormField>

          {subjectKind === "animal" && (
            <div className="grid lg:grid-cols-[1fr_320px] gap-5">
              <FormField label="Find animal by tag, name or breed">
                <SearchPicker
                  items={animals}
                  value={selectedAnimal}
                  onChange={(a) => setAnimalId(a.id)}
                  getId={(a) => a.id}
                  getLabel={(a) => `${a.tag}${a.name ? ` — ${a.name}` : ""}`}
                  getDescription={(a) => `${a.breed} · ${a.species} · ${a.location.zone}`}
                  placeholder="HRE-CTL-00184 or 'Mvura'…"
                />
              </FormField>
              {selectedAnimal && (
                <GlassCard tone="veld" className="p-5">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-200">Selected animal</div>
                  <div className="mt-2 text-base font-semibold">
                    {selectedAnimal.name ?? "Unnamed"}
                  </div>
                  <div className="text-xs font-mono text-white/65">{selectedAnimal.tag}</div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <Row k="Species" v={`${selectedAnimal.species} · ${selectedAnimal.breed}`} />
                    <Row k="Zone" v={selectedAnimal.location.zone} />
                    <Row k="Status" v={selectedAnimal.status} />
                    <Row k="Owner" v={findOwner(selectedAnimal.ownerId)?.fullName ?? "—"} />
                  </dl>
                </GlassCard>
              )}
            </div>
          )}

          {subjectKind === "owner" && (
            <div className="grid lg:grid-cols-[1fr_320px] gap-5">
              <FormField label="Find owner by name, phone or ward">
                <SearchPicker
                  items={owners}
                  value={selectedOwner ?? null}
                  onChange={(o) => setOwnerId(o.id)}
                  getId={(o) => o.id}
                  getLabel={(o) => o.fullName}
                  getDescription={(o) => `${o.ward} · ${o.phone}`}
                  placeholder="Search owners…"
                />
              </FormField>
              {selectedOwner && (
                <GlassCard tone="veld" className="p-5">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-200">Selected owner</div>
                  <div className="mt-2 text-base font-semibold">{selectedOwner.fullName}</div>
                  <div className="text-xs text-white/65">{selectedOwner.ward}</div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <Row k="Phone" v={selectedOwner.phone} mono />
                    <Row k="National ID" v={selectedOwner.nationalId} mono />
                    <Row k="Herd size" v={`${selectedOwner.herdSize}`} />
                  </dl>
                </GlassCard>
              )}
            </div>
          )}

          {subjectKind === "unknown" && (
            <GlassCard tone="thin" className="p-4 flex items-start gap-3">
              <I.Sparkle size={16} className="text-violet-300 mt-0.5 shrink-0" />
              <div className="text-xs text-white/65">
                That&rsquo;s fine — the AI matcher will look for nearby animals and owners
                once you pin the location and add photos. Investigators can also link the
                subject later from the incident card.
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {stepIndex === 2 && (
        <div className="space-y-5">
          <LocationPicker
            value={location}
            onChange={(p) => {
              setLocation(p);
              if (selectedAnimal) setZoneLabel(selectedAnimal.location.zone);
            }}
            height={420}
            accent={severityColor(severity)}
          />
          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Zone / landmark label">
              <TextInput
                placeholder="e.g. Kuwadzana Restricted park boundary"
                value={zoneLabel}
                onChange={(e) => setZoneLabel((e.target as HTMLInputElement).value)}
                iconLeft={<I.Pin size={16} />}
              />
            </FormField>
            <FormField label="GPS coordinates" hint="Computed from the pinned point">
              <TextInput
                value={location ? `${location.x.toFixed(2)}°E, ${location.y.toFixed(2)}°S` : ""}
                readOnly
                placeholder="Pin the map to capture coordinates"
                iconLeft={<I.Map size={16} />}
              />
            </FormField>
          </div>
        </div>
      )}

      {stepIndex === 3 && (
        <div className="space-y-6">
          <FormField
            label="Severity"
            required
            hint={`${severityLabel(severity)} · ${severity}/100`}
          >
            <div className="space-y-2">
              <Slider value={severity} onChange={setSeverity} min={1} max={100} step={1} />
              <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-[0.14em]">
                <span className="text-emerald-300">Low</span>
                <span className="text-cyan-300">Medium</span>
                <span className="text-amber-300 text-right">High</span>
                <span className="text-rose-300 text-right">Critical</span>
              </div>
            </div>
          </FormField>

          <FormField label="Assign officer" required>
            <Select
              options={officers}
              value={officer}
              onChange={setOfficer}
              placeholder="Choose available officer…"
            />
          </FormField>

          <FormField
            label="Notes"
            required
            hint={`${notes.trim().length}/10 min characters`}
          >
            <Textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
              placeholder="Describe what happened, who is involved and any immediate actions taken…"
            />
          </FormField>

          <FormField label="Evidence photos" hint="Optional — but recommended for court-grade reports">
            <PhotoUpload photos={photos} onChange={setPhotos} max={8} />
          </FormField>

          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Witness contact" hint="Optional">
              <TextInput
                value={witness}
                onChange={(e) => setWitness((e.target as HTMLInputElement).value)}
                placeholder="Name and phone"
                iconLeft={<I.Users size={16} />}
              />
            </FormField>
            <FormField label="Auto-escalate (minutes)" hint="If unresolved on scene">
              <Slider value={escalateAfter} onChange={setEscalateAfter} min={0} max={120} step={5} />
            </FormField>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Checkbox
              checked={dispatchNow}
              onChange={setDispatchNow}
              label="Dispatch patrol immediately"
              description="Officer receives the case file on their mobile app and live navigation."
            />
            <Checkbox
              checked={notifyOwner}
              onChange={setNotifyOwner}
              label="Notify the registered owner"
              description="Owner gets an SMS + WhatsApp with the incident reference."
            />
          </div>
        </div>
      )}

      {stepIndex === 4 && (
        <div className="space-y-6">
          <GlassCard tone="veld" className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="aurora" dot>Ready to file</Badge>
              <h3 className="text-lg font-semibold">{type}</h3>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-medium border"
                style={{
                  background: `${severityColor(severity)}22`,
                  color: severityColor(severity),
                  borderColor: `${severityColor(severity)}55`,
                }}
              >
                {severityLabel(severity)} severity
              </span>
            </div>
            <p className="mt-3 text-sm text-white/75">{notes}</p>
          </GlassCard>

          <div className="grid md:grid-cols-2 gap-5">
            <Summary title="Subject">
              {subjectKind === "animal" && selectedAnimal && (
                <>
                  <KV k="Tag" v={selectedAnimal.tag} mono />
                  <KV k="Name" v={selectedAnimal.name ?? "—"} />
                  <KV k="Species" v={selectedAnimal.species} />
                  <KV k="Owner" v={findOwner(selectedAnimal.ownerId)?.fullName ?? "—"} />
                </>
              )}
              {subjectKind === "owner" && selectedOwner && (
                <>
                  <KV k="Name" v={selectedOwner.fullName} />
                  <KV k="Ward" v={selectedOwner.ward} />
                  <KV k="Phone" v={selectedOwner.phone} mono />
                </>
              )}
              {subjectKind === "unknown" && <KV k="Subject" v="Unknown — AI matcher will assist" />}
            </Summary>
            <Summary title="Where">
              <KV k="Label" v={zoneLabel || "—"} />
              <KV k="GPS" v={location ? `${location.x.toFixed(2)}°E · ${location.y.toFixed(2)}°S` : "—"} mono />
            </Summary>
            <Summary title="Response">
              <KV k="Officer" v={officer} />
              <KV k="Dispatch now" v={dispatchNow ? "Yes" : "No"} />
              <KV k="Notify owner" v={notifyOwner ? "Yes" : "No"} />
              <KV k="Auto-escalate" v={escalateAfter === 0 ? "Off" : `${escalateAfter} min`} />
            </Summary>
            <Summary title="Evidence">
              <KV k="Photos" v={`${photos.length} attached`} />
              <KV k="Witness" v={witness || "—"} />
            </Summary>
          </div>

          {/* Mini map preview */}
          {location && (
            <GlassCard className="p-3">
              <div className="map-canvas topo-lines relative overflow-hidden rounded-2xl border border-white/10 h-[240px]">
                <div className="absolute inset-0 grid-lines opacity-30" />
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${location.x}%`, top: `${location.y}%` }}
                >
                  <span className="relative inline-flex h-3.5 w-3.5">
                    <span
                      className="absolute inset-0 rounded-full animate-pulse-ring"
                      style={{ background: severityColor(severity), opacity: 0.65 }}
                    />
                    <span
                      className="relative h-3.5 w-3.5 rounded-full ring-2 ring-white/40 shadow-[0_0_16px_currentColor]"
                      style={{ background: severityColor(severity), color: severityColor(severity) }}
                    />
                  </span>
                </div>
                <div className="absolute bottom-3 left-3 chip">{zoneLabel || "Pinned location"}</div>
              </div>
            </GlassCard>
          )}
        </div>
      )}
    </WizardShell>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/55">{k}</span>
      <span className={mono ? "font-mono" : ""}>{v}</span>
    </div>
  );
}

function Summary({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">Summary</span>
      </div>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </GlassCard>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-white/55">{k}</dt>
      <dd className={`text-right truncate ${mono ? "font-mono text-xs" : ""}`}>{v}</dd>
    </div>
  );
}
