"use client";

import { useState } from "react";
import { useFormAction } from "@/components/use-form-action";
import type { FormState } from "@/lib/form-state";
import { cancelBooking, deleteBooking, restoreBooking } from "../actions";

function Msg({ state }: { state: FormState }) {
  if (state.error) return <div className="box box-err">{state.error}</div>;
  if (state.ok) return <div className="box box-ok">{state.ok}</div>;
  return null;
}

export function CancelBooking({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, onSubmit, pending] = useFormAction<FormState>(cancelBooking, {});
  if (!open) {
    return (
      <button className="btn btn-danger self-start" type="button" onClick={() => setOpen(true)}>
        Cancel this booking…
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-2 rounded-xl border border-line p-3">
      <input type="hidden" name="id" value={id} />
      <Msg state={state} />
      <p className="m-0">This frees the slot for someone else. The booking stays on record and can be restored.</p>
      <label className="field">
        Reason (optional)
        <input className="input" name="reason" maxLength={500} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-danger" type="submit" disabled={pending}>
          {pending ? "Cancelling…" : "Yes, cancel the booking"}
        </button>
        <button className="btn" type="button" onClick={() => setOpen(false)}>
          Keep it
        </button>
      </div>
    </form>
  );
}

export function RestoreBooking({ id }: { id: string }) {
  const [state, onSubmit, pending] = useFormAction<FormState>(restoreBooking, {});
  return (
    <form onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <Msg state={state} />
      <button className="btn btn-primary self-start" type="submit" disabled={pending}>
        {pending ? "Restoring…" : "Restore this booking"}
      </button>
    </form>
  );
}

export function DeleteBooking({ id }: { id: string }) {
  const [state, onSubmit, pending] = useFormAction<FormState>(deleteBooking, {});
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        if (!confirm("Delete this booking for good? This can't be undone. Cancelling keeps a record instead.")) {
          e.preventDefault();
          return;
        }
        onSubmit(e);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Msg state={state} />
      <button className="btn btn-danger self-start" type="submit" disabled={pending}>
        {pending ? "Deleting…" : "Delete permanently (admin)"}
      </button>
    </form>
  );
}
