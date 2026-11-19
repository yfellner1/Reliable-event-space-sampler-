"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRequest, setRequestStatus } from "./actions";

const LABELS = {
  waiting: "Waiting",
  contacted: "Called them",
  booked: "Booked",
  not_interested: "No longer interested",
} as const;

export function RequestControls({ id, status }: { id: string; status: keyof typeof LABELS }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`status-${id}`}>
        Status
      </label>
      <select
        id={`status-${id}`}
        className="input max-w-52"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as keyof typeof LABELS;
          setValue(next);
          start(async () => {
            const r = await setRequestStatus(id, next);
            setError(!r.ok);
            router.refresh();
          });
        }}
      >
        {Object.entries(LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() => {
          if (!confirm("Remove this from the waitlist? It won’t count in the reports.")) return;
          start(async () => {
            const r = await deleteRequest(id);
            setError(!r.ok);
            router.refresh();
          });
        }}
      >
        Remove
      </button>
      {error ? (
        <span className="text-sm font-semibold" role="alert">
          Couldn’t save. Please try again.
        </span>
      ) : null}
    </div>
  );
}
