"use client";

import { useMemo, useState } from "react";
import { WizardShell, type WizardStep } from "@/components/wizard/wizard";
import { SuccessScreen } from "@/components/wizard/success";
import { PhotoUpload, type UploadedPhoto } from "@/components/wizard/photo-upload";
import {
  ChipGroup,
  Checkbox,
  FormField,
  RadioCardGroup,
  type RadioCardOption,
  SearchPicker,
  Select,
  Slider,
  Switch,
  Textarea,
  TextInput,
} from "@/components/ui/form";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { I } from "@/components/ui/icon";
import type { Owner } from "@/lib/types";

/* ---------- Static option sets ---------- */

const speciesOptions: RadioCardOption[] = [
  { value: "Cattle", label: "Cattle", description: "Bovine livestock (cows, bulls, oxen)", icon: <I.Cow size={20} /> },
  { value: "Goat",   label: "Goat",   description: "Indigenous & exotic goat breeds",     icon: <I.Cow size={20} /> },
  { value: "Sheep",  label: "Sheep",  description: "Wool & meat breeds",                  icon: <I.Cow size={20} /> },
  { value: "Donkey", label: "Donkey", description: "Working & draught animals",           icon: <I.Cow size={20} /> },
  { value: "Pig",    label: "Pig",    description: "Domestic pig",                        icon: <I.Cow size={20} /> },
];

const breedsBySpecies: Record<string, string[]> = {
  Cattle: ["Mashona", "Brahman", "Tuli", "Boran", "Hereford", "Nguni", "Afrikaner", "Simmental"],
  Goat:   ["Mashona", "Boer", "Kalahari Red", "Matabele"],
  Sheep:  ["Dorper", "Sabi", "Black Head Persian", "Merino"],
  Donkey: ["Local", "Poitou"],
  Pig:    ["Large White", "Landrace", "Duroc", "Indigenous"],
};

const colorChips = ["Black", "White", "Brown", "Russet", "Tan", "Red", "Grey", "Mottled", "Black-white", "Red-white"];

const deviceOptions: RadioCardOption[] = [
  { value: "Smart Collar", label: "Smart Collar", description: "GPS + health telemetry · best for cattle", icon: <I.Wifi size={20} /> },
  { value: "AirTag",       label: "AirTag",       description: "Apple Find My ecosystem · low-power",      icon: <I.Pin size={20} /> },
  { value: "Ear Tag",      label: "Smart Ear Tag", description: "RFID + GPS for small ruminants",          icon: <I.Tag size={20} /> },
  { value: "None",         label: "No device (yet)", description: "Register the animal — pair later",      icon: <I.Plus size={20} /> },
];

const vaccinationTypes = [
  { value: "FMD",       label: "Foot-and-Mouth (FMD)" },
  { value: "Anthrax",   label: "Anthrax" },
  { value: "Brucellosis", label: "Brucellosis" },
  { value: "Rabies",    label: "Rabies" },
  { value: "Lumpy Skin", label: "Lumpy Skin Disease" },
  { value: "Deworming", label: "Routine deworming" },
];

const steps: WizardStep[] = [
  { id: "owner",   title: "Owner",       description: "Link this animal to a registered livestock owner.", icon: <I.Users size={20} /> },
  { id: "ident",   title: "Identity",    description: "Species, breed, sex and biographical data.",        icon: <I.Cow size={20} /> },
  { id: "phys",    title: "Physical",    description: "Weight, color and distinctive features.",           icon: <I.Heart size={20} /> },
  { id: "device",  title: "Device",      description: "Pair a tracker or skip to add later.",              icon: <I.Wifi size={20} /> },
  { id: "vax",     title: "Vaccinations", description: "Existing vaccination & treatment history.",        icon: <I.Stethoscope size={20} /> },
  { id: "review",  title: "Review",      description: "Confirm details — a registration certificate will be issued.", icon: <I.Shield size={20} /> },
];

type VaxEntry = { id: string; type: string; date: string; vet: string };

/* ---------- Tag generator ---------- */

const speciesCode: Record<string, string> = {
  Cattle: "CTL",
  Goat:   "GTS",
  Sheep:  "SHP",
  Donkey: "DNK",
  Pig:    "PIG",
};

function generateTag(species: string) {
  const code = speciesCode[species] || "ANI";
  const n = 400 + Math.floor(Math.random() * 99);
  return `HRE-${code}-${String(n).padStart(5, "0")}`;
}

export function RegisterAnimalForm({ owners }: { owners: Owner[] }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [issuedTag, setIssuedTag] = useState<string | null>(null);

  // Form state
  const [ownerId, setOwnerId] = useState<string>("");
  const [species, setSpecies] = useState<string>("Cattle");
  const [breed, setBreed] = useState<string>("");
  const [sex, setSex] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [ageMonths, setAgeMonths] = useState<number>(24);
  const [dob, setDob] = useState<string>("");
  const [colors, setColors] = useState<string[]>([]);
  const [weightKg, setWeightKg] = useState<string>("");
  const [heightCm, setHeightCm] = useState<string>("");
  const [marks, setMarks] = useState<string>("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const [deviceType, setDeviceType] = useState<string>("Smart Collar");
  const [deviceSerial, setDeviceSerial] = useState<string>("");
  const [deviceScanned, setDeviceScanned] = useState<boolean>(false);

  const [vax, setVax] = useState<VaxEntry[]>([]);
  const [vaxType, setVaxType] = useState<string>("");
  const [vaxDate, setVaxDate] = useState<string>("");
  const [vaxVet, setVaxVet] = useState<string>("");

  const [consent, setConsent] = useState<boolean>(false);

  const owner = owners.find((o) => o.id === ownerId) || null;
  const breedOptions = useMemo(
    () => (breedsBySpecies[species] || []).map((b) => ({ value: b, label: b })),
    [species]
  );

  /* ---------- Validation per step ---------- */
  const canAdvance = () => {
    switch (stepIndex) {
      case 0: return !!ownerId;
      case 1: return !!species && !!breed && !!sex && ageMonths > 0;
      case 2: return !!weightKg && Number(weightKg) > 0 && colors.length > 0;
      case 3: return deviceType === "None" ? true : (deviceSerial.trim().length >= 4);
      case 4: return true;
      case 5: return consent;
      default: return true;
    }
  };

  const onNext = () => setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  const onBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const onSubmit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1300));
    setIssuedTag(generateTag(species));
    setSubmitting(false);
    setSubmitted(true);
  };

  /* ---------- Vaccination CRUD ---------- */
  const addVax = () => {
    if (!vaxType || !vaxDate) return;
    setVax((v) => [
      ...v,
      { id: `vax-${Math.random().toString(36).slice(2, 8)}`, type: vaxType, date: vaxDate, vet: vaxVet || "Field clinic" },
    ]);
    setVaxType("");
    setVaxDate("");
    setVaxVet("");
  };

  if (submitted && issuedTag) {
    return (
      <SuccessScreen
        title="Animal registered"
        subtitle={`${name || "The animal"} is now part of the Harare livestock ledger and linked to ${owner?.fullName}.`}
        ref={issuedTag}
        details={[
          { label: "Tag", value: issuedTag },
          { label: "Owner", value: owner?.fullName ?? "—" },
          { label: "Device", value: deviceType === "None" ? "Not paired" : `${deviceType} · ${deviceSerial}` },
        ]}
        primary={{ href: "/livestock", label: "View registry", icon: <I.ArrowRight /> }}
        secondary={{ href: "/livestock/new", label: "Register another" }}
      />
    );
  }

  return (
    <WizardShell
      title="Register animal"
      subtitle="Issue a unique tag and bring a new animal under municipal protection."
      cancelHref="/livestock"
      steps={steps}
      currentIndex={stepIndex}
      onBack={onBack}
      onNext={onNext}
      onSubmit={onSubmit}
      nextDisabled={!canAdvance()}
      submitting={submitting}
      submitLabel="Issue registration"
    >
      {stepIndex === 0 && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <div>
            <FormField label="Search owners" hint={`${owners.length} registered`}>
              <SearchPicker
                items={owners}
                value={owner}
                onChange={(o) => setOwnerId(o.id)}
                getId={(o) => o.id}
                getLabel={(o) => o.fullName}
                getDescription={(o) => `${o.ward} · ${o.phone} · ${o.herdSize} head`}
                placeholder="Search by name, phone or ward…"
              />
            </FormField>
          </div>
          <div className="space-y-3">
            <GlassCard className="p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-white/45">Quick action</div>
              <p className="text-sm text-white/75 mt-1">
                Don&rsquo;t see them? Onboard a new farmer in under 60 seconds.
              </p>
              <LinkButton href="/owners/new" variant="glass" size="sm" className="mt-3 w-full" iconLeft={<I.Plus size={14} />}>
                Register new owner
              </LinkButton>
            </GlassCard>
            {owner && (
              <GlassCard tone="veld" className="p-5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-200">Selected owner</div>
                <div className="mt-2 text-lg font-semibold">{owner.fullName}</div>
                <div className="text-xs text-white/65">{owner.ward}</div>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <Row k="National ID" v={owner.nationalId} mono />
                  <Row k="Phone" v={owner.phone} mono />
                  <Row k="Herd size" v={`${owner.herdSize}`} />
                </dl>
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {stepIndex === 1 && (
        <div className="space-y-6">
          <FormField label="Species" required>
            <RadioCardGroup
              options={speciesOptions}
              value={species}
              onChange={(v) => {
                setSpecies(v);
                setBreed(""); // reset breed when species changes
              }}
              columns={3}
            />
          </FormField>

          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Breed" required>
              <Select
                options={breedOptions}
                value={breed}
                onChange={setBreed}
                placeholder="Select breed…"
              />
            </FormField>

            <FormField label="Sex" required>
              <RadioCardGroup
                options={[
                  { value: "Female", label: "Female", icon: <I.Heart size={18} /> },
                  { value: "Male", label: "Male", icon: <I.Activity size={18} /> },
                ]}
                value={sex}
                onChange={setSex}
                columns={2}
              />
            </FormField>

            <FormField label="Name / nickname" hint="Optional">
              <TextInput
                placeholder="e.g. Mvura"
                value={name}
                onChange={(e) => setName((e.target as HTMLInputElement).value)}
              />
            </FormField>

            <FormField label="Date of birth" hint="If known">
              <TextInput
                type="date"
                value={dob}
                onChange={(e) => setDob((e.target as HTMLInputElement).value)}
              />
            </FormField>
          </div>

          <FormField
            label="Age (months)"
            required
            hint={`${ageMonths} months · approx. ${Math.floor(ageMonths / 12)}y ${ageMonths % 12}m`}
          >
            <Slider value={ageMonths} onChange={setAgeMonths} min={1} max={240} step={1} />
          </FormField>
        </div>
      )}

      {stepIndex === 2 && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Weight (kg)" required>
              <TextInput
                type="number"
                min={1}
                placeholder="e.g. 412"
                value={weightKg}
                onChange={(e) => setWeightKg((e.target as HTMLInputElement).value)}
                iconRight={<span className="text-xs text-white/50">kg</span>}
              />
            </FormField>
            <FormField label="Height at withers (cm)" hint="Optional">
              <TextInput
                type="number"
                min={1}
                placeholder="e.g. 135"
                value={heightCm}
                onChange={(e) => setHeightCm((e.target as HTMLInputElement).value)}
                iconRight={<span className="text-xs text-white/50">cm</span>}
              />
            </FormField>
          </div>

          <FormField label="Coat colors" required hint="Pick all that apply">
            <ChipGroup
              options={colorChips.map((c) => ({ value: c, label: c }))}
              values={colors}
              onChange={setColors}
            />
          </FormField>

          <FormField label="Distinguishing marks" hint="Scars, brands, ear notches, horn shape">
            <Textarea
              placeholder="Describe any features that would help identify this animal in the field…"
              value={marks}
              onChange={(e) => setMarks((e.target as HTMLTextAreaElement).value)}
            />
          </FormField>

          <FormField
            label="Photographs"
            hint="Capture left side, right side, face and any distinctive marks"
          >
            <PhotoUpload photos={photos} onChange={setPhotos} max={6} />
          </FormField>
        </div>
      )}

      {stepIndex === 3 && (
        <div className="space-y-6">
          <FormField label="Tracking device" required>
            <RadioCardGroup
              options={deviceOptions}
              value={deviceType}
              onChange={(v) => {
                setDeviceType(v);
                setDeviceScanned(false);
                setDeviceSerial("");
              }}
              columns={4}
            />
          </FormField>

          {deviceType !== "None" && (
            <div className="grid lg:grid-cols-[1fr_320px] gap-5">
              <FormField label="Device serial / IMEI" required>
                <TextInput
                  placeholder="e.g. SC-X204-118"
                  value={deviceSerial}
                  onChange={(e) => setDeviceSerial((e.target as HTMLInputElement).value)}
                  iconLeft={<I.Tag size={16} />}
                />
              </FormField>
              <GlassCard className="p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-white/45">Scan to pair</div>
                <p className="text-sm text-white/75 mt-1.5">
                  Use the field officer app to scan the device QR — the serial will populate automatically.
                </p>
                <Button
                  variant="glass"
                  size="sm"
                  className="mt-3 w-full"
                  iconLeft={<I.Sparkle size={14} />}
                  onClick={() => {
                    const fake = `SC-X204-${100 + Math.floor(Math.random() * 899)}`;
                    setDeviceSerial(fake);
                    setDeviceScanned(true);
                  }}
                >
                  Open scanner
                </Button>
                {deviceScanned && (
                  <div className="mt-3 text-[11px] text-emerald-200 flex items-center gap-1.5">
                    <I.Check size={12} /> Paired from QR scan
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {deviceType !== "None" && (
            <div className="grid md:grid-cols-3 gap-3">
              <Pulse label="Signal" value="Strong" tone="text-emerald-300" hint="-62 dBm" />
              <Pulse label="Battery" value="—" tone="text-white/40" hint="Reported after pairing" />
              <Pulse label="Last sync" value="just now" tone="text-cyan-300" hint="MQTT · ingest-3" />
            </div>
          )}
        </div>
      )}

      {stepIndex === 4 && (
        <div className="space-y-6">
          <GlassCard className="p-5">
            <div className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
              <FormField label="Vaccination">
                <Select
                  options={vaccinationTypes}
                  value={vaxType}
                  onChange={setVaxType}
                  placeholder="Select…"
                />
              </FormField>
              <FormField label="Date">
                <TextInput
                  type="date"
                  value={vaxDate}
                  onChange={(e) => setVaxDate((e.target as HTMLInputElement).value)}
                />
              </FormField>
              <FormField label="Veterinarian">
                <TextInput
                  placeholder="e.g. Dr. R. Chivasa"
                  value={vaxVet}
                  onChange={(e) => setVaxVet((e.target as HTMLInputElement).value)}
                  iconLeft={<I.Stethoscope size={16} />}
                />
              </FormField>
              <Button onClick={addVax} disabled={!vaxType || !vaxDate} iconLeft={<I.Plus size={14} />}>
                Add
              </Button>
            </div>
          </GlassCard>

          {vax.length === 0 ? (
            <div className="glass-thin rounded-2xl p-5 text-center text-sm text-white/55">
              No vaccinations recorded yet — that&rsquo;s fine, you can add these later.
            </div>
          ) : (
            <ul className="space-y-2">
              {vax.map((v) => (
                <li key={v.id} className="glass-thin rounded-2xl p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl glass-thin grid place-items-center text-emerald-300">
                    <I.Shield size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{v.type}</div>
                    <div className="text-xs text-white/55">{v.vet}</div>
                  </div>
                  <div className="text-xs font-mono text-white/70">{v.date}</div>
                  <button
                    onClick={() => setVax((all) => all.filter((x) => x.id !== v.id))}
                    className="h-9 w-9 rounded-xl glass-thin text-white/55 hover:text-rose-300 grid place-items-center transition-colors"
                    aria-label="Remove"
                  >
                    <I.X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <GlassCard tone="thin" className="p-4 flex items-start gap-3">
            <I.Sparkle size={16} className="text-emerald-300 mt-0.5 shrink-0" />
            <div className="text-xs text-white/65">
              An automatic reminder will be scheduled for the next due dose. Owners receive
              SMS, WhatsApp and in-app push 72 hours before the appointment.
            </div>
          </GlassCard>
        </div>
      )}

      {stepIndex === 5 && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <Summary title="Owner">
              <KV k="Name" v={owner?.fullName ?? "—"} />
              <KV k="National ID" v={owner?.nationalId ?? "—"} mono />
              <KV k="Phone" v={owner?.phone ?? "—"} mono />
              <KV k="Ward" v={owner?.ward ?? "—"} />
            </Summary>
            <Summary title="Identity">
              <KV k="Species" v={species} />
              <KV k="Breed" v={breed} />
              <KV k="Sex" v={sex} />
              <KV k="Age" v={`${ageMonths} months`} />
              <KV k="Name" v={name || "—"} />
              <KV k="DOB" v={dob || "—"} mono />
            </Summary>
            <Summary title="Physical">
              <KV k="Weight" v={`${weightKg || "—"} kg`} />
              <KV k="Height" v={heightCm ? `${heightCm} cm` : "—"} />
              <KV k="Colors" v={colors.join(", ") || "—"} />
              <KV k="Photos" v={`${photos.length} attached`} />
            </Summary>
            <Summary title="Device & health">
              <KV k="Device" v={deviceType} />
              <KV k="Serial" v={deviceType === "None" ? "—" : deviceSerial} mono />
              <KV k="Vaccinations" v={`${vax.length} on record`} />
              <KV k="Marks" v={marks ? `${marks.slice(0, 40)}${marks.length > 40 ? "…" : ""}` : "—"} />
            </Summary>
          </div>

          <GlassCard tone="veld" className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Badge tone="aurora" dot>Compliance</Badge>
              <h3 className="text-base font-semibold">Owner declaration</h3>
            </div>
            <Checkbox
              checked={consent}
              onChange={setConsent}
              label="I confirm the animal data is accurate and consent to municipal monitoring."
              description="A digital registration certificate will be issued and emailed/SMS&rsquo;d to the owner. This action is recorded in the tamper-resistant audit log."
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/55">
              <div className="flex items-center gap-1.5"><I.Shield size={12} /> RLS-secured write</div>
              <div className="flex items-center gap-1.5"><I.Activity size={12} /> Ledger entry queued</div>
              <div className="flex items-center gap-1.5"><Switch checked={true} onChange={() => {}} /> Notify owner</div>
            </div>
          </GlassCard>
        </div>
      )}
    </WizardShell>
  );
}

/* ---------- Small helpers ---------- */

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
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

function Pulse({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: string;
  hint: string;
}) {
  return (
    <div className="glass-thin rounded-2xl p-4 flex items-center gap-3">
      <span className="relative inline-flex h-2.5 w-2.5">
        <span className={`absolute inset-0 rounded-full ${tone.replace("text-", "bg-")} opacity-60 animate-pulse-ring`} />
        <span className={`relative h-2.5 w-2.5 rounded-full ${tone.replace("text-", "bg-")} shadow-[0_0_10px_currentColor]`} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">{label}</div>
        <div className={`text-sm font-medium ${tone}`}>{value}</div>
        <div className="text-[10px] text-white/40">{hint}</div>
      </div>
    </div>
  );
}
