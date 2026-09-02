"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Giving a registered farmer an account.
 *
 * Most owners never hold one — an officer records them when animals are tagged.
 * This is the step that turns a record about somebody into an account they hold,
 * and it is the only place an owner's email is set.
 */
export function InviteOwner({ ownerId, email }: { ownerId: string; email: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(email ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/owners/${ownerId}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setResult({ ok: false, message: data.error ?? "Could not invite." }); return; }
      setResult({ ok: true, message: data.note ?? "Invitation sent." });
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  if (email && !open) {
    return (
      <span className="inline-flex items-center gap-2">
        <Badge tone="veld">Has an account</Badge>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Resend</Button>
      </span>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="glass" iconLeft={<I.Users size={14} />} onClick={() => setOpen(true)}>
        Give them an account
      </Button>
    );
  }

  return (
    <form onSubmit={send} className="glass-solid rounded-2xl p-4 w-full max-w-md space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">Invite this owner</h3>
        <button
          type="button"
          onClick={() => { setOpen(false); setResult(null); }}
          aria-label="Cancel"
          className="h-7 w-7 grid place-items-center rounded-lg text-white/55 hover:text-white hover:bg-white/8 transition-colors"
        >
          <I.X size={14} />
        </button>
      </div>

      <label className="block">
        <span className="text-xs text-white/55">Their email</span>
        <input
          type="email"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Where the invitation goes"
          className="mt-1.5 w-full h-11 rounded-2xl px-3.5 glass-thin bg-transparent outline-none text-sm focus:ring-2 focus:ring-emerald-400/40"
        />
      </label>

      {result && (
        <p className={`text-sm flex items-start gap-2 ${result.ok ? "text-emerald-100" : "text-rose-100"}`}>
          {result.ok ? <I.Check size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                     : <I.Alert size={14} className="mt-0.5 shrink-0 text-rose-300" />}
          {result.message}
        </p>
      )}

      <Button type="submit" size="sm" variant="primary" disabled={busy}>
        {busy ? "Sending…" : "Send invitation"}
      </Button>
      <p className="text-[11px] text-white/40 leading-snug">
        They receive a six-digit code and choose their own password. They will see
        only their own animals — never another farmer&rsquo;s.
      </p>
    </form>
  );
}
