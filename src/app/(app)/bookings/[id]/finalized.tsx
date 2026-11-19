"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { unfinalizeBooking } from "../actions";

/** The "Party finalized" switch on a finalized booking; unticking unlocks editing. */
export function FinalizedSwitch({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--brand)]"
          checked={!pending}
          disabled={pending}
          onChange={() =>
            start(async () => {
              const r = await unfinalizeBooking(bookingId);
              if (!r.ok) setError("Couldn't unlock the booking. Please try again.");
              router.refresh();
            })
          }
        />
        Party finalized
      </label>
      <p className="m-0 text-sm text-muted">Untick to make changes. Tick it again when everything is complete.</p>
      {error ? (
        <div className="box box-err" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn print:hidden" onClick={() => window.print()}>
      Print
    </button>
  );
}
