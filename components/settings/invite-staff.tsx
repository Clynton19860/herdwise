"use client";

import { useState } from "react";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Adding a colleague.
 *
 * The account is created and the invitation emailed in one step, and the result
 * says which of those two actually happened. Supabase's built-in mailer allows
 * two messages an hour, so "created but not emailed" is a real outcome an
 * administrator needs to see rather than a failure to hide — the staff row
 * exists either way, and they need to know whether to expect the email.
 */
export function InviteStaff({ wards }: { wards: string[] }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("officer");
  const [ward, setWard] = useState(wards[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/staff/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, email, role, ward: ward || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? "Could not add them." });
        return;
      }
      setResult({ ok: true, message: data.note ?? "Invitation sent." });
      setFullName("");
      setEmail("");
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 w-full h-11 rounded-2xl px-3.5 glass-thin bg-transparent outline-none text-sm focus:ring-2 focus:ring-emerald-400/40";

  return (
    <form onSubmit={submit} className="mt-5 space-y-3.5">
      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="block">
          <span className="text-xs text-white/55">Full name</span>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Name as it should appear"
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-xs text-white/55">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Where the invitation goes"
            className={field}
          />
        </label>
        <label className="block">
          <span className="text-xs text-white/55">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
            <option value="officer">Field officer</option>
            <option value="vet">Veterinarian</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-white/55">Ward</span>
          <select value={ward} onChange={(e) => setWard(e.target.value)} className={field}>
            {wards.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </label>
      </div>

      {result && (
        <div className="flex items-start gap-2 text-sm">
          {result.ok ? (
            <I.Check size={14} className="mt-0.5 shrink-0 text-emerald-300" />
          ) : (
            <I.Alert size={14} className="mt-0.5 shrink-0 text-rose-300" />
          )}
          <span className={result.ok ? "text-emerald-100" : "text-rose-100"}>{result.message}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={busy}>
          {busy ? "Adding…" : "Send invitation"}
        </Button>
        <Badge tone="amber">Admins only</Badge>
      </div>

      <p className="text-[11px] text-white/40 leading-snug">
        They receive a six-digit code and choose their own password at
        <span className="font-mono"> /setup</span>. Nobody, including you, ever sees it.
      </p>
    </form>
  );
}
