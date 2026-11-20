/**
 * Turns OCR text from a receipt into editable line items.
 * OCR is never perfect, so the result always goes into the editable
 * item list for the user to check before splitting.
 */

export interface ParsedReceipt {
  items: { name: string; quantity: number; price: number }[];
  tax: number;
  service: number;
  discount: number;
  total: number | null;
}

// A price at the end of a line: 25.000 / 25,000 / 125.000,00 / 25000
const PRICE_AT_END = /(-?\s?(?:rp\.?\s?)?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|-?\s?(?:rp\.?\s?)?\d{4,})\s*$/i;

const SKIP = /(sub\s?total|grand\s?total|^total|total\b|tunai|cash|kembali|change|bayar|payment|debit|kredit|credit|card|qris|gopay|ovo|dana|shopeepay|npwp|telp|phone|kasir|cashier|table|meja|no\.?\s?struk|receipt|invoice|tanggal|date|jam|time|pax|guest|thank|terima kasih|rounding|pembulatan)/i;
const TAX = /(pajak|tax|pb1|ppn|vat|pb ?1)/i;
const SERVICE = /(service|servis|layanan|svc)/i;
const DISCOUNT = /(disc|diskon|discount|potongan|promo|voucher)/i;
const TOTAL = /(grand\s?total|^total\b|total bayar|total tagihan)/i;

function toNumber(raw: string): number {
  let s = raw.replace(/rp\.?/i, "").replace(/\s/g, "");
  const negative = s.startsWith("-");
  s = s.replace(/^-/, "");
  // drop trailing cents like ",00" or ".00"
  if (/[.,]\d{3}[.,]\d{2}$/.test(s) || /^\d{4,}[.,]\d{2}$/.test(s)) s = s.slice(0, -3);
  const n = Number(s.replace(/[^\d]/g, ""));
  return negative ? -n : n;
}

export function parseReceiptText(text: string): ParsedReceipt {
  const result: ParsedReceipt = { items: [], tax: 0, service: 0, discount: 0, total: null };

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[|_~*]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const line of lines) {
    const m = line.match(PRICE_AT_END);
    if (!m) continue;
    const amount = Math.abs(toNumber(m[1]));
    if (!amount) continue;
    const label = line.slice(0, m.index).trim();

    if (TOTAL.test(label) && !/sub/i.test(label)) {
      result.total = amount;
      continue;
    }
    if (TAX.test(label)) {
      result.tax += amount;
      continue;
    }
    if (SERVICE.test(label)) {
      result.service += amount;
      continue;
    }
    if (DISCOUNT.test(label) || m[1].trim().startsWith("-")) {
      result.discount += amount;
      continue;
    }
    if (SKIP.test(label)) continue;

    // quantity: "2 Nasi Goreng", "2x Nasi Goreng", "Nasi Goreng x2", "Nasi Goreng 2 @25.000"
    let name = label;
    let quantity = 1;
    const lead = name.match(/^(\d{1,2})\s*[xX]?\s+(.+)$/);
    const trail = name.match(/^(.+?)\s+[xX]?\s?(\d{1,2})\s*(?:@.*)?$/);
    if (lead) {
      quantity = Number(lead[1]);
      name = lead[2];
    } else if (trail) {
      quantity = Number(trail[2]);
      name = trail[1];
    }
    name = name.replace(/@\s?[\d.,]+/, "").replace(/[^\p{L}\p{N}\s&'()/+.-]/gu, "").trim();
    if (name.length < 2 || !/\p{L}/u.test(name)) continue;

    result.items.push({ name, quantity: Math.max(1, quantity), price: amount });
  }
  return result;
}
