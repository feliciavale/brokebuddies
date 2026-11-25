import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { normalizeAiReceipt } = await import("../ai-receipt");

describe("smart scan output", () => {
  // What Gemini should return for the Toko Kopi Tuku receipt
  const tuku = {
    items: [
      { name: "Es Kopi Susu Tetangga [OL]", quantity: 1, lineTotal: 27000, people: ["SOMANTRI"] },
      { name: "Es Kopi Susu Tetangga [OL]", quantity: 2, lineTotal: 54000, people: ["ANDERSEN", "ERIC"] },
      { name: "Es Kopi Susu Tetangga [OL]", quantity: 1, lineTotal: 27000, people: ["IMAM"] },
      { name: "Es Kopi Susu Tetangga [OL]", quantity: 1, lineTotal: 27000, people: ["PAPIN"] },
      { name: "Iced Kopi Hitam Tetangga [OL]", quantity: 1, lineTotal: 26000, people: ["FELICIA"] },
    ],
    discount: 5000,
    tax: 14182,
    taxIncluded: true,
    service: 0,
    subtotal: 156000,
    total: 156000,
  };

  it("keeps items, people and discount, and never adds included tax", () => {
    const r = normalizeAiReceipt(tuku);
    expect(r.items).toHaveLength(5);
    expect(r.items[1]).toEqual({ name: "Es Kopi Susu Tetangga", quantity: 2, price: 54000, people: ["Andersen", "Eric"] });
    expect(r.tax).toBe(0);
    expect(r.taxPrinted).toBe(14182);
    expect(r.discount).toBe(5000);
  });

  it("treats tax as included when items already add up to the total, even if the model says otherwise", () => {
    const r = normalizeAiReceipt({ ...tuku, taxIncluded: false });
    expect(r.taxIncluded).toBe(true);
    expect(r.tax).toBe(0);
  });

  it("adds tax when it is not part of the total", () => {
    const r = normalizeAiReceipt({
      items: [{ name: "Nasi Goreng", quantity: 1, lineTotal: 30000, people: [] }],
      discount: 0, tax: 3000, taxIncluded: false, service: 0, subtotal: 30000, total: 33000,
    });
    expect(r.tax).toBe(3000);
  });

  it("rejects malformed output", () => {
    expect(() => normalizeAiReceipt({ nope: true })).toThrow();
  });
});
