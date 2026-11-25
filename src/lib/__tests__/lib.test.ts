import { describe, expect, it } from "vitest";
import { allocate, netBalances, splitItemized, splitSimple, suggestTransfers } from "../split";
import { crc16, isValidQris, qrisWithAmount, parseTlv } from "../qris";
import { matchPeople, parseReceiptText, receiptSum } from "../receipt-parser";
import fs from "node:fs";
import path from "node:path";
import { formatIDR, parseIDR } from "../money";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("allocate", () => {
  it("always sums to the total", () => {
    expect(allocate(100000, [1, 1, 1])).toEqual([33334, 33333, 33333]);
    expect(sum(allocate(99999, [3, 2, 7]))).toBe(99999);
    expect(sum(allocate(-10001, [1, 2]))).toBe(-10001);
    expect(allocate(0, [1, 1])).toEqual([0, 0]);
  });
});

describe("splitSimple", () => {
  it("handles each type", () => {
    const p = [{ memberId: "a", value: 50 }, { memberId: "b", value: 50 }];
    expect(splitSimple({ type: "EQUAL", total: 30001, participants: p })).toEqual({ a: 15001, b: 15000 });
    expect(splitSimple({ type: "PERCENT", total: 30000, participants: p })).toEqual({ a: 15000, b: 15000 });
    expect(() => splitSimple({ type: "EXACT", total: 1, participants: p })).toThrow();
    expect(
      splitSimple({ type: "SHARES", total: 40000, participants: [{ memberId: "a", value: 3 }, { memberId: "b", value: 1 }] }),
    ).toEqual({ a: 30000, b: 10000 });
  });
});

describe("splitItemized", () => {
  it("splits shared items and spreads tax/service by subtotal", () => {
    const r = splitItemized({
      items: [
        { name: "Nasi Goreng", quantity: 1, price: 30000, assignees: ["a"] },
        { name: "Es Teh", quantity: 2, price: 10000, assignees: ["b"] },
        { name: "Pizza", quantity: 1, price: 60000, assignees: ["a", "b", "c"] },
      ],
      tax: 10000, // 10%
      service: 5000,
      discount: 0,
    });
    expect(r.subtotal).toBe(100000);
    expect(r.total).toBe(115000);
    expect(r.perMember.a.subtotal).toBe(50000);
    expect(r.perMember.a.total).toBe(57500);
    expect(r.perMember.b.total).toBe(34500);
    expect(r.perMember.c.total).toBe(23000);
    expect(sum(Object.values(r.perMember).map((m) => m.total))).toBe(r.total);
  });
  it("rejects unassigned items", () => {
    expect(() =>
      splitItemized({ items: [{ name: "X", quantity: 1, price: 1, assignees: [] }], tax: 0, service: 0, discount: 0 }),
    ).toThrow();
  });
});

describe("balances", () => {
  it("nets and settles", () => {
    const bal = netBalances(
      ["a", "b", "c"],
      [{ paidById: "a", total: 90000, shares: [{ memberId: "a", amount: 30000 }, { memberId: "b", amount: 30000 }, { memberId: "c", amount: 30000 }] }],
      [{ fromId: "b", toId: "a", amount: 30000 }],
    );
    expect(bal).toEqual({ a: 30000, b: 0, c: -30000 });
    expect(suggestTransfers(bal)).toEqual([{ fromId: "c", toId: "a", amount: 30000 }]);
  });
});

describe("qris", () => {
  // Build a fake static QRIS with a valid CRC
  const tlv = (tag: string, v: string) => tag + String(v.length).padStart(2, "0") + v;
  const body =
    tlv("00", "01") +
    tlv("01", "11") +
    tlv("26", tlv("00", "ID.DANA.WWW") + tlv("01", "936009153000000000") + tlv("03", "UMI")) +
    tlv("51", tlv("00", "ID.CO.QRIS.WWW") + tlv("02", "ID1020000000000") + tlv("03", "UMI")) +
    tlv("52", "5812") +
    tlv("53", "360") +
    tlv("58", "ID") +
    tlv("59", "MICHELLE") +
    tlv("60", "JAKARTA") +
    tlv("61", "12340") +
    "6304";
  const staticQris = body + crc16(body);

  it("validates CRC", () => {
    expect(isValidQris(staticQris)).toBe(true);
    expect(isValidQris(staticQris.slice(0, -1) + "0")).toBe(staticQris.endsWith("0"));
  });
  it("adds an amount and stays valid", () => {
    const dyn = qrisWithAmount(staticQris, 57500);
    expect(isValidQris(dyn)).toBe(true);
    const tags = parseTlv(dyn);
    expect(tags.find((t) => t.tag === "54")?.value).toBe("57500");
    expect(tags.find((t) => t.tag === "01")?.value).toBe("12");
  });
});

describe("receipt parser", () => {
  it("reads items, tax and service", () => {
    const text = `WARUNG MAKAN SEDAP
Jl. Sudirman 1
2 Nasi Goreng 50.000
Es Teh Manis 8.000
Ayam Bakar x2 70,000
Subtotal 128.000
Service 5% 6.400
PB1 10% 13.440
Diskon -10.000
TOTAL 137.840
Tunai 150.000
Kembali 12.160`;
    const r = parseReceiptText(text);
    expect(r.items).toEqual([
      { name: "Nasi Goreng", quantity: 2, price: 50000, people: [] },
      { name: "Es Teh Manis", quantity: 1, price: 8000, people: [] },
      { name: "Ayam Bakar", quantity: 2, price: 70000, people: [] },
    ]);
    expect(r.service).toBe(6400);
    expect(r.tax).toBe(13440);
    expect(r.discount).toBe(10000);
    expect(r.total).toBe(137840);
    expect(r.taxIncluded).toBe(false);
    expect(receiptSum(r)).toBe(137840);
  });

  const tuku = fs.readFileSync(path.join(__dirname, "fixtures/tuku-receipt.txt"), "utf8");
  const expectTuku = (text: string) => {
    const r = parseReceiptText(text);
    expect(r.items.map((i) => [i.quantity, i.name, i.price, i.people])).toEqual([
      [1, "Es Kopi Susu Tetangga", 27000, ["Somantri"]],
      [2, "Es Kopi Susu Tetangga", 54000, ["Andersen", "Eric"]],
      [1, "Es Kopi Susu Tetangga", 27000, ["Imam"]],
      [1, "Es Kopi Susu Tetangga", 27000, ["Papin"]],
      [1, "Iced Kopi Hitam Tetangga", 26000, ["Felicia"]],
    ]);
    expect(r.discount).toBe(5000);
    expect(r.taxIncluded).toBe(true);
    expect(r.tax).toBe(0);
    expect(r.taxPrinted).toBe(14182);
    expect(r.total).toBe(156000);
    expect(receiptSum(r)).toBe(156000);
  };

  it("reads two-line items, names, promos and tax-included receipts", () => expectTuku(tuku));

  it("copes with common OCR mistakes", () => {
    const noisy = tuku
      .replace("1x 27,000 27,000", "Ix 27.000 27.000") // 1 read as I, comma read as dot
      .replace("Sub Total", "Sub Tota1")
      .replace("[OL]", "[0L]")
      .replace("TOTAL 156,000", "TOTAL 156.000");
    expectTuku(noisy);
  });

  it("treats printed tax as included when items already add up to the total", () => {
    const r = parseReceiptText("Kopi 20.000\nRoti 10.000\nTotal 30.000\nPPN 2.727");
    expect(r.taxIncluded).toBe(true);
    expect(r.tax).toBe(0);
    expect(receiptSum(r)).toBe(30000);
  });

  it("matches receipt names to members by first name", () => {
    const members = [
      { id: "f", name: "Felicia" },
      { id: "e", name: "Eric Tan" },
      { id: "a", name: "Andi" },
    ];
    expect(matchPeople(["FELICIA"], members)).toEqual(["f"]);
    expect(matchPeople(["Andersen", "Eric"], members)).toEqual(["e"]);
    expect(matchPeople(["Nobody"], members)).toEqual([]);
  });
});

describe("money", () => {
  it("formats IDR", () => {
    expect(formatIDR(1250000)).toBe("Rp\u00a01.250.000");
    expect(formatIDR(-5000)).toBe("-Rp\u00a05.000");
    expect(parseIDR("Rp 1.250.000")).toBe(1250000);
  });
});
