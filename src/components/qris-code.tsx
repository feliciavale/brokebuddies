"use client";

import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { qrisWithAmount } from "@/lib/qris";

/**
 * The payer's QRIS. With an amount, it is pre-filled so the person paying
 * only has to confirm. Some apps reject an amount on a personal QRIS, so
 * there is a checkbox to show the plain code instead.
 */
export function QrisCode({ payload, amount, size = 200 }: { payload: string; amount?: number; size?: number }) {
  const [includeAmount, setIncludeAmount] = useState(true);
  const value = useMemo(() => {
    if (!amount || amount <= 0 || !includeAmount) return payload;
    try {
      return qrisWithAmount(payload, amount);
    } catch {
      return payload;
    }
  }, [payload, amount, includeAmount]);

  return (
    <div className="flex flex-col items-start gap-2">
      {/* QR codes need a light background and dark modules to scan reliably */}
      <div className="rounded-md bg-white p-3">
        <QRCodeSVG value={value} size={size} level="M" marginSize={0} bgColor="#ffffff" fgColor="#000000" />
      </div>
      {amount ? (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={includeAmount} onChange={(e) => setIncludeAmount(e.target.checked)} />
          Amount filled in. Untick if your payment app rejects the code.
        </label>
      ) : null}
    </div>
  );
}
