"use client";

import { groupDigits, parseIDR } from "@/lib/money";

/** Rupiah input: shows "25.000", gives back 25000 (or 0 when empty). */
export function MoneyInput({
  value,
  onChange,
  placeholder = "0",
  className = "",
  id,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-semibold text-muted">
        Rp
      </span>
      <input
        id={id}
        aria-label={ariaLabel}
        className="input pl-9 text-right tabular-nums"
        inputMode="numeric"
        placeholder={placeholder}
        value={value ? groupDigits(value) : ""}
        onChange={(e) => {
          const n = parseIDR(e.target.value);
          onChange(Number.isNaN(n) ? 0 : Math.max(0, Math.min(n, 1_000_000_000)));
        }}
      />
    </div>
  );
}
