"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

export type EditField = {
  name: string;
  label: string;
  value: string;
  /** Omit for free text. */
  options?: { value: string; label: string }[];
  type?: "text" | "date" | "tel";
  hint?: string;
};

/**
 * Correcting a record in place.
 *
 * Everything in this platform was create-only, so a mistyped national ID or a
 * wrong ward could only be fixed with a database statement. That is not a
 * workflow a ward office can run.
 *
 * Only changed fields are sent. The endpoints leave an omitted column alone
 * rather than blanking it, so a partial save cannot erase what the form did not
 * carry — and sending everything on every save would overwrite a colleague's
 * concurrent edit with stale values from whenever this page was loaded.
 */
export function EditRecord({
  endpoint,
  fields,
  title = "Edit record",
}: {
  endpoint: string;
  fields: EditField[];
  title?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, f.value])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const original = Object.fromEntries(fields.map((f) => [f.name, f.value]));
  const changed = Object.keys(values).filter((k) => values[k] !== original[k]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!changed.length) { setOpen(false); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(changed.map((k) => [k, values[k]]))),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Could not save the change."); return; }
      setSaved(true);
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
      <Button size="sm" variant="glass" iconLeft={<I.Settings size={14} />} onClick={() => setOpen(true)}>
        {saved ? "Edit again" : "Edit"}
      </Button>
    );
  }

  return (
    <form onSubmit={save} className="glass-solid rounded-3xl p-5 w-full max-w-lg space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <button
          type="button"
          onClick={() => { setOpen(false); setValues(original); setError(null); }}
          aria-label="Cancel editing"
          className="h-8 w-8 grid place-items-center rounded-xl text-white/55 hover:text-white hover:bg-white/8 transition-colors"
        >
          <I.X size={16} />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3.5">
        {fields.map((f) => (
          <label key={f.name} className="block">
            <span className="text-xs text-white/55">{f.label}</span>
            {f.options ? (
              <select
                value={values[f.name]}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className={field}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={f.type ?? "text"}
                value={values[f.name]}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className={field}
              />
            )}
            {f.hint && <span className="mt-1 block text-[11px] text-white/40">{f.hint}</span>}
          </label>
        ))}
      </div>

      {error && (
        <p className="text-sm text-rose-200 flex items-start gap-2">
          <I.Alert size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="primary" disabled={busy || !changed.length}>
          {busy ? "Saving…" : changed.length ? `Save ${changed.length} change${changed.length > 1 ? "s" : ""}` : "No changes"}
        </Button>
        {changed.length > 0 && (
          <span className="text-[11px] text-white/40">{changed.join(", ")}</span>
        )}
      </div>
    </form>
  );
}
