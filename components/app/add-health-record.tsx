"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

const TYPES = [
  { value: "vaccination", label: "Vaccination" },
  { value: "treatment", label: "Treatment" },
  { value: "diagnosis", label: "Diagnosis" },
  { value: "inspection", label: "Inspection" },
  { value: "quarantine", label: "Quarantine" },
];

/**
 * Recording a vaccination, treatment, diagnosis, inspection or quarantine.
 *
 * The button for this existed on the animal page for months and did nothing.
 * The table and the endpoint were both already there — only the form was
 * missing, so a vet could see every health record the platform held and had no
 * way to add one.
 *
 * The follow-up date only appears for a vaccination, because it is the only
 * kind that has one: the health dashboard is built almost entirely on
 * `next_due_on`, and offering the field for a diagnosis invites somebody to
 * fill it in with something that then drives a reminder nobody meant.
 */
export function AddHealthRecord({ animalId, tag }: { animalId: string; tag: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("vaccination");
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [nextDueOn, setNextDueOn] = useState("");
  const [description, setDescription] = useState("");
  const [medicine, setMedicine] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/health-records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          animalId, type, occurredOn, description,
          medicine: medicine || null,
          nextDueOn: type === "vaccination" && nextDueOn ? nextDueOn : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not save this record."); return; }
      setOpen(false);
      setDescription("");
      setMedicine("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 w-full h-11 rounded-2xl px-3.5 glass-thin bg-transparent outline-none text-sm " +
    "focus:ring-2 focus:ring-emerald-400/40";

  if (!open) {
    return (
      <Button size="sm" variant="primary" iconLeft={<I.Plus size={14} />} onClick={() => setOpen(true)}>
        New health record
      </Button>
    );
  }

  return (
    <form onSubmit={save} className="glass-solid rounded-3xl p-5 w-full max-w-lg space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">Health record for {tag}</h3>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          aria-label="Cancel"
          className="h-8 w-8 grid place-items-center rounded-xl text-white/55 hover:text-white hover:bg-white/8 transition-colors"
        >
          <I.X size={16} />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="block">
          <span className="text-xs text-white/55">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-white/55">Date</span>
          <input
            type="date" required value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)} className={field}
          />
        </label>

        {type === "vaccination" && (
          <label className="block">
            <span className="text-xs text-white/55">Next due</span>
            <input
              type="date" value={nextDueOn}
              onChange={(e) => setNextDueOn(e.target.value)} className={field}
            />
            <span className="mt-1 block text-[11px] text-white/40">
              Drives the reminder on the health dashboard
            </span>
          </label>
        )}

        <label className="block">
          <span className="text-xs text-white/55">Medicine</span>
          <input
            value={medicine} onChange={(e) => setMedicine(e.target.value)}
            placeholder="Optional" className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-white/55">What was done</span>
        <textarea
          required rows={2} value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enough that somebody reading this in a year knows what happened"
          className="mt-1.5 w-full rounded-2xl px-3.5 py-2.5 glass-thin bg-transparent outline-none
            text-sm resize-y focus:ring-2 focus:ring-emerald-400/40"
        />
      </label>

      {error && (
        <p className="text-sm text-rose-200 flex items-start gap-2">
          <I.Alert size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" size="sm" variant="primary" disabled={busy || !description.trim()}>
        {busy ? "Saving…" : "Save record"}
      </Button>
    </form>
  );
}
