/**
 * Turns receipt text (from OCR or from the AI scan) into editable line items.
 * Reading is never perfect, so the result always goes into the editable
 * item list for the user to check before splitting.
 *
 * Handles the common Indonesian receipt layouts:
 *   one line:   "2 Nasi Goreng 50.000"   /  "Nasi Goreng x2 @25.000 50.000"
 *   two lines:  "Es Kopi Susu [OL]"  then  "1x  27,000  27,000"
 *   modifiers:  "* LESS ICE - FELICIA"   (names after the dash = who ordered it)
 *   promos:     "Gofood Payday Rp 1000" then "5x -1,000 -5,000"  (a discount)
 *   tax note:   "Harga Sudah Termasuk Pajak"  (prices already include PB1)
 */

export interface ParsedItem {
  name: string;
  quantity: number;
  /** line total in whole rupiah */
  price: number;
  /** names printed on the receipt for this item, e.g. ["Andersen", "Eric"] */
  people: string[];
}

export interface ParsedReceipt {
  items: ParsedItem[];
  /** tax to ADD on top of the items (0 when prices already include it) */
  tax: number;
  service: number;
  discount: number;
  subtotal: number | null;
  total: number | null;
  /** true when the receipt says prices already include tax */
  taxIncluded: boolean;
  /** the tax amount printed on the receipt, even when it is already included */
  taxPrinted: number;
}

// A number that looks like money: 27,000 / 27.000 / 125.000,00 / 27000 / -5,000
const MONEY = String.raw`-?\s?(?:rp\.?\s?)?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|-?\s?(?:rp\.?\s?)?\d{4,}`;
const PRICE_AT_END = new RegExp(`(${MONEY})\\s*$`, "i");
// "1x 27,000 27,000" / "2 x 27.000 54.000" / "1x 27,000" / "Ix 27,000 27,000" (OCR reads 1 as I or l)
const QTY_LINE = new RegExp(`^([0-9Il|]{1,3})\\s*[xX×]\\s*(${MONEY})(?:\\s+(${MONEY}))?\\s*$`, "i");

const TAX_INCLUDED = /(termasuk\s+pajak|sudah\s+termasuk|harga\s+termasuk|incl(?:\.|uding|usive)?\s+(?:of\s+)?(?:tax|pb1|ppn|vat)|tax\s+incl|pajak\s+sudah)/i;
const FOOTER_START = /(sub\s?-?\s?tota[l1]?|^\s*tota[l1]\b|grand\s?tota[l1]|^\s*t[o0]ta[l1]\s|jumlah|total\s+bayar|total\s+tagihan)/i;
const SUBTOTAL = /sub\s?-?\s?tota[l1]?/i;
const TOTAL = /(grand\s?tota[l1]|^\s*t[o0]ta[l1]\b|total\s+bayar|total\s+tagihan)/i;
const TAX = /(pajak|tax|pb\s?1|ppn|vat)/i;
const SERVICE = /(service|servis|layanan|svc|s\/c)/i;
const DISCOUNT = /(disc|diskon|discount|potongan|promo|voucher|payday|cashback|hemat)/i;
const SKIP = /(tunai|cash|kembali|change|bayar|pembayaran|payment|debit|kredit|credit|card|qris|gopay|ovo|dana|shopeepay|grab|gofood|npwp|telp|phone|kasir|cashier|csh|table|tbl|meja|struk|receipt|invoice|bill|tanggal|date|jam|time|print|pax|guest|thank|terima kasih|rounding|pembulatan|panggil|order|antrian|pos\b)/i;

function toNumber(raw: string): number {
  let s = raw.replace(/rp\.?/i, "").replace(/\s/g, "");
  const negative = s.startsWith("-");
  s = s.replace(/^-/, "");
  // drop trailing cents: "125.000,00" or "27000.00"
  if (/[.,]\d{3}[.,]\d{2}$/.test(s) || /^\d{4,}[.,]\d{2}$/.test(s)) s = s.slice(0, -3);
  const n = Number(s.replace(/[^\d]/g, ""));
  return negative ? -n : n;
}

function readQty(raw: string): number {
  const n = Number(raw.replace(/[Il|]/g, "1"));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 1;
}

function cleanName(name: string): string {
  return name
    .replace(/@\s?[\d.,]+/g, "")
    .replace(/\[[^\]]*\]/g, "") // "[OL]" style tags
    .replace(/[^\p{L}\p{N}\s&'()/+.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLetters(s: string) {
  return /\p{L}{2,}/u.test(s);
}

/** "* LESS ICE - FELICIA" -> ["Felicia"];  "* LESS SWEET - ANDERSEN,ERIC" -> ["Andersen","Eric"];  "* IMAM" -> ["Imam"] */
function namesFromModifier(text: string): string[] {
  const body = text.replace(/^[*•>+-]+\s*/, "").trim();
  const afterDash = body.includes(" - ") ? body.slice(body.lastIndexOf(" - ") + 3) : body;
  // a modifier with no dash is a name only if it is a short single word or comma list ("* IMAM")
  if (!body.includes(" - ") && /\s/.test(body.replace(/\s*,\s*/g, ","))) return [];
  return afterDash
    .split(/\s*(?:,|&|\/|\bdan\b|\band\b)\s*/i)
    .map((n) => n.replace(/[^\p{L}' -]/gu, "").trim())
    .filter((n) => n.length >= 2 && !/^(less|extra|no|tanpa|ice|sugar|sweet|hot|cold|normal|large|regular|small)$/i.test(n))
    .map((n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase());
}

export function emptyReceipt(): ParsedReceipt {
  return { items: [], tax: 0, service: 0, discount: 0, subtotal: null, total: null, taxIncluded: false, taxPrinted: 0 };
}

export function parseReceiptText(text: string): ParsedReceipt {
  const r = emptyReceipt();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[|_~]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let pendingName: string | null = null; // a name line waiting for its "1x 27,000 27,000" line
  // "Gofood Payday Rp 1000" is a promo name; its real amount is on the next "5x -1,000 -5,000" line
  let pendingPromo: number | null = null;
  let inFooter = false;
  const settlePromo = () => {
    if (pendingPromo !== null) r.discount += pendingPromo;
    pendingPromo = null;
  };

  const pushItem = (name: string, quantity: number, price: number) => {
    if (price < 0 || DISCOUNT.test(name)) {
      r.discount += Math.abs(price);
      return;
    }
    if (!price) return;
    r.items.push({ name, quantity, price, people: [] });
  };

  for (const line of lines) {
    if (TAX_INCLUDED.test(line)) {
      r.taxIncluded = true;
      continue;
    }

    // Modifier / note lines belong to the item above: "* LESS ICE - FELICIA"
    if (/^[*•>]/.test(line)) {
      const last = r.items[r.items.length - 1];
      if (last && !inFooter) last.people.push(...namesFromModifier(line));
      continue;
    }

    const qty = line.match(QTY_LINE);
    if (qty && !inFooter) {
      const quantity = readQty(qty[1]);
      const unit = toNumber(qty[2]);
      const lineTotal = qty[3] ? toNumber(qty[3]) : unit * quantity;
      if (pendingPromo !== null) {
        r.discount += Math.abs(lineTotal);
        pendingPromo = null;
      } else if (pendingName) {
        pushItem(pendingName, quantity, lineTotal);
      } else if (lineTotal < 0) {
        r.discount += Math.abs(lineTotal);
      }
      pendingName = null;
      continue;
    }
    settlePromo();

    const m = line.match(PRICE_AT_END);
    const label = m ? line.slice(0, m.index).trim() : line;

    if (FOOTER_START.test(label)) inFooter = true;

    if (m) {
      const amount = toNumber(m[1]);
      const abs = Math.abs(amount);
      if (SUBTOTAL.test(label)) {
        r.subtotal = abs;
        continue;
      }
      if (TOTAL.test(label)) {
        r.total = abs;
        continue;
      }
      if (TAX.test(label) && !SKIP.test(label)) {
        r.taxPrinted += abs;
        continue;
      }
      if (SERVICE.test(label)) {
        r.service += abs;
        continue;
      }
      if (DISCOUNT.test(label) && hasLetters(label)) {
        // "Diskon -10.000" (anywhere) is the discount itself. Above the totals, "Gofood Payday Rp 1000"
        // may be followed by a "5x -1,000 -5,000" line with the real amount, so hold it until then.
        pendingName = null;
        if (amount < 0 || inFooter) r.discount += abs;
        else pendingPromo = abs;
        continue;
      }
      if (inFooter || SKIP.test(label)) {
        pendingName = null;
        continue;
      }
      if (amount < 0) {
        r.discount += abs;
        pendingName = null;
        continue;
      }

      // One-line item: "2 Nasi Goreng 50.000" / "Nasi Goreng x2 50.000" / "Nasi Goreng 2 25.000 50.000"
      let name = label.replace(new RegExp(`(${MONEY})\\s*$`, "i"), "").trim(); // drop a unit price column
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
      name = cleanName(name);
      if (name.length >= 2 && hasLetters(name)) {
        pushItem(name, Math.max(1, quantity), abs);
        pendingName = null;
        continue;
      }
      // a price with no usable name: maybe the name was on the line above
      if (pendingName) {
        pushItem(pendingName, 1, abs);
        pendingName = null;
      }
      continue;
    }

    // A text-only line: possibly the name of the next item
    if (!inFooter && hasLetters(line) && !SKIP.test(line) && !/^[-=*.]{3,}$/.test(line)) {
      const name = cleanName(line.replace(/\bRp\.?\s?[\d.,]+/i, ""));
      pendingName = name.length >= 2 ? (DISCOUNT.test(line) ? `${name} (promo)` : name) : null;
    }
  }

  settlePromo();

  // de-duplicate people per item, keep receipt order
  for (const item of r.items) item.people = [...new Set(item.people)];

  // tax: only add it on top when the receipt does NOT say it is already included
  const itemsSum = r.items.reduce((a, i) => a + i.price, 0);
  if (r.taxIncluded) {
    r.tax = 0;
  } else {
    r.tax = r.taxPrinted;
    // Many receipts print tax as information only. If items - discount already equal the total, it is included.
    if (r.total !== null && r.taxPrinted > 0 && itemsSum - r.discount === r.total) {
      r.taxIncluded = true;
      r.tax = 0;
    }
  }
  return r;
}

/** Items + tax + service - discount, i.e. what the bill adds up to. */
export function receiptSum(r: Pick<ParsedReceipt, "items" | "tax" | "service" | "discount">) {
  return r.items.reduce((a, i) => a + i.price, 0) + r.tax + r.service - r.discount;
}

/**
 * Match names printed on the receipt ("FELICIA", "ERIC") to group members
 * ("Felicia", "Eric Tan"). Compares first names, ignoring case.
 */
export function matchPeople(people: string[], members: { id: string; name: string }[]): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}]/gu, "");
  const ids = new Set<string>();
  for (const person of people) {
    const p = norm(person);
    if (p.length < 2) continue;
    const hit = members.find((m) => {
      const words = m.name.split(/\s+/).map(norm);
      return words.includes(p) || norm(m.name) === p;
    });
    if (hit) ids.add(hit.id);
  }
  return [...ids];
}
