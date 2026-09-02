"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

/**
 * The first thing a new farmer sees.
 *
 * Nothing has been made for him. Herdwise used to register a farmer into a ward
 * an officer had already created, which meant the platform decided where he was
 * before he had said anything about his own place. He names it himself, and the
 * ward is optional — a municipal grouping the city may want, not something he
 * has to accept to get started.
 */
export function CreateFarm({ wards, firstTime }: { wards: string[]; firstTime: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(firstTime);
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/farms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, district: district || null, ward: ward || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not create the farm."); return; }
      setName(""); setDistrict(""); setWard("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 w-full h-11 rounded-2xl px-3.5 glass-thin bg-transparent outline-none text-sm focus:ring-2 focus:ring-emerald-400/40";

  if (!open) {
    return (
      <Button size="sm" variant="glass" iconLeft={<I.Plus size={14} />} onClick={() => setOpen(true)}>
        Add another farm
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="glass-solid rounded-3xl p-6 sm:p-7 w-full max-w-lg space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {firstTime ? "Set up your farm" : "Add a farm"}
        </h2>
        <p className="text-xs text-white/55 mt-1">
          {firstTime
            ? "Nothing has been set up for you. Name your farm and everything else — areas, animals, the people who work there — hangs off it."
            : "You can manage more than one."}
        </p>
      </div>

      <label className="block">
        <span className="text-xs text-white/55">Farm name</span>
        <input
          required autoFocus value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What the place is called"
          className={field}
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="block">
          <span className="text-xs text-white/55">District <span className="text-white/35">optional</span></span>
          <input value={district} onChange={(e) => setDistrict(e.target.value)}
            placeholder="Where it is" className={field} />
        </label>
        <label className="block">
          <span className="text-xs text-white/55">Ward <span className="text-white/35">optional</span></span>
          <select value={ward} onChange={(e) => setWard(e.target.value)} className={field}>
            <option value="">Not in a ward</option>
            {wards.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <span className="mt-1 block text-[11px] text-white/40">
            Only if a municipality is overseeing your area.
          </span>
        </label>
      </div>

      {error && (
        <p className="text-sm text-rose-200 flex items-start gap-2">
          <I.Alert size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create farm"}
        </Button>
        {!firstTime && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
