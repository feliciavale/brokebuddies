"use client";

import { useActionState } from "react";
import { createGroup, type FormState } from "@/app/actions";
import { SubmitButton } from "./submit-button";

export function CreateGroupForm() {
  const [state, action] = useActionState<FormState, FormData>(createGroup, null);
  return (
    <form action={action} className="card space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="name">
            New group name
          </label>
          <input id="name" name="name" className="input" placeholder="Friday dinner" required maxLength={60} />
        </div>
        <SubmitButton pendingText="Creating...">Create group</SubmitButton>
      </div>
      {state?.error && (
        <p className="error-box" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}