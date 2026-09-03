"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

/**
 * Removing an animal from the register.
 *
 * Deliberately awkward. Every other control on this page corrects a record;
 * this one ends it, and the two should not be one careless click apart. So it
 * asks for the ear tag to be typed out — the number printed on the plastic,
 * which somebody deleting the right animal has in front of them and somebody
 * deleting the wrong one does not.
 *
 * What survives is worth stating on the screen rather than only in the schema,
 * because the person pressing this is deciding whether they can undo it:
 * positions and enforcement cases remain, since a council must not be able to
 * erase its own audit trail by deleting a record. The ear tag is released and
 * becomes available for another animal.
 */
export function RemoveAnimal({ animalId, tag }: { animalId: string; tag: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = typed.trim().toUpperCase() === tag.toUpperCase();

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/animals/${animalId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not remove this animal."); return; }
      router.replace("/livestock");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-white/45 hover:text-rose-200 transition-colors
          focus:outline-none focus:text-rose-200"
      >
        Remove from the register
      </button>
    );
  }

  return (
    <div className="glass-solid rounded-3xl p-5 w-full max-w-md space-y-3.5 border border-rose-400/20">
      <div className="flex items-start gap-2.5">
        <I.Alert size={16} className="mt-0.5 shrink-0 text-rose-300" />
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Remove {tag}?</h3>
          <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
            Her positions and any enforcement cases stay on record — a council cannot
            erase its own audit trail. Her health records and containment history go
            with her, and her ear tag is released for another animal.
          </p>
        </div>
      </div>

      <label className="block">
        <span className="text-xs text-white/55">Type <span className="font-mono">{tag}</span> to confirm</span>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 w-full h-11 rounded-2xl px-3.5 glass-thin bg-transparent outline-none
            text-sm font-mono focus:ring-2 focus:ring-rose-400/40"
        />
      </label>

      {error && (
        <p className="text-sm text-rose-200 flex items-start gap-2">
          <I.Alert size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="glass"
          onClick={() => { setOpen(false); setTyped(""); setError(null); }}
        >
          Keep her
        </Button>
        <button
          type="button"
          disabled={!confirmed || busy}
          onClick={remove}
          className="h-9 px-4 rounded-xl text-xs font-medium bg-rose-500/85 text-white
            hover:bg-rose-500 disabled:opacity-35 disabled:hover:bg-rose-500/85 transition-colors
            focus:outline-none focus:ring-2 focus:ring-rose-400/50"
        >
          {busy ? "Removing…" : "Remove from the register"}
        </button>
      </div>
    </div>
  );
}
