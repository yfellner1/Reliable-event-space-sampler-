"use client";

import { useEffect, useRef } from "react";
import { useFormAction } from "@/components/use-form-action";
import type { FormState } from "@/lib/form-state";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/roles";
import { USERNAME_RULES } from "@/lib/usernames";
import { addUser, resetPassword, updateUser } from "./actions";

function Message({ state }: { state: FormState }) {
  if (state.error)
    return (
      <div className="box box-err" role="alert">
        {state.error}
      </div>
    );
  if (state.ok)
    return (
      <div className="box box-ok" role="status">
        {state.ok}
      </div>
    );
  return null;
}

function RoleSelect({ defaultValue }: { defaultValue?: Role }) {
  return (
    <div className="grid gap-2">
      <label className="field">
        Role
        <select className="input" name="role" defaultValue={defaultValue ?? "kitchen"} required>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <ul className="m-0 grid gap-0.5 pl-5 text-sm text-muted">
        {ROLES.map((r) => (
          <li key={r}>
            <strong className="font-semibold">{ROLE_LABELS[r]}:</strong> {ROLE_DESCRIPTIONS[r]}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Clears the form after a successful save. */
function useResetOnSuccess(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok, state.stamp]);
  return ref;
}

export function AddUserForm() {
  const [state, onSubmit, pending] = useFormAction<FormState>(addUser, {});
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3" noValidate>
      <Message state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Name
          <input className="input" name="displayName" autoComplete="off" required />
        </label>
        <label className="field">
          Username
          <input
            className="input"
            name="username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="username-rules"
            required
          />
        </label>
      </div>
      <p id="username-rules" className="m-0 text-sm text-muted">
        {USERNAME_RULES}
      </p>
      <RoleSelect />
      <label className="field">
        Password
        <input className="input" name="password" type="text" autoComplete="new-password" required />
      </label>
      <p className="m-0 text-sm text-muted">
        At least 8 characters. Give it to the person directly; they can change it under My account.
      </p>
      <div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add user"}
        </button>
      </div>
    </form>
  );
}

export function EditUserForm({
  user,
  isSelf,
}: {
  user: { id: string; display_name: string; role: Role; active: boolean };
  isSelf: boolean;
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(updateUser, {});
  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <Message state={state} />
      <input type="hidden" name="id" value={user.id} />
      <label className="field">
        Name
        <input className="input" name="displayName" defaultValue={user.display_name} required />
      </label>
      <RoleSelect defaultValue={user.role} />
      <label className="flex min-h-11 items-center gap-2.5">
        <input
          type="checkbox"
          name="active"
          defaultChecked={user.active}
          disabled={isSelf}
          className="h-5 w-5 accent-[var(--brand)]"
        />
        Can sign in
      </label>
      {isSelf ? (
        <>
          <input type="hidden" name="active" value="on" />
          <p className="m-0 text-sm text-muted">You can&rsquo;t switch off your own account.</p>
        </>
      ) : null}
      <div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [state, onSubmit, pending] = useFormAction<FormState>(resetPassword, {});
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3" noValidate>
      <Message state={state} />
      <input type="hidden" name="id" value={id} />
      <label className="field">
        New password
        <input className="input" name="password" type="text" autoComplete="new-password" required />
      </label>
      <div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Setting…" : "Set new password"}
        </button>
      </div>
    </form>
  );
}
