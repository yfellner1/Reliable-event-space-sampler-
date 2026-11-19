"use client";

import { useEffect, useRef } from "react";
import { useFormAction } from "@/components/use-form-action";
import type { FormState } from "@/lib/form-state";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, onSubmit, pending] = useFormAction<FormState>(changePassword, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok, state.stamp]);

  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3" noValidate>
      {state.error ? (
        <div className="box box-err" role="alert">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div className="box box-ok" role="status">
          {state.ok}
        </div>
      ) : null}
      <label className="field">
        Current password
        <input className="input" name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="field">
        New password
        <input className="input" name="password" type="password" autoComplete="new-password" required />
      </label>
      <label className="field">
        New password again
        <input className="input" name="confirm" type="password" autoComplete="new-password" required />
      </label>
      <div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
