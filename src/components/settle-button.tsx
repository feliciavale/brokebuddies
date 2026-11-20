"use client";

import { useState, useTransition } from "react";
import { recordSettlement } from "@/app/actions";

export function SettleButton(props: {
  groupId: string;
  fromId: string;
  toId: string;
  amount: number;
  expenseId?: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        className="btn-primary btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const { groupId, fromId, toId, amount, expenseId } = props;
            const res = await recordSettlement({ groupId, fromId, toId, amount, expenseId });
            if (!res.ok) setError(res.error);
          })
        }
      >
        {pending ? "Saving..." : (props.label ?? "Mark as paid")}
      </button>
      {error && <span className="error-box text-xs">{error}</span>}
    </span>
  );
}
