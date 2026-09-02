"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Member = { personId: string; name: string; email: string | null; role: string; phone: string };

/**
 * The people who work on a farm, appointed by whoever runs it.
 *
 * `owner` is not offered as a role. It belongs to whoever created the farm, and
 * handing it out from here would let a manager quietly take the place over.
 */
export function FarmPeople({ farmId, canAppoint }: { farmId: string; canAppoint: boolean }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Member[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("herdsman");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/farms/${farmId}/members`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Member[]) => { if (live) setLoaded(rows); })
      .catch(() => { if (live) setLoaded([]); });
    return () => { live = false; };
  }, [farmId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/farms/${farmId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, email, role, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setResult({ ok: false, message: data.error ?? "Could not add them." }); return; }
      setResult({ ok: true, message: data.note ?? "Added." });
      setFullName(""); setEmail(""); setPhone("");
      const rows = await fetch(`/api/farms/${farmId}/members`).then((r) => r.json()).catch(() => null);
      if (rows) setLoaded(rows);
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(personId: string) {
    await fetch(`/api/farms/${farmId}/members?person=${personId}`, { method: "DELETE" }).catch(() => {});
    const rows = await fetch(`/api/farms/${farmId}/members`).then((r) => r.json()).catch(() => null);
    if (rows) setLoaded(rows);
  }

  const field =
    "mt-1.5 w-full h-11 rounded-2xl px-3.5 glass-thin bg-transparent outline-none text-sm focus:ring-2 focus:ring-emerald-400/40";

  return (
    <div>
      <ul className="space-y-2">
        {loaded === null && <li className="text-sm text-white/55">Loading…</li>}
        {loaded?.map((m) => (
          <li key={m.personId} className="glass-thin rounded-2xl p-3 flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-white/10 grid place-items-center text-xs font-semibold shrink-0">
              {m.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm truncate">{m.name}</span>
              <span className="block text-xs text-white/50 truncate">{m.email ?? "no account yet"}</span>
            </span>
            <Badge tone={m.role === "owner" ? "veld" : "violet"}>{m.role}</Badge>
            {canAppoint && m.role !== "owner" && (
              <button
                onClick={() => remove(m.personId)}
                aria-label={`Remove ${m.name}`}
                className="h-8 w-8 grid place-items-center rounded-lg text-white/45 hover:text-rose-300 hover:bg-rose-400/10 transition-colors"
              >
                <I.X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canAppoint && !adding && (
        <Button size="sm" variant="glass" className="mt-3" iconLeft={<I.Plus size={14} />}
          onClick={() => setAdding(true)}>
          Appoint somebody
        </Button>
      )}

      {canAppoint && adding && (
        <form onSubmit={add} className="mt-3 glass-thin rounded-2xl p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-white/55">Name</span>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="text-xs text-white/55">Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="text-xs text-white/55">Phone <span className="text-white/35">optional</span></span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="text-xs text-white/55">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
                <option value="herdsman">Herdsman — day to day</option>
                <option value="manager">Manager — can appoint others</option>
                <option value="vet">Vet — health records</option>
              </select>
            </label>
          </div>

          {result && (
            <p className={`text-sm flex items-start gap-2 ${result.ok ? "text-emerald-100" : "text-rose-100"}`}>
              {result.ok ? <I.Check size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                         : <I.Alert size={14} className="mt-0.5 shrink-0 text-rose-300" />}
              {result.message}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" variant="primary" disabled={busy}>
              {busy ? "Adding…" : "Send invitation"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setResult(null); }}>
              Cancel
            </Button>
          </div>
          <p className="text-[11px] text-white/40 leading-snug">
            They receive a six-digit code and choose their own password. They will see
            this farm only.
          </p>
        </form>
      )}
    </div>
  );
}
