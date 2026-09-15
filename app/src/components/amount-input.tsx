"use client";

import { useId } from "react";

/** Decimal-friendly amount input with optional MAX chip. Value is a display string; parse with parseUsd6/parseTokens. */
export function AmountInput({
  label,
  value,
  onChange,
  hint,
  onMax,
  prefix = "$",
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  onMax?: () => void;
  prefix?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border border-rule bg-raised px-4 py-3 focus-within:border-brass">
        {prefix ? <span className="font-mono text-lg text-ink-3">{prefix}</span> : null}
        <input
          id={id}
          inputMode="decimal"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            if ((v.match(/\./g) ?? []).length <= 1) onChange(v);
          }}
          placeholder="0.00"
          className="min-h-[44px] w-full bg-transparent font-mono text-2xl tabular outline-none placeholder:text-ink-3"
        />
        {onMax ? (
          <button
            type="button"
            onClick={onMax}
            className="rounded-full bg-brass-soft px-3 py-1.5 font-mono text-xs font-medium uppercase tracking-wide text-brass"
          >
            Max
          </button>
        ) : null}
      </div>
      {hint ? <p className="mt-1.5 text-sm text-ink-3">{hint}</p> : null}
    </div>
  );
}

/** Parse a decimal string into 6-decimal base units. Returns null when invalid. */
export function parseUsd6(v: string): bigint | null {
  if (!v || v === ".") return null;
  const [whole, frac = ""] = v.split(".");
  if (!/^\d*$/.test(whole) || !/^\d{0,6}$/.test(frac)) return null;
  const n = BigInt(whole || "0") * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
  return n;
}

/** Parse a token amount string into base units for the given decimals. */
export function parseTokens(v: string, decimals: number): bigint | null {
  if (!v || v === ".") return null;
  const [whole, frac = ""] = v.split(".");
  if (!/^\d*$/.test(whole) || frac.length > decimals) return null;
  const scale = 10n ** BigInt(decimals);
  return BigInt(whole || "0") * scale + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0");
}
