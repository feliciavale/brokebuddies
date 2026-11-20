"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/actions";
import { PaymentFields, type PaymentValues } from "@/components/payment-fields";

export function ProfileForm({ initial, email }: { initial: PaymentValues & { name: string }; email: string | null }) {
  const [name, setName] = useState(initial.name);
  const [payment, setPayment] = useState<PaymentValues>({
    bankName: initial.bankName,
    accountNumber: initial.accountNumber,
    accountHolder: initial.accountHolder,
    qrisPayload: initial.qrisPayload,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="card space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const res = await updateProfile({ ...payment, name });
          setMsg(res.ok ? { ok: true, text: "Your profile has been saved." } : { ok: false, text: res.error });
        });
      }}
    >
      <div>
        <label className="label" htmlFor="name">
          Display name
        </label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        {email && <p className="mt-1 text-xs text-muted">Signed in as {email}</p>}
      </div>
      <PaymentFields value={payment} onChange={setPayment} />
      {msg && (
        <p className={msg.ok ? "note-box" : "error-box"} role="status">
          {msg.text}
        </p>
      )}
      <button className="btn-primary" disabled={pending} type="submit">
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
