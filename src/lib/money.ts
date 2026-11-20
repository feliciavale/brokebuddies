const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/**
 * 1250000 -> "Rp 1.250.000". The space is a non-breaking space so "Rp"
 * never wraps onto a different line from the number.
 */
export function formatIDR(amount: number): string {
  return idr.format(amount).replace(/\s/g, "\u00a0");
}

/** "Rp 1.250.000" / "1,250,000" / "1250000" -> 1250000. Returns NaN if empty. */
export function parseIDR(text: string): number {
  const digits = String(text).replace(/[^\d-]/g, "");
  return digits === "" || digits === "-" ? NaN : Number(digits);
}

/** 1250000 -> "1.250.000" (for inputs) */
export function groupDigits(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(amount);
}
