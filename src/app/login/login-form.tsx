"use client";

import { signIn, type LoginState } from "./actions";
import { useFormAction } from "@/components/use-form-action";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, onSubmit, pending] = useFormAction<LoginState>(signIn, {});

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {notice && !state.error ? <div className="box box-warn">{notice}</div> : null}
      {state.error ? (
        <div className="box box-err" role="alert">
          {state.error}
        </div>
      ) : null}
      <input type="hidden" name="next" value={next ?? "/"} />
      <label className="field">
        Username
        <input
          className="input"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={state.username}
          required
        />
      </label>
      <label className="field">
        Password
        <input
          className="input"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
