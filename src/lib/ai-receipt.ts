import "server-only";
import { z } from "zod";
import { emptyReceipt, type ParsedReceipt } from "./receipt-parser";

/**
 * Optional "Smart scan": sends the receipt photo to Google's Gemini API and
 * asks for the items back as JSON. Much more accurate than in-browser OCR on
 * crumpled or angled photos. Only used when GEMINI_API_KEY is set.
 */

export const smartScanEnabled = Boolean(process.env.GEMINI_API_KEY);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

const PROMPT = `You read Indonesian restaurant and cafe receipts for a bill-splitting app.
Return ONLY what is printed on the receipt. Never invent items.

Rules:
- Amounts are whole Indonesian Rupiah integers. "27,000", "27.000" and "Rp 27.000" all mean 27000.
- items: every ordered product line. quantity = the printed quantity (default 1). lineTotal = quantity x unit price, as printed in the right-hand column.
- Some receipts print the item name on one line and "1x 27,000 27,000" on the next line: that is ONE item.
- Lines starting with "*" under an item are notes for that item. If a note ends with " - NAME" or is just a name (e.g. "* LESS ICE - FELICIA", "* LESS SWEET - ANDERSEN,ERIC", "* IMAM"), put those person names in that item's people list. Do not create items from notes.
- Promotions, vouchers and discounts (negative amounts, e.g. "Gofood Payday 5x -1,000 -5,000") are NOT items: add their absolute value to discount.
- taxIncluded = true when the receipt says prices already include tax (e.g. "Harga Sudah Termasuk Pajak", "incl. tax"), or when the item total minus discount already equals the TOTAL.
- tax = the PB1 / PPN / tax amount printed (even if included). service = service charge printed, else 0.
- subtotal and total as printed, or null if missing.
- Ignore payment, cash, change, card, order number and header lines.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          quantity: { type: "INTEGER" },
          lineTotal: { type: "INTEGER" },
          people: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["name", "quantity", "lineTotal", "people"],
      },
    },
    discount: { type: "INTEGER" },
    tax: { type: "INTEGER" },
    taxIncluded: { type: "BOOLEAN" },
    service: { type: "INTEGER" },
    subtotal: { type: "INTEGER", nullable: true },
    total: { type: "INTEGER", nullable: true },
  },
  required: ["items", "discount", "tax", "taxIncluded", "service", "subtotal", "total"],
};

const int = z.coerce.number().transform((n) => Math.round(Math.abs(n)));
const AiReceipt = z.object({
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.coerce.number().int().min(1).max(999).catch(1),
        lineTotal: int,
        people: z.array(z.string()).catch([]),
      }),
    )
    .max(100),
  discount: int.catch(0),
  tax: int.catch(0),
  taxIncluded: z.boolean().catch(false),
  service: int.catch(0),
  subtotal: int.nullable().catch(null),
  total: int.nullable().catch(null),
});

export class SmartScanError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export async function smartScanReceipt(image: Blob): Promise<ParsedReceipt> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new SmartScanError("Smart scan is not set up", 501);

  const data = Buffer.from(await image.arrayBuffer()).toString("base64");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: image.type || "image/jpeg", data } }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (res.status === 429) throw new SmartScanError("Smart scan has reached its free limit for now. Try again later.", 429);
  if (res.status === 404) throw new SmartScanError(`The Gemini model "${MODEL}" was not found. Check GEMINI_MODEL.`, 500);
  if (!res.ok) throw new SmartScanError(`Smart scan failed (${res.status}).`, 502);

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new SmartScanError("Smart scan returned something unreadable.", 502);
  }
  return normalizeAiReceipt(json);
}

/** Turn the model's JSON into the same shape the in-browser reader returns. Exported for tests. */
export function normalizeAiReceipt(json: unknown): ParsedReceipt {
  const parsed = AiReceipt.safeParse(json);
  if (!parsed.success) throw new SmartScanError("Smart scan returned an unexpected format.", 502);
  const a = parsed.data;
  const r = emptyReceipt();
  for (const item of a.items) {
    const name = item.name.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!name || !item.lineTotal) continue;
    r.items.push({
      name,
      quantity: item.quantity,
      price: item.lineTotal,
      people: [...new Set(item.people.map((p) => p.trim()).filter((p) => p.length >= 2))].map(
        (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(),
      ),
    });
  }
  r.discount = a.discount;
  r.service = a.service;
  r.subtotal = a.subtotal;
  r.total = a.total;
  r.taxPrinted = a.tax;

  // Same rule as the in-browser reader: never add tax that is already inside the prices
  const itemsSum = r.items.reduce((s, i) => s + i.price, 0);
  r.taxIncluded = a.taxIncluded || (r.total !== null && a.tax > 0 && itemsSum - r.discount + r.service === r.total);
  r.tax = r.taxIncluded ? 0 : a.tax;
  return r;
}
