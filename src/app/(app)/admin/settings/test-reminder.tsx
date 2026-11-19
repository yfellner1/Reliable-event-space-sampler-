"use client";

import { useState, useTransition } from "react";
import { sendTestReminder, type TestResult } from "./actions";

const LABEL: Record<string, string> = { sent: "Sent", not_set_up: "Not set up", failed: "Failed" };

export function TestReminderButton() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      <button
        type="button"
        className="btn self-start"
        disabled={pending}
        onClick={() => start(async () => setResult(await sendTestReminder()))}
      >
        {pending ? "Sending…" : "Send a test now"}
      </button>
      {result ? (
        <ul className="m-0 grid list-none gap-1 p-0 text-sm" role="status">
          {result.results.map((r) => (
            <li key={r.channel}>
              <strong>
                {r.channel}: {LABEL[r.status] ?? r.status}.
              </strong>{" "}
              {r.detail}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
