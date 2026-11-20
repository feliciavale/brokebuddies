"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

/** Destructive submit button that asks before submitting its form. */
export function ConfirmButton({ message, children }: { message: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn-danger"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      <Trash2 size={14} aria-hidden />
      {pending ? "Deleting..." : children}
    </button>
  );
}
