"use client";

import { useId, useState } from "react";
import { QrCode } from "lucide-react";
import { decodeQrFromFile } from "@/lib/image";
import { isValidQris, qrisName } from "@/lib/qris";
import { QrisCode } from "./qris-code";

export interface PaymentValues {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrisPayload: string;
}

export const emptyPayment: PaymentValues = { bankName: "", accountNumber: "", accountHolder: "", qrisPayload: "" };

const BANKS = ["BCA", "Mandiri", "BRI", "BNI", "BSI", "CIMB Niaga", "Permata", "Jago", "SeaBank", "blu", "GoPay", "OVO", "DANA", "ShopeePay"];

/** Bank name, rek no and QRIS. All optional. */
export function PaymentFields({ value, onChange }: { value: PaymentValues; onChange: (v: PaymentValues) => void }) {
  const uid = useId();
  const [qrError, setQrError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const set = (patch: Partial<PaymentValues>) => onChange({ ...value, ...patch });

  async function onQrFile(file: File | undefined) {
    if (!file) return;
    setQrError(null);
    setReading(true);
    try {
      const text = await decodeQrFromFile(file);
      if (!text) setQrError("No QR code found. Try a clearer screenshot of your QRIS.");
      else if (!isValidQris(text)) setQrError("That QR isn't a QRIS payment code.");
      else set({ qrisPayload: text });
    } catch {
      setQrError("Couldn't read that image.");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={uid + "bankName"}>
            Bank or e-wallet (optional)
          </label>
          <input
            id={uid + "bankName"}
            className="input"
            list={uid + "banks"}
            placeholder="BCA"
            value={value.bankName}
            onChange={(e) => set({ bankName: e.target.value })}
          />
          <datalist id={uid + "banks"}>
            {BANKS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor={uid + "accountNumber"}>
            Rek no (optional)
          </label>
          <input
            id={uid + "accountNumber"}
            className="input"
            inputMode="numeric"
            placeholder="1234567890"
            value={value.accountNumber}
            onChange={(e) => set({ accountNumber: e.target.value.replace(/[^\d\s-]/g, "") })}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={uid + "accountHolder"}>
          Account holder name (optional)
        </label>
        <input
          id={uid + "accountHolder"}
          className="input"
          placeholder="a.n. Felicia"
          value={value.accountHolder}
          onChange={(e) => set({ accountHolder: e.target.value })}
        />
      </div>

      <div>
        <span className="label">QRIS (optional)</span>
        {value.qrisPayload ? (
          <div className="flex flex-wrap items-center gap-4">
            <QrisCode payload={value.qrisPayload} size={120} />
            <div className="space-y-2">
              <p className="text-sm">
                QRIS saved{qrisName(value.qrisPayload) ? ` for ${qrisName(value.qrisPayload)}` : ""}.
              </p>
              <p className="text-xs text-muted">Check this is your account before saving.</p>
              <button type="button" className="btn btn-sm" onClick={() => set({ qrisPayload: "" })}>
                Remove QRIS
              </button>
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line p-4 text-sm text-muted transition-colors hover:border-ink hover:text-ink">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                onQrFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <QrCode size={20} aria-hidden />
            {reading ? "Reading the QR code..." : "Upload a screenshot of your QRIS from GoPay, DANA, OVO or your bank app"}
          </label>
        )}
        {qrError && <p className="error-box mt-2">{qrError}</p>}
        <p className="mt-2 text-xs text-muted">Only the text inside the QR code is saved, not the image.</p>
      </div>
    </div>
  );
}
