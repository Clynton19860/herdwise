"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

/**
 * Retire a zone.
 *
 * Confirms first, because the button sits beside "Duplicate" and "Edit rules"
 * and a misfire here changes what the containment engine enforces. Archiving is
 * reversible in the database, but nothing in this interface reverses it yet, so
 * it is treated as though it were not.
 */
export function ArchiveZone({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/geofences/${id}/archive`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not archive the zone.");
        return;
      }
      router.push("/geofences");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="danger"
        iconLeft={<I.X size={14} />}
        onClick={() => setConfirming(true)}
      >
        Archive zone
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="text-xs text-white/70">Stop enforcing {name}?</span>
      <Button size="sm" variant="danger" disabled={busy} onClick={archive}>
        {busy ? "Archiving…" : "Yes, archive"}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
      {error && <span className="text-xs text-rose-200">{error}</span>}
    </span>
  );
}
