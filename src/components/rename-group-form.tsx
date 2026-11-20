"use client";

import { useActionState } from "react";
import { renameGroup, type FormState } from "@/app/actions";
import { SubmitButton } from "./submit-button";

export function RenameGroupForm({ groupId, name }: { groupId: string; name: string }) {
  const [state, action] = useActionState<FormState, FormData>(renameGroup.bind(null, groupId), null);
  return (
    <form action={action} className="mt-4 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="rename">
            Group name
          </label>
          <input id="rename" name="name" className="input" defaultValue={name} required maxLength={60} />
        </div>
        <SubmitButton className="btn" pendingText="Renaming...">
          Rename
        </SubmitButton>
      </div>
      {state?.error && (
        <p className="error-box" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}