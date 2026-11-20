"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveExpense, type ExpenseInput } from "@/app/actions";
import { splitItemized, splitSimple, type SplitType } from "@/lib/split";
import { formatIDR } from "@/lib/money";
import { compressImage } from "@/lib/image";
import { MoneyInput } from "./money-input";
import { MemberPicker } from "./member-picker";
import { Camera, Plus, ScanText, X } from "lucide-react";

interface Member {
  id: string;
  name: string;
}

interface ItemRow {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number;
  assignees: string[];
}

export interface ExpenseFormInitial {
  expenseId?: string;
  description: string;
  date: string; // yyyy-mm-dd
  paidById: string;
  splitType: SplitType;
  total: number;
  receiptUrl: string | null;
  note: string;
  items: { name: string; quantity: number; price: number; assignees: string[] }[];
  tax: number;
  service: number;
  discount: number;
  participants: { memberId: string; value: number }[];
}

const TABS: { type: SplitType; label: string }[] = [
  { type: "ITEMIZED", label: "By item" },
  { type: "EQUAL", label: "Equal" },
  { type: "EXACT", label: "Exact" },
  { type: "PERCENT", label: "Percent" },
  { type: "SHARES", label: "Shares" },
];

/** yyyy-mm-dd for today in Indonesia (WIB), regardless of the device clock's zone. */
function todayInJakarta() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

let keySeq = 0;
const newKey = () => `row-${++keySeq}`;

function toRows(items: ExpenseFormInitial["items"]): ItemRow[] {
  return items.map((i) => {
    const unit = i.price / i.quantity;
    // keep the receipt's line total exact if it doesn't divide evenly
    return Number.isInteger(unit)
      ? { key: newKey(), name: i.name, quantity: i.quantity, unitPrice: unit, assignees: i.assignees }
      : { key: newKey(), name: `${i.quantity}x ${i.name}`, quantity: 1, unitPrice: i.price, assignees: i.assignees };
  });
}

export function ExpenseForm({
  groupId,
  members,
  meId,
  initial,
}: {
  groupId: string;
  members: Member[];
  meId: string;
  initial?: ExpenseFormInitial;
}) {
  const router = useRouter();
  const [pending, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.date ?? todayInJakarta());
  const [paidById, setPaidById] = useState(initial?.paidById ?? meId);
  const [splitType, setSplitType] = useState<SplitType>(initial?.splitType ?? "ITEMIZED");
  const [note, setNote] = useState(initial?.note ?? "");

  // receipt
  const [receiptUrl, setReceiptUrl] = useState<string | null>(initial?.receiptUrl ?? null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(initial?.receiptUrl ?? null);
  const [ocr, setOcr] = useState<{ pct: number; status: string } | null>(null);
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null);

  // itemized
  const [items, setItems] = useState<ItemRow[]>(() =>
    initial?.items.length ? toRows(initial.items) : [{ key: newKey(), name: "", quantity: 1, unitPrice: 0, assignees: [] }],
  );
  const [tax, setTax] = useState(initial?.tax ?? 0);
  const [service, setService] = useState(initial?.service ?? 0);
  const [discount, setDiscount] = useState(initial?.discount ?? 0);

  // simple splits
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [participants, setParticipants] = useState<Record<string, { on: boolean; value: number }>>(() => {
    const byId = new Map(initial?.participants.map((p) => [p.memberId, p.value]));
    return Object.fromEntries(
      members.map((m) => [
        m.id,
        { on: initial?.participants.length ? byId.has(m.id) : true, value: byId.get(m.id) ?? (initial?.splitType === "SHARES" ? 1 : 0) },
      ]),
    );
  });

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  // ---------- live preview ----------
  const previewResult = useMemo(() => {
    try {
      if (splitType === "ITEMIZED") {
        const filled = items.filter((i) => i.name.trim() || i.unitPrice > 0);
        const unassigned = filled.filter((i) => i.assignees.length === 0);
        if (unassigned.length) return { error: `Pick who had ${unassigned.length === 1 ? "1 item" : `${unassigned.length} items`} still marked in red.` };
        if (!filled.length) return { error: "Add the items from the receipt." };
        const r = splitItemized({
          items: filled.map((i) => ({ name: i.name || "Item", quantity: i.quantity, price: i.quantity * i.unitPrice, assignees: i.assignees })),
          tax,
          service,
          discount,
        });
        return { total: r.total, perMember: Object.fromEntries(Object.entries(r.perMember).map(([id, m]) => [id, m.total])) };
      }
      const ps = members
        .filter((m) => participants[m.id]?.on)
        .map((m) => ({ memberId: m.id, value: participants[m.id].value }));
      if (!total) return { error: "Enter the total amount." };
      return { total, perMember: splitSimple({ type: splitType, total, participants: ps }) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Can't split yet" };
    }
  }, [splitType, items, tax, service, discount, members, participants, total]);

  // ---------- receipt photo ----------
  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setOcrNote(null);
    try {
      const small = await compressImage(file);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
      setReceiptUrl(null); // will upload the new one on save
    } catch {
      setError("Couldn't read that image");
    }
  }

  async function scan() {
    if (!photo && !preview) return;
    setOcr({ pct: 0, status: "starting" });
    setOcrNote(null);
    try {
      const { scanReceipt } = await import("@/lib/ocr");
      const source: Blob = photo ?? (await fetch(preview!).then((r) => r.blob()));
      const r = await scanReceipt(source, (pct, status) => setOcr({ pct, status }));
      if (r.items.length === 0) {
        setOcrNote("No items found. Try a sharper photo taken straight on, or type the items below.");
      } else {
        const rows = toRows(r.items.map((i) => ({ ...i, assignees: [] })));
        // replace empty starter row, otherwise append
        setItems((prev) => [...prev.filter((p) => p.name.trim() || p.unitPrice > 0), ...rows]);
        if (r.tax) setTax(r.tax);
        if (r.service) setService(r.service);
        if (r.discount) setDiscount(r.discount);
        setReceiptTotal(r.total);
        setOcrNote(`Found ${r.items.length} ${r.items.length === 1 ? "item" : "items"}. Check each name and price against the receipt, then pick who had what.`);
      }
    } catch {
      setOcrNote("Scanning failed. The scanner needs an internet connection the first time it runs. You can also type the items below.");
    } finally {
      setOcr(null);
    }
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photo) return receiptUrl;
    const fd = new FormData();
    fd.append("file", photo, "receipt.jpg");
    const res = await fetch("/api/receipts", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Upload failed");
    return json.url as string;
  }

  // ---------- items ----------
  const updateItem = (key: string, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const addItem = () =>
    setItems((prev) => [...prev, { key: newKey(), name: "", quantity: 1, unitPrice: 0, assignees: [] }]);
  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  // ---------- save ----------
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if ("error" in previewResult) {
      setError(previewResult.error ?? "Can't split yet");
      return;
    }
    startSaving(async () => {
      let url = receiptUrl;
      try {
        url = await uploadPhoto();
      } catch (err) {
        setError(`The receipt photo was not saved (${err instanceof Error ? err.message : "upload failed"}). The bill was saved without it.`);
        url = null;
      }
      const input: ExpenseInput = {
        groupId,
        expenseId: initial?.expenseId,
        description: description || "Receipt",
        date,
        paidById,
        splitType,
        note,
        receiptUrl: url,
        total: splitType === "ITEMIZED" ? undefined : total,
        participants:
          splitType === "ITEMIZED"
            ? []
            : members.filter((m) => participants[m.id]?.on).map((m) => ({ memberId: m.id, value: participants[m.id].value })),
        items:
          splitType === "ITEMIZED"
            ? items
                .filter((i) => i.name.trim() || i.unitPrice > 0)
                .map((i) => ({ name: i.name.trim() || "Item", quantity: i.quantity, price: i.quantity * i.unitPrice, assignees: i.assignees }))
            : [],
        tax,
        service,
        discount,
      };
      const res = await saveExpense(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/groups/${groupId}/expenses/${res.id}`);
      router.refresh();
    });
  }

  const pct = (p: number) => Math.round((subtotal * p) / 100);

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* basics */}
      <section className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="desc">
            Description
          </label>
          <input
            id="desc"
            className="input"
            placeholder="Dinner at Warung Sedap"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={120}
          />
        </div>
        <div>
          <label className="label" htmlFor="paidBy">
            Paid by
          </label>
          <select id="paidBy" className="input" value={paidById} onChange={(e) => setPaidById(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.id === meId ? " (you)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">
            Date
          </label>
          <input id="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </section>

      {/* split type */}
      <div>
        <p className="label">Split</p>
        <div className="seg" role="radiogroup" aria-label="How to split">
          {TABS.map((t) => (
            <button
              key={t.type}
              type="button"
              role="radio"
              aria-checked={splitType === t.type}
              className={`seg-item ${splitType === t.type ? "seg-on" : ""}`}
              onClick={() => {
                setSplitType(t.type);
                if (t.type === "SHARES") {
                  setParticipants((prev) =>
                    Object.fromEntries(Object.entries(prev).map(([id, p]) => [id, { ...p, value: p.value || 1 }])),
                  );
                }
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* receipt photo (any split type can attach one) */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Receipt photo</h2>
          {preview && splitType === "ITEMIZED" && (
            <button type="button" className="btn-primary btn-sm" onClick={scan} disabled={!!ocr}>
              <ScanText size={14} aria-hidden />
              {ocr ? `Scanning ${ocr.pct}%` : "Scan items from photo"}
            </button>
          )}
        </div>
        {preview ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Receipt"
              className="max-h-96 rounded-md border border-line object-contain sm:w-1/2"
            />
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <label className="btn btn-sm cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      onPhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  Change photo
                </label>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setPhoto(null);
                    setPreview(null);
                    setReceiptUrl(null);
                  }}
                >
                  Remove photo
                </button>
              </div>
              {splitType === "ITEMIZED" && (
                <p className="muted">Scan the photo to fill in the items, or type them in below.</p>
              )}
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line p-8 text-center text-sm text-muted transition-colors hover:border-ink hover:text-ink">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                onPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Camera size={24} aria-hidden />
            Take or upload a photo of the receipt (optional)
          </label>
        )}
        {ocrNote && <p className="note-box">{ocrNote}</p>}
      </section>

      {splitType === "ITEMIZED" ? (
        <section className="card space-y-4">
          <div>
            <h2 className="text-lg font-bold">Items</h2>
            <p className="muted">Enter each item and pick who had it.</p>
          </div>
          <ul className="space-y-3">
            {items.map((item, idx) => (
              <li key={item.key} className="grid grid-cols-12 gap-2 rounded-md border border-line bg-bg p-3">
                <div className="col-span-12 sm:col-span-6">
                  <input
                    aria-label={`Item ${idx + 1} name`}
                    className="input"
                    placeholder="Nasi goreng"
                    value={item.name}
                    maxLength={80}
                    onChange={(e) => updateItem(item.key, { name: e.target.value })}
                  />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <input
                    aria-label={`Item ${idx + 1} quantity`}
                    className="input text-center tabular-nums"
                    inputMode="numeric"
                    onFocus={(e) => e.target.select()}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.key, {
                        quantity: Math.max(1, Math.min(999, Number(e.target.value.replace(/\D/g, "")) || 1)),
                      })
                    }
                  />
                </div>
                <MoneyInput
                  ariaLabel={`Item ${idx + 1} price each`}
                  className="col-span-9 sm:col-span-4"
                  value={item.unitPrice}
                  onChange={(v) => updateItem(item.key, { unitPrice: v })}
                  placeholder="Price each"
                />
                <div className="col-span-12 sm:col-span-8">
                  <MemberPicker
                    label={`Who had item ${idx + 1}`}
                    members={members}
                    selected={item.assignees}
                    onChange={(ids) => updateItem(item.key, { assignees: ids })}
                  />
                </div>
                <div className="col-span-12 flex items-center justify-between gap-2 sm:col-span-4 sm:justify-end">
                  <span className="text-sm font-semibold tabular-nums">{formatIDR(item.quantity * item.unitPrice)}</span>
                  <button
                    type="button"
                    className="btn btn-sm h-8 w-8 px-0"
                    aria-label={`Remove item ${idx + 1}`}
                    onClick={() => removeItem(item.key)}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="btn w-full" onClick={addItem}>
            <Plus size={14} aria-hidden />
            Add item
          </button>

          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="tax">
                Tax (PB1)
              </label>
              <MoneyInput id="tax" value={tax} onChange={setTax} />
              <div className="mt-2 flex gap-1">
                {[10, 11].map((p) => (
                  <button key={p} type="button" className="btn btn-sm" onClick={() => setTax(pct(p))}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="service">
                Service charge
              </label>
              <MoneyInput id="service" value={service} onChange={setService} />
              <div className="mt-2 flex gap-1">
                {[5, 10].map((p) => (
                  <button key={p} type="button" className="btn btn-sm" onClick={() => setService(pct(p))}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="discount">
                Discount
              </label>
              <MoneyInput id="discount" value={discount} onChange={setDiscount} />
            </div>
          </div>
          <dl className="space-y-1 border-t border-line pt-4 text-sm">
            <Row label="Subtotal" value={subtotal} />
            {tax > 0 && <Row label="Tax" value={tax} />}
            {service > 0 && <Row label="Service charge" value={service} />}
            {discount > 0 && <Row label="Discount" value={-discount} />}
            <Row label="Total" value={subtotal + tax + service - discount} bold />
          </dl>
          {receiptTotal !== null && receiptTotal !== subtotal + tax + service - discount && (
            <p className="note-box">
              The receipt total reads {formatIDR(receiptTotal)}, but the items add up to{" "}
              {formatIDR(subtotal + tax + service - discount)}. Check for a misread price or a missing item.
            </p>
          )}
        </section>
      ) : (
        <section className="card space-y-4">
          <div>
            <label className="label" htmlFor="total">
              Total amount
            </label>
            <MoneyInput id="total" value={total} onChange={setTotal} />
          </div>
          <div>
            <p className="label">Split between</p>
            <ul className="divide-y divide-line">
              {members.map((m) => {
                const p = participants[m.id];
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                    <label className="flex flex-1 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={p.on}
                        onChange={(e) => setParticipants({ ...participants, [m.id]: { ...p, on: e.target.checked } })}
                      />
                      {m.name}
                    </label>
                    {p.on && splitType === "EXACT" && (
                      <MoneyInput
                        ariaLabel={`${m.name} amount`}
                        className="w-40"
                        value={p.value}
                        onChange={(v) => setParticipants({ ...participants, [m.id]: { ...p, value: v } })}
                      />
                    )}
                    {p.on && (splitType === "PERCENT" || splitType === "SHARES") && (
                      <div className="flex items-center gap-2">
                        <input
                          aria-label={`${m.name} ${splitType === "PERCENT" ? "percent" : "shares"}`}
                          className="input w-20 text-right tabular-nums"
                          inputMode="numeric"
                          value={p.value || ""}
                          placeholder="0"
                          onChange={(e) =>
                            setParticipants({
                              ...participants,
                              [m.id]: { ...p, value: Math.min(10000, Number(e.target.value.replace(/\D/g, "")) || 0) },
                            })
                          }
                        />
                        <span className="w-12 text-xs text-muted">{splitType === "PERCENT" ? "%" : "shares"}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* per-person preview */}
      <section className="rounded-lg bg-strong p-5 text-strong-fg">
        <h2 className="text-lg font-bold">Each person pays</h2>
        {"error" in previewResult ? (
          <p className="mt-2 text-sm text-strong-fg/80">{previewResult.error}</p>
        ) : (
          <ul className="mt-3 divide-y divide-strong-fg/20 text-sm">
            {members
              .filter((m) => previewResult.perMember?.[m.id])
              .map((m) => (
                <li key={m.id} className="flex justify-between py-2">
                  <span>
                    {m.name}
                    {m.id === paidById && <span className="text-strong-fg/75"> (paid the bill)</span>}
                  </span>
                  <span className="font-semibold tabular-nums">{formatIDR(previewResult.perMember![m.id])}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <div>
        <label className="label" htmlFor="note">
          Note (optional)
        </label>
        <textarea
          id="note"
          className="input"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>

      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 py-3 text-base" disabled={pending || !!ocr}>
          {pending ? "Saving..." : "Calculate and save"}
        </button>
        <button type="button" className="btn py-3" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : "text-muted"}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatIDR(value)}</dd>
    </div>
  );
}
