"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addGuest, claimGuest, updateGuest } from "@/app/actions";
import { emptyPayment, PaymentFields, type PaymentValues } from "@/components/payment-fields";
import { Monogram } from "@/components/monogram";

export interface MemberRow {
  id: string;
  name: string;
  isGuest: boolean;
  isMe: boolean;
  hasPayment: boolean;
  payment: PaymentValues;
}

export function Members({ groupId, members, canClaim }: { groupId: string; members: MemberRow[]; canClaim: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line">
        {members.map((m) => (
          <li key={m.id} className="py-3 first:pt-0">
            {editing === m.id ? (
              <GuestForm
                groupId={groupId}
                memberId={m.id}
                initial={{ name: m.name, ...m.payment }}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-center gap-3">
                <Monogram name={m.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {m.name} {m.isMe && <span className="font-normal text-muted">(you)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {m.isGuest ? "Guest" : "Member"} · {m.hasPayment ? "Payment details added" : "No payment details"}
                  </p>
                </div>
                {m.isGuest && (
                  <div className="flex gap-2">
                    {canClaim && <ClaimButton groupId={groupId} guestId={m.id} name={m.name} />}
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(m.id)}>
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? (
        <GuestForm groupId={groupId} initial={{ name: "", ...emptyPayment }} onDone={() => setEditing(null)} />
      ) : (
        <button type="button" className="btn w-full" onClick={() => setEditing("new")}>
          <Plus size={14} aria-hidden />
          Add someone without an account
        </button>
      )}
    </div>
  );
}

function ClaimButton({ groupId, guestId, name }: { groupId: string; guestId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={pending}
      title={`Link ${name}'s bills to your account`}
      onClick={() => {
        if (window.confirm(`Are you ${name}? Their bills will be linked to your account.`)) {
          start(() => claimGuest(groupId, guestId));
        }
      }}
    >
      This is me
    </button>
  );
}

function GuestForm({
  groupId,
  memberId,
  initial,
  onDone,
}: {
  groupId: string;
  memberId?: string;
  initial: PaymentValues & { name: string };
  onDone: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [payment, setPayment] = useState<PaymentValues>({
    bankName: initial.bankName,
    accountNumber: initial.accountNumber,
    accountHolder: initial.accountHolder,
    qrisPayload: initial.qrisPayload,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4 rounded-md border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const input = { ...payment, name };
          const res = memberId ? await updateGuest(groupId, memberId, input) : await addGuest(groupId, input);
          if (res.ok) onDone();
          else setError(res.error);
        });
      }}
    >
      <div>
        <label className="label" htmlFor={`guest-name-${memberId ?? "new"}`}>
          Name
        </label>
        <input
          id={`guest-name-${memberId ?? "new"}`}
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
          autoFocus
        />
      </div>
      <PaymentFields value={payment} onChange={setPayment} />
      {error && <p className="error-box">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary btn-sm" disabled={pending} type="submit">
          {pending ? "Saving..." : memberId ? "Save" : "Add person"}
        </button>
        <button className="btn btn-sm" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
