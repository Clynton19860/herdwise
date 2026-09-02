"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

/**
 * A farmer registering one of his own animals.
 *
 * Short on purpose. The officer wizard collects photographs, measurements and a
 * vaccination history across six steps, which is right for a municipal register
 * being built from scratch and wrong for a farmer standing in a kraal with a tag
 * in one hand and a phone in the other.
 *
 * The owner is never sent — the endpoint takes it from the session, so this
 * cannot file an animal under somebody else's name.
 */
export function RegisterAnimal({ parcels }: { parcels: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("cattle");
  const [sex, setSex] = useState("female");
  const [parcel, setParcel] = useState(parcels[0] ?? "");
  const [imei, setImei] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/animals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tag: tag.trim(), name: name.trim() || null, species, sex,
          parcel: parcel || null, imei: imei.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setResult({ ok: false, message: data.error ?? "Could not register." }); return; }
      setResult({
        ok: true,
        message:
          data.tagLinked === "linked" ? `${data.tag} registered and its tag attached.`
          : data.tagLinked === "not_reporting_yet" ? `${data.tag} registered. That tag has not reported yet — attach it from the animal once it does.`
          : data.tagLinked === "already_assigned" ? `${data.tag} registered, but that tag is already on another animal.`
          : `${data.tag} registered.`,
      });
      setTag(""); setName(""); setImei("");
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 w-full h-11 rounded-2xl px-3.5 glass-thin bg-transparent outline-none text-sm focus:ring-2 focus:ring-emerald-400/40";

  if (!open) {
    return (
      <Button size="sm" variant="primary" iconLeft={<I.Plus size={14} />} onClick={() => setOpen(true)}>
        Register an animal
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="glass-solid rounded-3xl p-5 w-full max-w-lg space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">Register an animal</h3>
        <button
          type="button" onClick={() => { setOpen(false); setResult(null); }} aria-label="Close"
          className="h-8 w-8 grid place-items-center rounded-xl text-white/55 hover:text-white hover:bg-white/8 transition-colors"
        >
          <I.X size={16} />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="block">
          <span className="text-xs text-white/55">Ear tag number</span>
          <input required value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())}
            placeholder="As printed on the tag" className={field} />
        </label>
        <label className="block">
          <span className="text-xs text-white/55">Name <span className="text-white/35">optional</span></span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="text-xs text-white/55">Species</span>
          <select value={species} onChange={(e) => setSpecies(e.target.value)} className={field}>
            {["cattle", "goat", "sheep", "donkey", "pig"].map((s) => (
              <option key={s} value={s}>{s.replace(/^./, (c) => c.toUpperCase())}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-white/55">Sex</span>
          <select value={sex} onChange={(e) => setSex(e.target.value)} className={field}>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        {parcels.length > 0 && (
          <label className="block">
            <span className="text-xs text-white/55">Area</span>
            <select value={parcel} onChange={(e) => setParcel(e.target.value)} className={field}>
              {parcels.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="text-xs text-white/55">Tag IMEI <span className="text-white/35">optional</span></span>
          <input value={imei} onChange={(e) => setImei(e.target.value)}
            placeholder="15 digits on the tag" className={field} />
        </label>
      </div>

      {result && (
        <p className={`text-sm flex items-start gap-2 ${result.ok ? "text-emerald-100" : "text-rose-100"}`}>
          {result.ok ? <I.Check size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                     : <I.Alert size={14} className="mt-0.5 shrink-0 text-rose-300" />}
          {result.message}
        </p>
      )}

      <Button type="submit" size="sm" variant="primary" disabled={busy || !tag.trim()}>
        {busy ? "Registering…" : "Register"}
      </Button>
    </form>
  );
}
