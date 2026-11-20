"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that locks while its form is being sent, so a double or
 * triple tap only submits once.
 */
export function SubmitButton({
  children,
  pendingText = "Saving...",
  className = "btn-primary",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}