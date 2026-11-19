"use client";

import { useEffect, useRef } from "react";
import { useFormAction } from "@/components/use-form-action";
import type { FormState } from "@/lib/form-state";

/** A form that runs a server action and shows its result next to the button. */
export function ActionForm({
  action,
  children,
  submitLabel,
  className = "grid gap-3",
  resetOnSuccess = false,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state.ok, state.stamp, resetOnSuccess]);
  return (
    <form ref={ref} onSubmit={onSubmit} className={className} noValidate>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state.error ? (
          <span className="text-sm font-semibold" style={{ color: "var(--err-ink)" }} role="alert">
            {state.error}
          </span>
        ) : state.ok ? (
          <span className="text-sm text-muted" role="status">
            {state.ok}
          </span>
        ) : null}
      </div>
    </form>
  );
}
