"use client";

import type {
  ChangeEvent,
  ComponentProps,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useId, useState } from "react";
import { I } from "@/components/ui/icon";

/* ---------- FormField ---------- */

export function FormField({
  label,
  hint,
  error,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs uppercase tracking-[0.14em] text-white/55">
          {label}
          {required && <span className="text-rose-300 ml-1">*</span>}
        </span>
        {hint && !error && (
          <span className="text-[11px] text-white/40">{hint}</span>
        )}
        {error && (
          <span className="text-[11px] text-rose-300 flex items-center gap-1">
            <I.Alert size={11} /> {error}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

/* ---------- TextInput ---------- */

type InputProps = Omit<ComponentProps<"input">, "className" | "size"> & {
  className?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  invalid?: boolean;
};

export function TextInput({
  className = "",
  iconLeft,
  iconRight,
  invalid,
  ...rest
}: InputProps) {
  return (
    <div
      className={`group flex items-center gap-2 h-12 rounded-2xl px-3.5 transition-all duration-300
        ${invalid
          ? "glass-thin border-rose-400/50 ring-1 ring-rose-400/30"
          : "glass-thin focus-within:bg-white/8 focus-within:ring-2 focus-within:ring-emerald-400/40 focus-within:shadow-[0_0_24px_-12px_rgba(0,245,160,0.6)]"}
        ${className}`}
    >
      {iconLeft && (
        <span className="text-white/55 group-focus-within:text-emerald-300 transition-colors">
          {iconLeft}
        </span>
      )}
      <input
        className="bg-transparent outline-none text-sm placeholder:text-white/35 flex-1 min-w-0 text-white"
        {...rest}
      />
      {iconRight && <span className="text-white/55">{iconRight}</span>}
    </div>
  );
}

/* ---------- Textarea ---------- */

export function Textarea({
  className = "",
  rows = 4,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
  invalid?: boolean;
}) {
  return (
    <textarea
      rows={rows}
      className={`block w-full rounded-2xl px-4 py-3 text-sm bg-transparent outline-none text-white placeholder:text-white/35 transition-all duration-300 resize-none
        ${invalid
          ? "glass-thin border-rose-400/50 ring-1 ring-rose-400/30"
          : "glass-thin focus:bg-white/8 focus:ring-2 focus:ring-emerald-400/40 focus:shadow-[0_0_24px_-12px_rgba(0,245,160,0.6)]"}
        ${className}`}
      {...rest}
    />
  );
}

/* ---------- Select ---------- */

type Option = { value: string; label: string; hint?: string };

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select…",
  className = "",
  invalid,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
}) {
  return (
    <div
      className={`relative flex items-center h-12 rounded-2xl px-3.5 transition-all duration-300
        ${invalid
          ? "glass-thin border-rose-400/50 ring-1 ring-rose-400/30"
          : "glass-thin focus-within:bg-white/8 focus-within:ring-2 focus-within:ring-emerald-400/40 focus-within:shadow-[0_0_24px_-12px_rgba(0,245,160,0.6)]"}
        ${className}`}
    >
      <select
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        className="appearance-none bg-transparent text-sm text-white outline-none flex-1 pr-8 cursor-pointer"
        style={{
          // Hide native arrow on Safari; we render our own
          colorScheme: "dark",
        }}
      >
        <option value="" className="bg-[#0a1612] text-white/50">
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0a1612] text-white">
            {o.label}
            {o.hint ? ` — ${o.hint}` : ""}
          </option>
        ))}
      </select>
      <I.Chevron
        size={14}
        className="absolute right-3.5 rotate-90 text-white/55 pointer-events-none"
      />
    </div>
  );
}

/* ---------- RadioCardGroup ---------- */

export type RadioCardOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
};

export function RadioCardGroup({
  options,
  value,
  onChange,
  columns = 3,
  className = "",
}: {
  options: RadioCardOption[];
  value: string;
  onChange: (v: string) => void;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const cols =
    columns === 2 ? "md:grid-cols-2"
    : columns === 4 ? "md:grid-cols-2 lg:grid-cols-4"
    : "md:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid grid-cols-1 ${cols} gap-3 ${className}`}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`group relative text-left p-4 rounded-2xl transition-all duration-300
              ${selected
                ? "glass-veld ring-1 ring-emerald-400/40 shadow-[0_0_32px_-12px_rgba(0,245,160,0.6)]"
                : "glass-thin hover:bg-white/6 hover:-translate-y-0.5"}`}
          >
            <div className="flex items-start gap-3">
              {opt.icon && (
                <span
                  className={`h-9 w-9 rounded-xl grid place-items-center transition-colors
                    ${selected
                      ? "bg-[linear-gradient(135deg,rgba(0,245,160,0.28),rgba(91,231,255,0.18))] text-emerald-200"
                      : "bg-white/8 text-white/75"}`}
                >
                  {opt.icon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-tight">{opt.label}</div>
                {opt.description && (
                  <div className="text-xs text-white/55 mt-1 leading-snug">
                    {opt.description}
                  </div>
                )}
              </div>
              <span
                className={`mt-0.5 h-4 w-4 rounded-full border transition-all duration-300
                  ${selected
                    ? "bg-emerald-400 border-emerald-400 shadow-[0_0_12px_currentColor]"
                    : "border-white/30 group-hover:border-white/60"}`}
              >
                {selected && (
                  <span className="block h-full w-full grid place-items-center text-emerald-950">
                    <I.Check size={10} />
                  </span>
                )}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Checkbox ---------- */

export function Checkbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 text-left w-full glass-thin rounded-2xl p-3 transition-all hover:bg-white/6"
    >
      <span
        className={`mt-0.5 h-5 w-5 rounded-md border grid place-items-center transition-all
          ${checked
            ? "bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] border-transparent shadow-[0_0_12px_-4px_rgba(0,245,160,0.6)]"
            : "border-white/25 bg-white/5"}`}
      >
        {checked && <I.Check size={12} className="text-emerald-950" />}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-xs text-white/55 mt-0.5 leading-snug">{description}</div>
        )}
      </div>
    </button>
  );
}

/* ---------- Switch ---------- */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm"
    >
      <span
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-emerald-400/70" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      {label && <span className="text-white/80">{label}</span>}
    </button>
  );
}

/* ---------- SearchPicker ---------- */

export function SearchPicker<T>({
  items,
  value,
  onChange,
  getLabel,
  getDescription,
  getId,
  placeholder = "Search…",
}: {
  items: T[];
  value: T | null;
  onChange: (v: T) => void;
  getLabel: (v: T) => string;
  getDescription?: (v: T) => string;
  getId: (v: T) => string;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = items.filter((it) =>
    getLabel(it).toLowerCase().includes(q.toLowerCase()) ||
    (getDescription?.(it).toLowerCase().includes(q.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-3">
      <TextInput
        iconLeft={<I.Search size={16} />}
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ((e.target as HTMLInputElement).value)}
      />
      <div className="space-y-2 max-h-72 overflow-y-auto pretty-scroll pr-1">
        {filtered.length === 0 && (
          <div className="text-sm text-white/45 text-center py-6">
            No matches — try a different search.
          </div>
        )}
        {filtered.map((it) => {
          const selected = value && getId(value) === getId(it);
          return (
            <button
              key={getId(it)}
              type="button"
              onClick={() => onChange(it)}
              className={`w-full text-left p-3.5 rounded-2xl transition-all flex items-center gap-3
                ${selected
                  ? "glass-veld ring-1 ring-emerald-400/40"
                  : "glass-thin hover:bg-white/6"}`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{getLabel(it)}</div>
                {getDescription && (
                  <div className="text-xs text-white/55 truncate">
                    {getDescription(it)}
                  </div>
                )}
              </div>
              {selected && (
                <span className="h-5 w-5 rounded-full bg-emerald-400 grid place-items-center text-emerald-950">
                  <I.Check size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Chip group (multi-select) ---------- */

export function ChipGroup({
  options,
  values,
  onChange,
}: {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() =>
              onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])
            }
            className={`h-9 px-3.5 rounded-full text-sm font-medium transition-all
              ${on
                ? "bg-[linear-gradient(135deg,rgba(0,245,160,0.25),rgba(91,231,255,0.15))] text-emerald-100 border border-emerald-300/40 shadow-[0_0_18px_-8px_rgba(0,245,160,0.6)]"
                : "glass-thin text-white/75 hover:bg-white/6"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Slider ---------- */

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative h-12 flex items-center">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full appearance-none bg-transparent cursor-pointer
          [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/10
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(0,245,160,0.5)] [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/30"
        style={{
          background: `linear-gradient(90deg, #00f5a0 0%, #5be7ff ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%)`,
          height: 8,
          borderRadius: 999,
        }}
      />
    </div>
  );
}
