"use client";

import { useEffect, useState } from "react";
import { WizardShell, type WizardStep } from "@/components/wizard/wizard";
import { SuccessScreen } from "@/components/wizard/success";
import { FieldMap } from "@/components/map/field-map";
import type { MapAnimal, MapParcel } from "@/lib/db";
import {
  Checkbox,
  ChipGroup,
  FormField,
  RadioCardGroup,
  type RadioCardOption,
  Select,
  Slider,
  Switch,
  Textarea,
  TextInput,
} from "@/components/ui/form";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { I } from "@/components/ui/icon";

const steps: WizardStep[] = [
  { id: "identity", title: "Identity",  description: "Name, ward and zone classification.", icon: <I.Tag size={20} /> },
  { id: "draw",     title: "Draw zone", description: "Click on the map to define a polygon perimeter.", icon: <I.Map size={20} /> },
  { id: "rules",    title: "Rules",     description: "Capacity, allowed species, time windows and breach behaviour.", icon: <I.Shield size={20} /> },
  { id: "notify",   title: "Notify",    description: "Who hears about events in this zone.", icon: <I.Bell size={20} /> },
  { id: "review",   title: "Review",    description: "Confirm everything before publishing.", icon: <I.Check size={20} /> },
];

const zoneTypeOptions: RadioCardOption[] = [
  { value: "Grazing",    label: "Grazing",    description: "Permitted grazing area for registered herds",      icon: <I.Cow size={20} /> },
  { value: "Restricted", label: "Restricted", description: "Off-limits — triggers immediate breach alerts",    icon: <I.Shield size={20} /> },
  { value: "Watering",   label: "Watering",   description: "Reservoirs, dams and watering points",             icon: <I.Activity size={20} /> },
  { value: "Buffer",     label: "Buffer",     description: "Soft transitional area between zones",             icon: <I.Layers size={20} /> },
  { value: "Quarantine", label: "Quarantine", description: "Disease isolation — entry/exit fully audited",     icon: <I.Stethoscope size={20} /> },
];


const speciesChips = ["Cattle", "Goat", "Sheep", "Donkey", "Pig"];

const breachActionOptions: RadioCardOption[] = [
  { value: "alert",   label: "Alert only",         description: "Notify officers, no automatic action",          icon: <I.Bell size={20} /> },
  { value: "escalate",label: "Alert + escalate",   description: "Auto-escalate after 5 min if unresolved",       icon: <I.Alert size={20} /> },
  { value: "dispatch",label: "Dispatch patrol",    description: "Auto-dispatch nearest enforcement team",         icon: <I.Shield size={20} /> },
  { value: "lockdown",label: "Lockdown",           description: "Sound siren, push to all officers, log video",   icon: <I.Activity size={20} /> },
];

type Point = [number, number];

/**
 * Area of a lon/lat ring in hectares.
 *
 * The wizard previously measured a shape drawn on a 0–100 canvas and multiplied
 * by a constant, so the hectares shown bore no relation to any real ground. This
 * is the spherical excess of the polygon on the WGS-84 mean radius — close
 * enough for a field at these scales, and it agrees with what PostGIS stores.
 */
function ringHectares(ring: Point[]) {
  if (ring.length < 3) return 0;
  const R = 6371008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    total += (rad(lng2) - rad(lng1)) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((total * R * R) / 2) / 10000;
}


export default function NewGeofencePage() {
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

  // The map draws in real coordinates, so it needs the same data the live map has.
  const [mapAnimals, setMapAnimals] = useState<MapAnimal[]>([]);
  const [mapParcels, setMapParcels] = useState<MapParcel[]>([]);
  useEffect(() => {
    let live = true;
    Promise.all([
      fetch("/api/map/animals").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/parcels").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([a, p]) => { if (live) { setMapAnimals(a); setMapParcels(p); } })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [issuedId, setIssuedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [ward, setWard] = useState("");
  const [zoneType, setZoneType] = useState("Grazing");
  const [description, setDescription] = useState("");

  const [polygon, setPolygon] = useState<Point[]>([]);

  const [capacity, setCapacity] = useState<number>(60);
  const [allowedSpecies, setAllowedSpecies] = useState<string[]>(["Cattle"]);
  const [activeStart, setActiveStart] = useState<string>("06:00");
  const [activeEnd, setActiveEnd] = useState<string>("18:00");
  const [breachAction, setBreachAction] = useState<string>("alert");
  const [autoCloseDays, setAutoCloseDays] = useState<number>(0);

  const [notifyOwners, setNotifyOwners] = useState(true);
  const [notifyOfficers, setNotifyOfficers] = useState(true);
  const [notifyVets, setNotifyVets] = useState(false);
  const [notifyChannels, setNotifyChannels] = useState<string[]>(["Push", "SMS"]);

  const hectares = Math.round(ringHectares(polygon) * 100) / 100;

  const canAdvance = () => {
    switch (stepIndex) {
      case 0: return !!name && !!ward && !!zoneType;
      case 1: return polygon.length >= 3;
      case 2: return zoneType === "Restricted" ? true : capacity > 0 && allowedSpecies.length > 0;
      case 3: return notifyChannels.length > 0;
      case 4: return true;
      default: return true;
    }
  };

  const onNext = () => setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  const onBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const onSubmit = async () => {
    setSubmitting(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/geofences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          type: zoneType.toLowerCase(),
          ward: ward || null,
          capacity: zoneType === "Restricted" ? null : capacity,
          ring: polygon,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(payload.error ?? "Could not save the zone.");
        return;
      }
      setIssuedId(payload.id);
      setSubmitted(true);
    } catch {
      setSaveError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted && issuedId) {
    return (
      <SuccessScreen
        title="Zone published"
        subtitle={`${name} is saved and the platform is monitoring this perimeter.`}
        ref={issuedId}
        details={[
          { label: "Type", value: zoneType },
          { label: "Area", value: `${hectares.toLocaleString()} ha` },
          { label: "Vertices", value: `${polygon.length}` },
        ]}
        primary={{ href: "/geofences", label: "View zones map" }}
        secondary={{ href: "/geofences/new", label: "Draw another zone" }}
      />
    );
  }

  return (
    <WizardShell
      title="Draw a new zone"
      subtitle="Define a geofence perimeter and the rules that govern animal movement inside it."
      cancelHref="/geofences"
      steps={steps}
      currentIndex={stepIndex}
      onBack={onBack}
      onNext={onNext}
      onSubmit={onSubmit}
      nextDisabled={!canAdvance()}
      submitting={submitting}
      submitLabel="Publish zone"
    >
      {stepIndex === 0 && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Zone name" required>
              <TextInput
                value={name}
                onChange={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder="Name for this zone"
                iconLeft={<I.Tag size={16} />}
              />
            </FormField>
            <FormField label="Municipal ward" required>
              <Select
                options={wardOptions}
                value={ward}
                onChange={setWard}
                placeholder="Select ward…"
              />
            </FormField>
          </div>

          <FormField label="Zone type" required>
            <RadioCardGroup
              options={zoneTypeOptions}
              value={zoneType}
              onChange={setZoneType}
              columns={3}
            />
          </FormField>

          <FormField label="Description" hint="Optional context for officers and farmers">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              placeholder="Anything special about this zone — seasonal use, terrain, infrastructure…"
            />
          </FormField>
        </div>
      )}

      {stepIndex === 1 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="aurora">{zoneType}</Badge>
            <span className="text-sm text-white/70">{name || "Unnamed zone"}</span>
            <span className="text-xs text-white/45">·</span>
            <span className="text-xs text-white/55">{ward || "—"}</span>
          </div>
          <div className="h-[420px] rounded-3xl overflow-hidden">
            <FieldMap
              animals={mapAnimals}
              parcels={mapParcels}
              drawing
              onDrawComplete={(ring) => setPolygon(ring)}
              className="h-full w-full"
            />
          </div>
          <p className="text-xs text-white/55">
            Click the map to place each corner of the perimeter. The outline closes
            automatically once you have three or more points.
          </p>
          <GlassCard tone="thin" className="p-4 grid sm:grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/45">Vertices</div>
              <div className="text-xl font-semibold mt-1">{polygon.length}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/45">Area</div>
              <div className="text-xl font-semibold mt-1">{hectares.toLocaleString()} ha</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/45">Status</div>
              <div className="text-xl font-semibold mt-1">
                {polygon.length >= 3 ? (
                  <span className="text-emerald-300">Valid</span>
                ) : (
                  <span className="text-amber-300">Drawing…</span>
                )}
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {stepIndex === 2 && (
        <div className="space-y-6">
          {zoneType !== "Restricted" && (
            <FormField
              label="Capacity"
              required
              hint={`${capacity} animals · ~${(hectares / Math.max(capacity, 1)).toFixed(1)} ha each`}
            >
              <Slider value={capacity} onChange={setCapacity} min={5} max={500} step={5} />
            </FormField>
          )}

          {zoneType !== "Restricted" && (
            <FormField label="Allowed species" required>
              <ChipGroup
                options={speciesChips.map((s) => ({ value: s, label: s }))}
                values={allowedSpecies}
                onChange={setAllowedSpecies}
              />
            </FormField>
          )}

          <div className="grid md:grid-cols-2 gap-5">
            <FormField label="Active from" hint="Local time">
              <TextInput
                type="time"
                value={activeStart}
                onChange={(e) => setActiveStart((e.target as HTMLInputElement).value)}
                iconLeft={<I.Calendar size={16} />}
              />
            </FormField>
            <FormField label="Active until" hint="Local time">
              <TextInput
                type="time"
                value={activeEnd}
                onChange={(e) => setActiveEnd((e.target as HTMLInputElement).value)}
                iconLeft={<I.Calendar size={16} />}
              />
            </FormField>
          </div>

          <FormField label="Breach behaviour" required>
            <RadioCardGroup
              options={breachActionOptions}
              value={breachAction}
              onChange={setBreachAction}
              columns={2}
            />
          </FormField>

          <FormField
            label="Auto-close after (days)"
            hint={autoCloseDays === 0 ? "Permanent zone" : `Zone retires after ${autoCloseDays} days`}
          >
            <Slider value={autoCloseDays} onChange={setAutoCloseDays} min={0} max={180} step={1} />
          </FormField>
        </div>
      )}

      {stepIndex === 3 && (
        <div className="space-y-6">
          <FormField label="Who gets notified" required>
            <div className="grid md:grid-cols-3 gap-3">
              <Checkbox
                checked={notifyOwners}
                onChange={setNotifyOwners}
                label="Affected livestock owners"
                description="Owners with animals inside or near the zone"
              />
              <Checkbox
                checked={notifyOfficers}
                onChange={setNotifyOfficers}
                label="Field officers"
                description="On-duty officers in the ward"
              />
              <Checkbox
                checked={notifyVets}
                onChange={setNotifyVets}
                label="Veterinary services"
                description="Required for quarantine zones"
              />
            </div>
          </FormField>

          <FormField label="Channels" required>
            <ChipGroup
              options={[
                { value: "Push", label: "Push" },
                { value: "SMS", label: "SMS" },
                { value: "WhatsApp", label: "WhatsApp" },
                { value: "Email", label: "Email" },
              ]}
              values={notifyChannels}
              onChange={setNotifyChannels}
            />
          </FormField>

          <GlassCard tone="thin" className="p-4 flex items-start gap-3">
            <I.Wifi size={16} className="text-cyan-300 mt-0.5 shrink-0" />
            <div className="text-xs text-white/65">
              Notifications are throttled to avoid alert fatigue: max 1 message per breach
              per hour per recipient, unless severity is High or above.
            </div>
          </GlassCard>
        </div>
      )}

      {stepIndex === 4 && (
        <div className="space-y-6">
          {saveError && (
            <GlassCard tone="thin" className="p-4 flex items-start gap-3 border-rose-400/30">
              <I.Alert size={16} className="text-rose-300 mt-0.5 shrink-0" />
              <div className="text-sm text-rose-100">{saveError}</div>
            </GlassCard>
          )}
          <div className="grid md:grid-cols-2 gap-5">
            <Summary title="Identity">
              <KV k="Name" v={name} />
              <KV k="Type" v={zoneType} />
              <KV k="Ward" v={ward} />
              <KV k="Vertices" v={`${polygon.length}`} />
            </Summary>
            <Summary title="Geometry">
              <KV k="Area" v={`${hectares.toLocaleString()} ha`} />
              <KV
                k="Centroid"
                v={
                  polygon.length
                    ? `${(polygon.reduce((s, p) => s + p[0], 0) / polygon.length).toFixed(1)}°E · ${(
                        polygon.reduce((s, p) => s + p[1], 0) / polygon.length
                      ).toFixed(1)}°S`
                    : "—"
                }
                mono
              />
              <KV k="Active window" v={`${activeStart} – ${activeEnd}`} mono />
              <KV k="Auto-close" v={autoCloseDays === 0 ? "Never" : `${autoCloseDays} days`} />
            </Summary>
            <Summary title="Rules">
              {zoneType !== "Restricted" && <KV k="Capacity" v={`${capacity} head`} />}
              {zoneType !== "Restricted" && <KV k="Species" v={allowedSpecies.join(", ") || "—"} />}
              <KV k="Breach action" v={breachAction} />
            </Summary>
            <Summary title="Notifications">
              <KV k="Owners" v={notifyOwners ? "On" : "Off"} />
              <KV k="Officers" v={notifyOfficers ? "On" : "Off"} />
              <KV k="Vets" v={notifyVets ? "On" : "Off"} />
              <KV k="Channels" v={notifyChannels.join(", ")} />
            </Summary>
          </div>

          {/* Map preview */}
          <GlassCard className="p-3">
            <div className="map-canvas topo-lines relative overflow-hidden rounded-2xl border border-white/10 h-[320px]">
              <div className="absolute inset-0 grid-lines opacity-30" />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                {polygon.length >= 3 && (
                  <polygon
                    points={polygon.map((p) => p.join(",")).join(" ")}
                    fill={
                      zoneType === "Restricted"
                        ? "rgba(255,107,107,0.30)"
                        : zoneType === "Watering"
                          ? "rgba(91,231,255,0.30)"
                          : zoneType === "Buffer"
                            ? "rgba(255,181,71,0.30)"
                            : zoneType === "Quarantine"
                              ? "rgba(140,124,255,0.30)"
                              : "rgba(0,245,160,0.30)"
                    }
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="0.35"
                  />
                )}
              </svg>
              <div className="absolute bottom-3 left-3 chip">{name || "Unnamed zone"} · {hectares.toLocaleString()} ha</div>
            </div>
          </GlassCard>

          <GlassCard tone="veld" className="p-5 flex flex-wrap items-center gap-3">
            <Badge tone="aurora" dot>Ready to publish</Badge>
            <span className="text-sm text-white/75">
              The zone will go live immediately and start producing real-time alerts.
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-white/55">
              <div className="flex items-center gap-1.5"><I.Shield size={12} /> Audit trail</div>
              <div className="flex items-center gap-1.5"><Switch checked={true} onChange={() => {}} /> Activate now</div>
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
