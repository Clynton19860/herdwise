"use client";

import { useEffect, useState } from "react";
import { WizardShell, type WizardStep } from "@/components/wizard/wizard";
import { SuccessScreen } from "@/components/wizard/success";
import { PhotoUpload, type UploadedPhoto } from "@/components/wizard/photo-upload";
import {
  Checkbox,
  ChipGroup,
  FormField,
  RadioCardGroup,
  type RadioCardOption,
  Select,
  Switch,
  Textarea,
  TextInput,
} from "@/components/ui/form";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";

const steps: WizardStep[] = [
  { id: "identity",   title: "Identity",     description: "Legal name, date of birth and national ID.",        icon: <I.Users size={20} /> },
  { id: "contact",    title: "Contact",      description: "Reach the farmer for alerts and notices.",          icon: <I.Bell size={20} /> },
  { id: "location",   title: "Location",     description: "Where the herd lives — used for ward enforcement.", icon: <I.Pin size={20} /> },
  { id: "operation",  title: "Operation",    description: "What species and how the herd is managed.",         icon: <I.Cow size={20} /> },
  { id: "verify",     title: "Verification", description: "Upload ID document & confirm declarations.",        icon: <I.Shield size={20} /> },
  { id: "review",     title: "Review",       description: "Confirm details to issue the farmer profile.",      icon: <I.Check size={20} /> },
];

const genderOptions: RadioCardOption[] = [
  { value: "Female", label: "Female", icon: <I.Heart size={18} /> },
  { value: "Male",   label: "Male",   icon: <I.Activity size={18} /> },
  { value: "Other",  label: "Prefer not to say", icon: <I.Users size={18} /> },
];


const speciesChips = ["Cattle", "Goat", "Sheep", "Donkey", "Pig", "Poultry"];

const operationOptions: RadioCardOption[] = [
  { value: "Smallholder", label: "Smallholder",    description: "< 20 head · subsistence + market", icon: <I.Cow size={20} /> },
  { value: "Commercial",  label: "Commercial",     description: "Registered livestock business",    icon: <I.Activity size={20} /> },
  { value: "Communal",    label: "Communal",       description: "Shared communal grazing",          icon: <I.Users size={20} /> },
  { value: "Cooperative", label: "Cooperative",    description: "Member of a livestock co-op",      icon: <I.Layers size={20} /> },
];

const channels = [
  { value: "SMS",      label: "SMS" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Voice",    label: "Voice call" },
  { value: "Email",    label: "Email" },
];

const validZimNID = (v: string) =>
  /^\d{2}-\d{6,7}-[A-Z]-\d{2}$/.test(v.trim().toUpperCase());
const validZimPhone = (v: string) =>
  /^(\+263|0)\s?(7\d|8\d)\s?\d{3}\s?\d{4}$/.test(v.trim());

export default function RegisterOwnerPage() {
  // Wards come from the database. A picker that offers wards which are not
  // registered produces records that cannot be linked to anything.
  const [wardOptions, setWardOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    let live = true;
    fetch("/api/wards")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { name: string }[]) => {
        if (live) setWardOptions(rows.map((w) => ({ value: w.name, label: w.name })));
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [issuedId, setIssuedId] = useState<string | null>(null);

  /* ---------- State ---------- */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [nid, setNid] = useState("");

  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contactPref, setContactPref] = useState<string[]>(["SMS", "WhatsApp"]);

  const [ward, setWard] = useState("");
  const [village, setVillage] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState("");
  const [useGps, setUseGps] = useState(true);

  const [operation, setOperation] = useState("Smallholder");
  const [speciesKept, setSpeciesKept] = useState<string[]>([]);
  const [estimatedHerd, setEstimatedHerd] = useState("");

  const [idPhotos, setIdPhotos] = useState<UploadedPhoto[]>([]);
  const [declare1, setDeclare1] = useState(false);
  const [declare2, setDeclare2] = useState(false);

  /* ---------- Derived validation ---------- */
  const canAdvance = () => {
    switch (stepIndex) {
      case 0: return !!firstName && !!lastName && !!gender && !!dob && validZimNID(nid);
      case 1: return validZimPhone(phone) && contactPref.length > 0;
      case 2: return !!ward && !!village;
      case 3: return !!operation && speciesKept.length > 0 && Number(estimatedHerd) > 0;
      case 4: return idPhotos.length >= 1 && declare1 && declare2;
      case 5: return true;
      default: return true;
    }
  };

  const onNext = () => setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  const onBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const onSubmit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1300));
    setIssuedId(`OWN-${Date.now().toString().slice(-6)}`);
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted && issuedId) {
    return (
      <SuccessScreen
        title="Owner registered"
        subtitle={`${firstName} ${lastName} is now a verified livestock owner in ${ward}.`}
        ref={issuedId}
        details={[
          { label: "Owner ID", value: issuedId },
          { label: "Ward", value: ward },
          { label: "Estimated herd", value: `${estimatedHerd} head` },
        ]}
        primary={{ href: "/owners", label: "View owners directory" }}
        secondary={{ href: "/livestock/new", label: "Register their first animal" }}
      />
    );
  }

  return (
    <WizardShell
      title="Register owner"
      subtitle="Onboard a verified livestock owner under the City of Harare farmer registry."
      cancelHref="/owners"
      steps={steps}
      currentIndex={stepIndex}
      onBack={onBack}
      onNext={onNext}
      onSubmit={onSubmit}
      nextDisabled={!canAdvance()}
      submitting={submitting}
      submitLabel="Issue farmer profile"
    >
      {stepIndex === 0 && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="First name" required>
              <TextInput
                value={firstName}
                onChange={(e) => setFirstName((e.target as HTMLInputElement).value)}
                placeholder="e.g. Tendai"
              />
            </FormField>
            <FormField label="Surname" required>
              <TextInput
                value={lastName}
                onChange={(e) => setLastName((e.target as HTMLInputElement).value)}
                placeholder="e.g. Mhofu"
              />
            </FormField>
          </div>

          <FormField label="Gender" required>
            <RadioCardGroup
              options={genderOptions}
              value={gender}
              onChange={setGender}
              columns={3}
            />
          </FormField>

          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Date of birth" required>
              <TextInput
                type="date"
                value={dob}
                onChange={(e) => setDob((e.target as HTMLInputElement).value)}
              />
            </FormField>
            <FormField
              label="Zimbabwean national ID"
              required
              hint="Format 00-0000000-X-00"
              error={nid && !validZimNID(nid) ? "Doesn’t match the national ID format" : undefined}
            >
              <TextInput
                value={nid}
                onChange={(e) => setNid((e.target as HTMLInputElement).value.toUpperCase())}
                placeholder="63-1928374-K-12"
                iconLeft={<I.Tag size={16} />}
                invalid={!!nid && !validZimNID(nid)}
              />
            </FormField>
          </div>

          <GlassCard tone="thin" className="p-4 flex items-start gap-3">
            <I.Shield size={16} className="text-emerald-300 mt-0.5 shrink-0" />
            <div className="text-xs text-white/65">
              National ID is cross-checked against the Zimbabwe Registrar General API
              when Supabase is connected. Until then, format is validated locally.
            </div>
          </GlassCard>
        </div>
      )}

      {stepIndex === 1 && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <FormField
              label="Primary phone"
              required
              hint="+263 7X XXX XXXX"
              error={phone && !validZimPhone(phone) ? "Invalid Zimbabwean mobile" : undefined}
            >
              <TextInput
                value={phone}
                onChange={(e) => setPhone((e.target as HTMLInputElement).value)}
                placeholder="+263 77 412 8821"
                iconLeft={<I.Bell size={16} />}
                invalid={!!phone && !validZimPhone(phone)}
              />
            </FormField>
            <FormField label="Alternative phone" hint="Optional">
              <TextInput
                value={altPhone}
                onChange={(e) => setAltPhone((e.target as HTMLInputElement).value)}
                placeholder="+263 71 …"
                iconLeft={<I.Bell size={16} />}
              />
            </FormField>
          </div>

          <FormField label="Email" hint="For digital certificates and statements">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder="owner@example.com"
            />
          </FormField>

          <FormField label="Preferred channels" required>
            <ChipGroup
              options={channels}
              values={contactPref}
              onChange={setContactPref}
            />
          </FormField>

          <GlassCard tone="thin" className="p-4 flex items-start gap-3">
            <I.Wifi size={16} className="text-cyan-300 mt-0.5 shrink-0" />
            <div className="text-xs text-white/65">
              Outgoing notifications respect the farmer&rsquo;s ordering — primary then
              fallback. WhatsApp messages use the Cloud API when available, with
              automatic SMS failover.
            </div>
          </GlassCard>
        </div>
      )}

      {stepIndex === 2 && (
        <div className="space-y-6">
          <FormField label="Municipal ward" required>
            <Select
              options={wardOptions}
              value={ward}
              onChange={setWard}
              placeholder="Select ward…"
            />
          </FormField>

          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Village / suburb" required>
              <TextInput
                value={village}
                onChange={(e) => setVillage((e.target as HTMLInputElement).value)}
                placeholder="e.g. Hatcliffe Extension"
                iconLeft={<I.Pin size={16} />}
              />
            </FormField>
            <FormField label="GPS coordinates" hint="Auto-captured from field-officer phone">
              <TextInput
                value={coords}
                onChange={(e) => setCoords((e.target as HTMLInputElement).value)}
                placeholder="-17.7847, 31.0488"
                iconLeft={<I.Map size={16} />}
                disabled={useGps}
              />
            </FormField>
          </div>

          <FormField label="Street / homestead address">
            <Textarea
              rows={3}
              value={address}
              onChange={(e) => setAddress((e.target as HTMLTextAreaElement).value)}
              placeholder="Plot number, street, landmark…"
            />
          </FormField>

          <GlassCard className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Auto-capture GPS from device</div>
              <div className="text-xs text-white/55">
                Officer app reads location when signing the farmer up on-site.
              </div>
            </div>
            <Switch checked={useGps} onChange={setUseGps} />
          </GlassCard>
        </div>
      )}

      {stepIndex === 3 && (
        <div className="space-y-6">
          <FormField label="Operation type" required>
            <RadioCardGroup
              options={operationOptions}
              value={operation}
              onChange={setOperation}
              columns={4}
            />
          </FormField>

          <FormField label="Species kept" required hint="All that apply">
            <ChipGroup
              options={speciesChips.map((s) => ({ value: s, label: s }))}
              values={speciesKept}
              onChange={setSpeciesKept}
            />
          </FormField>

          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Estimated herd size" required hint="All species combined">
              <TextInput
                type="number"
                min={1}
                value={estimatedHerd}
                onChange={(e) => setEstimatedHerd((e.target as HTMLInputElement).value)}
                placeholder="e.g. 24"
                iconRight={<span className="text-xs text-white/50">head</span>}
              />
            </FormField>
            <FormField label="Years farming" hint="Optional">
              <TextInput
                type="number"
                min={0}
                placeholder="e.g. 14"
                iconRight={<span className="text-xs text-white/50">yrs</span>}
              />
            </FormField>
          </div>
        </div>
      )}

      {stepIndex === 4 && (
        <div className="space-y-6">
          <FormField label="National ID photographs" required hint="Front of ID is mandatory; back optional">
            <PhotoUpload photos={idPhotos} onChange={setIdPhotos} max={2} />
          </FormField>

          <div className="space-y-2">
            <Checkbox
              checked={declare1}
              onChange={setDeclare1}
              label="I declare that the information above is true and correct."
              description="False declarations may result in deregistration under the Livestock By-law (2024)."
            />
            <Checkbox
              checked={declare2}
              onChange={setDeclare2}
              label="I consent to municipal monitoring and animal tracking on my behalf."
              description="My livestock data will be processed under Zimbabwe&rsquo;s Data Protection Act."
            />
          </div>

          <GlassCard tone="thin" className="p-4 flex items-start gap-3">
            <I.Shield size={16} className="text-emerald-300 mt-0.5 shrink-0" />
            <div className="text-xs text-white/65">
              Once submitted, a verification officer in the ward sub-office reviews the
              file. Most owners are approved within 24 hours and receive a registration
              certificate via WhatsApp.
            </div>
          </GlassCard>
        </div>
      )}

      {stepIndex === 5 && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <Summary title="Identity">
              <KV k="Name" v={`${firstName} ${lastName}`} />
              <KV k="Gender" v={gender} />
              <KV k="Date of birth" v={dob} mono />
              <KV k="National ID" v={nid} mono />
            </Summary>
            <Summary title="Contact">
              <KV k="Primary phone" v={phone} mono />
              <KV k="Alt phone" v={altPhone || "—"} mono />
              <KV k="Email" v={email || "—"} />
              <KV k="Channels" v={contactPref.join(", ")} />
            </Summary>
            <Summary title="Location">
              <KV k="Ward" v={ward} />
              <KV k="Village" v={village} />
              <KV k="GPS" v={useGps ? "Auto-capture" : coords || "—"} mono />
              <KV k="Address" v={address || "—"} />
            </Summary>
            <Summary title="Operation">
              <KV k="Type" v={operation} />
              <KV k="Species" v={speciesKept.join(", ") || "—"} />
              <KV k="Estimated herd" v={`${estimatedHerd} head`} />
              <KV k="ID photos" v={`${idPhotos.length} uploaded`} />
            </Summary>
          </div>

          <GlassCard tone="veld" className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="aurora" dot>Ready to issue</Badge>
              <span className="text-sm text-white/75">
                A registration certificate will be issued and a welcome message dispatched.
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-white/55">
                <div className="flex items-center gap-1.5"><I.Activity size={12} /> Ledger entry</div>
                <div className="flex items-center gap-1.5"><I.Bell size={12} /> {contactPref.length} channels</div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </WizardShell>
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
