"use client";

import { useEffect, useState, useTransition } from "react";
import { shortDate } from "@/lib/dates";
import { fullName } from "@/lib/format";
import type { Customer } from "@/lib/customers";
import { findCustomers } from "./customer-actions";

/** Search past customers and fill the client fields from one. */
export function CustomerLookup({ onPick }: { onPick: (c: Customer) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Customer[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setResults(await findCustomers(q))), 250);
    return () => clearTimeout(t);
  }, [q]);

  const shown = q.trim().length < 2 ? null : results;

  return (
    <div className="grid gap-2 rounded-xl bg-soft p-3">
      <label className="field">
        Returning customer? Search by name, phone, or email
        <input
          className="input"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPicked(null);
          }}
          autoComplete="off"
        />
      </label>
      {picked ? (
        <p className="m-0 text-sm font-semibold" role="status">
          Filled in {picked}&rsquo;s details.
        </p>
      ) : shown ? (
        shown.length ? (
          <ul className="m-0 grid list-none gap-1.5 p-0" aria-label="Matching customers">
            {shown.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  className="btn w-full justify-between text-left"
                  onClick={() => {
                    onPick(c);
                    setPicked(fullName(c.firstName, c.lastName));
                  }}
                >
                  <span>
                    {fullName(c.firstName, c.lastName)} · {c.phone}
                  </span>
                  <span className="text-sm font-normal text-muted">
                    {c.parties} {c.parties === 1 ? "party" : "parties"}, last {shortDate(c.lastDate)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-muted">No past customers match. Enter the details below.</p>
        )
      ) : null}
    </div>
  );
}
