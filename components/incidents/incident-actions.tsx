"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

/**
 * Working an incident: acknowledge, escalate, resolve.
 *
 * These were disabled until there was a signed-in person, because every one of
 * them is a claim that somebody did something. The officer is taken from the
 * session on the server, never from anything the browser sends.
 *
 * Only the transitions that make sense from the current status are offered. An
 * already-resolved incident does not need resolving again, and a control that
 * cannot achieve anything is noise on a page somebody reads under pressure.
 */
export function IncidentActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = status.toLowerCase().replace(/\s+/g, "_");

  async function move(next: string) {
    setBusy(next);
    setError(null);
    try {
      const res = await fetch(`/api/incidents/${id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update the incident.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  const actions = [
    {
      key: "in_progress",
      label: "Acknowledge",
      icon: <I.Bell size={14} />,
      variant: "glass" as const,
      show: current === "open",
    },
    {
      key: "escalated",
      label: "Escalate",
      icon: <I.Alert size={14} />,
      variant: "glass" as const,
      show: current === "open" || current === "in_progress",
    },
    {
      key: "resolved",
      label: "Resolve",
      icon: <I.Check size={14} />,
      variant: "primary" as const,
      show: current !== "resolved",
    },
    {
      key: "open",
      label: "Reopen",
      icon: <I.ArrowRight size={14} />,
      variant: "glass" as const,
      show: current === "resolved",
    },
  ].filter((a) => a.show);

  return (
    <div className="ml-auto flex items-center gap-2 flex-wrap">
      {error && (
        <span className="text-xs text-rose-200 flex items-center gap-1.5">
          <I.Alert size={12} />
          {error}
        </span>
      )}
      {actions.map((a) => (
        <Button
          key={a.key}
          size="sm"
          variant={a.variant}
          iconLeft={a.icon}
          disabled={busy !== null}
          onClick={() => move(a.key)}
        >
          {busy === a.key ? "Saving…" : a.label}
        </Button>
      ))}
    </div>
  );
}
