"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Like useActionState, but submits through onSubmit instead of the form's
 * action prop. React clears every field of a <form action={fn}> after each
 * submit, even when the server sends back an error, so someone fixing a typo
 * would lose what they had entered. Submitting this way keeps the fields.
 */
export function useFormAction<S>(action: (prev: Awaited<S>, fd: FormData) => Promise<S>, initial: Awaited<S>) {
  const [state, run, pending] = useActionState<S, FormData>(action, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => run(fd));
  };
  return [state, onSubmit, pending] as const;
}
