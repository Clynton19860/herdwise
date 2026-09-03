"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SEVERITIES = [
  { value: "low", label: "Advisory" },
  { value: "medium", label: "Notice" },
  { value: "high", label: "Warning" },
  { value: "critical", label: "Final notice" },
];

/**
 * Serving a notice on a livestock owner.
 *
 * The enforcement half of the platform, and the button for it sat on this page
 * doing nothing — which is the wrong thing to show a council that is buying
 * enforcement.
 *
 * The severities are named as a council would say them rather than as the
 * database stores them. Nobody serves a "medium"; they serve a notice, and
 * escalate to a warning, and then to a final notice. The words carry the
 * meaning that the enum only encodes.
 */
export function ServeNotice({ ownerId, ownerName }: { ownerId: string; ownerName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [channel, setChannel] = useState("in_app");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [served, setServed] = useState<string | null>(null);

  async function serve(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/owners/${ownerId}/notice`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, body, severity, channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not serve this notice."); return; }
      setServed(data.note ?? "Served.");
      setOpen(false);
      setSubject("");
      setBody("");
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
      <div className="flex items-center gap-2.5">
        <Button size="sm" variant="glass" iconLeft={<I.Bell size={14} />} onClick={() => setOpen(true)}>
          Send notice
        </Button>
        {served && <span className="text-[11px] text-emerald-200">{served}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={serve} className="glass-solid rounded-3xl p-5 w-full max-w-lg space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">Serve a notice on {ownerName}</h3>
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
          <span className="text-xs text-white/55">Kind</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={field}>
            {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-white/55">How it reaches them</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={field}>
            <option value="in_app">In the platform</option>
            <option value="sms">SMS</option>
          </select>
          {channel === "sms" && (
            <span className="mt-1 block text-[11px] text-amber-200">
              Queued, not sent — no carrier account is connected yet
            </span>
          )}
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-white/55">Subject</span>
        <input
          required value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder="Cattle found outside their allocation"
          className={field}
        />
      </label>

      <label className="block">
        <span className="text-xs text-white/55">Notice</span>
        <textarea
          required rows={4} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="What was observed, when, and what they must do about it."
          className="mt-1.5 w-full rounded-2xl px-3.5 py-2.5 glass-thin bg-transparent outline-none
            text-sm resize-y focus:ring-2 focus:ring-emerald-400/40"
        />
        <span className="mt-1 block text-[11px] text-white/40">
          Your name is added automatically — a notice always says who served it.
        </span>
      </label>

      {error && (
        <p className="text-sm text-rose-200 flex items-start gap-2">
          <I.Alert size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="primary" disabled={busy || !subject.trim() || !body.trim()}>
          {busy ? "Serving…" : "Serve notice"}
        </Button>
        <Badge tone="amber">Recorded against this owner</Badge>
      </div>
    </form>
  );
}
