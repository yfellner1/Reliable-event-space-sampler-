"use client";

import { useEffect, useRef, useState } from "react";
import { useFormAction } from "@/components/use-form-action";
import type { FormState } from "@/lib/form-state";
import { addNote } from "@/app/(app)/bookings/note-actions";

/** Kitchen staff leave a note on a party for the secretary. */
export function NoteForm({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [state, onSubmit, pending] = useFormAction<FormState>(addNote, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok, state.stamp]);

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button type="button" className="btn self-start" onClick={() => setOpen(true)}>
          Leave a note
        </button>
        {state.ok ? <span className="text-sm text-muted">{state.ok}</span> : null}
      </div>
    );
  }
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state.error ? <div className="box box-err">{state.error}</div> : null}
      {state.ok ? <div className="box box-ok">{state.ok}</div> : null}
      <label className="field">
        Note for the secretary
        <textarea className="input min-h-20" name="body" maxLength={2000} required />
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send note"}
        </button>
        <button className="btn" type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </form>
  );
}
