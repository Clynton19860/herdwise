"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Device = {
  id: string; imei: string; imeiMasked: string;
  batteryPct: number | null; lastSeenAt: string | null; anomalies: number;
};

/**
 * Attaching a tag to an animal that has none.
 *
 * The full IMEI is shown here, not the masked form used elsewhere. An officer
 * standing in a field is matching this against the number printed on the plastic
 * in their hand, and the last four digits will not tell fifteen tags apart. It is
 * behind a session and a role check, which the map endpoint is not.
 */
export function ClaimTag({ animalId, currentImei }: { animalId: string; currentImei: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The list is keyed to the open state rather than cleared synchronously, so
  // nothing sets state in the effect body — a stale list from a previous open
  // simply does not match the current generation and is not shown.
  const [loaded, setLoaded] = useState<{ open: boolean; rows: Device[] } | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    fetch("/api/devices")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Device[]) => { if (live) setLoaded({ open: true, rows }); })
      .catch(() => { if (live) setLoaded({ open: true, rows: [] }); });
    return () => { live = false; };
  }, [open]);

  async function assign(deviceId: string | null, releaseId?: string | null) {
    setBusy(deviceId ?? "release");
    setError(null);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          deviceId ? { deviceId, animalId } : { deviceId: releaseId, animalId: null },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not assign the tag."); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  const devices = open && loaded?.open ? loaded.rows : null;

  // Releasing needs the device id, which the detail page does not carry — so the
  // release path finds it by matching the masked IMEI in the claimable list.
  const currentDeviceId = devices?.find((d) => d.imeiMasked === currentImei)?.id ?? null;

  if (!open) {
    return (
      <Button size="sm" variant="glass" iconLeft={<I.Tag size={14} />} onClick={() => setOpen(true)}>
        {currentImei && currentImei !== "unpaired" ? "Change tag" : "Attach a tag"}
      </Button>
    );
  }

  return (
    <div className="glass-solid rounded-3xl p-5 w-full max-w-lg">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">Tags waiting to be claimed</h3>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="h-8 w-8 grid place-items-center rounded-xl text-white/55 hover:text-white hover:bg-white/8 transition-colors"
        >
          <I.X size={16} />
        </button>
      </div>

      {devices === null && <p className="mt-4 text-sm text-white/55">Looking…</p>}

      {devices?.length === 0 && (
        <div className="mt-4 glass-thin rounded-2xl p-5 text-center">
          <I.Wifi size={20} className="mx-auto text-white/40" />
          <div className="mt-2 text-sm">No unclaimed tags</div>
          <p className="mt-1 text-xs text-white/55 leading-snug">
            A tag appears here the first time it reports to the gateway. Check the
            SIM has data and the server address is set to the pilot gateway.
          </p>
        </div>
      )}

      {devices && devices.length > 0 && (
        <ul className="mt-4 space-y-2 max-h-72 overflow-y-auto pretty-scroll">
          {devices.map((d) => (
            <li key={d.id} className="glass-thin rounded-2xl p-3 flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-sm truncate">{d.imei}</span>
                <span className="block text-xs text-white/50">
                  {d.batteryPct != null ? `${d.batteryPct}% battery` : "battery unknown"}
                  {d.lastSeenAt ? ` · last heard ${new Date(d.lastSeenAt).toLocaleString("en-ZW", { timeZone: "Africa/Harare", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}` : " · never reported"}
                </span>
              </span>
              {d.anomalies > 0 && <Badge tone="amber">{d.anomalies}</Badge>}
              <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => assign(d.id)}>
                {busy === d.id ? "Linking…" : "Claim"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 text-sm text-rose-200 flex items-start gap-2">
          <I.Alert size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {currentImei && currentImei !== "unpaired" && currentDeviceId && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-3"
          disabled={busy !== null}
          onClick={() => assign(null, currentDeviceId)}
        >
          {busy === "release" ? "Releasing…" : "Release the current tag"}
        </Button>
      )}
    </div>
  );
}
