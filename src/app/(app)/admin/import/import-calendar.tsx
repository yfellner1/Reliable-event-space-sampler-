"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { icsFromZip, notesWithWarnings, parseIcs, toImportRows, type ImportRow, type Skipped } from "@/lib/calendar-import";
import type { Setup } from "@/lib/booking-data";
import { shortDate, type ISODate } from "@/lib/dates";
import { clock, money } from "@/lib/format";
import { bookingProblems, PAYMENT_LABELS, STYLE_LABELS, type VenueRule } from "@/lib/schedule";
import { importBookings, type ImportPayload, type ImportResult } from "./actions";

type Props = { setup: Setup; defaultFrom: ISODate; today: ISODate };

function venueFor(setup: Setup, key: ImportRow["venueKey"]): VenueRule | undefined {
  if (key === "catering") return setup.venues.find((v) => v.kind === "catering");
  if (key === "novel") return setup.venues.find((v) => /novel/i.test(v.name));
  return setup.venues.find((v) => v.kind === "event_space" && !/novel/i.test(v.name));
}

/** Rule problems worth knowing about; the import lets these through. */
function ruleNotes(setup: Setup, r: ImportRow, today: ISODate): string[] {
  const venue = venueFor(setup, r.venueKey);
  const slot = setup.slots.find((s) => s.key === r.slotKey);
  const problems = bookingProblems(
    {
      venueId: venue?.id ?? "",
      slotId: slot?.id ?? "",
      date: r.date,
      startMinute: r.startMinute,
      durationMinutes: r.durationMinutes,
      style: r.style,
      occasion: "",
      occasionOther: "",
      headTable: false,
      mechitza: false,
      firstName: "x",
      lastName: r.lastName,
      phone: r.phone,
      email: "",
      otherVenueName: "",
      venueAddress: r.venueAddress || "x",
      venueFeeCents: null,
      waiters: 0,
      men: r.men,
      women: r.women,
      children: r.children,
      notes: "",
      depositPaid: false,
      depositMethod: "",
      depositAmountCents: null,
      depositReceivedOn: "",
      contractSentOn: "",
      contractSignedOn: "",
      finalConfirmed: false,
    },
    { slot, venue, today, timeZone: setup.org.timeZone, checkSchedule: true },
  );
  return problems.filter((p) => !/already passed/.test(p)).map((p) => `Outside today’s rules: ${p}`);
}

export function ImportCalendar({ setup, defaultFrom, today }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [events, setEvents] = useState<ReturnType<typeof parseIcs> | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Map<string, ImportResult> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const preview = useMemo(() => {
    if (!events) return null;
    const { rows, skipped } = toImportRows(events, { from, depositCents: setup.org.depositCents });
    for (const r of rows) r.warnings.push(...ruleNotes(setup, r, today));
    return { rows, skipped };
  }, [events, from, setup, today]);

  async function onFile(file: File | undefined) {
    setFileError(null);
    setResults(null);
    setEvents(null);
    setUnchecked(new Set());
    if (!file) return;
    try {
      const texts = /\.zip$/i.test(file.name) ? await icsFromZip(await file.arrayBuffer()) : [await file.text()];
      const parsed = texts.flatMap((t) => parseIcs(t, setup.org.timeZone));
      if (!parsed.length) setFileError("No calendar events were found in that file.");
      setEvents(parsed);
    } catch {
      setFileError("That file couldn’t be read. Choose the .zip or .ics file from Google Calendar.");
    }
  }

  const chosen = preview?.rows.filter((r) => !unchecked.has(r.ref)) ?? [];

  function runImport() {
    setError(null);
    const payload: ImportPayload[] = [];
    for (const r of chosen) {
      const venue = venueFor(setup, r.venueKey);
      const slot = setup.slots.find((s) => s.key === r.slotKey);
      if (!venue || !slot) continue;
      payload.push({
        ref: r.ref,
        venueId: venue.id,
        slotId: slot.id,
        date: r.date,
        startMinute: r.startMinute,
        durationMinutes: r.durationMinutes,
        venueAddress: r.venueAddress,
        otherVenueName: "",
        firstName: r.firstName,
        lastName: r.lastName,
        phone: r.phone,
        email: r.email,
        style: r.style,
        men: r.men,
        women: r.women,
        children: r.children,
        menuNotes: r.menuNotes,
        notes: notesWithWarnings(r),
        deposit: r.deposit,
      });
    }
    start(async () => {
      const res = await importBookings(payload);
      if ("error" in res) setError(res.error);
      else setResults(new Map(res.results.map((x) => [x.ref, x])));
    });
  }

  const counts = results
    ? {
        created: [...results.values()].filter((r) => r.result === "created").length,
        exists: [...results.values()].filter((r) => r.result === "exists").length,
        failed: [...results.values()].filter((r) => r.result === "error").length,
      }
    : null;

  return (
    <div className="grid gap-4">
      <section className="panel grid gap-3" aria-label="Choose the file">
        <label className="field">
          Calendar file (.zip or .ics)
          <input
            className="input"
            type="file"
            accept=".zip,.ics,text/calendar,application/zip"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <label className="field max-w-56">
          Import parties from
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        {fileError ? <p className="box box-warn m-0">{fileError}</p> : null}
      </section>

      {preview ? (
        <>
          <section className="panel grid gap-2" aria-label="Summary">
            <p className="m-0 font-semibold">
              {preview.rows.length} parties found from {shortDate(from)} on. {chosen.length} selected.
            </p>
            {preview.skipped.length ? (
              <details>
                <summary className="cursor-pointer text-sm text-muted">
                  {preview.skipped.length} calendar notes left out (not parties)
                </summary>
                <ul className="mt-2 mb-0 text-sm">
                  {preview.skipped.map((s: Skipped, i) => (
                    <li key={i}>
                      {s.date ? shortDate(s.date) : ""} · {s.title} — {s.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {counts ? (
              <p className="box m-0" role="status">
                Imported {counts.created} {counts.created === 1 ? "party" : "parties"}.
                {counts.exists ? ` ${counts.exists} were already in the app.` : ""}
                {counts.failed ? ` ${counts.failed} couldn’t be imported (see below).` : ""}{" "}
                <Link href="/attention">Open Needs attention</Link>
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-primary justify-self-start"
                disabled={pending || !chosen.length}
                onClick={runImport}
              >
                {pending ? "Importing…" : `Import ${chosen.length} ${chosen.length === 1 ? "party" : "parties"}`}
              </button>
            )}
            {error ? <p className="box box-warn m-0">{error}</p> : null}
          </section>

          <ul className="m-0 grid list-none gap-2 p-0" aria-label="Parties to import">
            {preview.rows.map((r) => {
              const res = results?.get(r.ref);
              const venue = venueFor(setup, r.venueKey);
              const guests = r.men + r.women + r.children;
              return (
                <li key={r.ref} className="panel grid gap-1.5">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]"
                      checked={!unchecked.has(r.ref)}
                      disabled={Boolean(results)}
                      onChange={(e) =>
                        setUnchecked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.delete(r.ref);
                          else next.add(r.ref);
                          return next;
                        })
                      }
                    />
                    <span className="grid gap-0.5">
                      <span className="font-bold">
                        {shortDate(r.date)}, {clock(r.startMinute)} · {r.lastName}
                      </span>
                      <span className="text-sm text-muted">
                        {venue?.name ?? r.venueKey}
                        {r.venueAddress ? ` (${r.venueAddress})` : ""} · {STYLE_LABELS[r.style]} · {r.phone}
                        {r.email ? ` · ${r.email}` : ""}
                      </span>
                      <span className="text-sm">
                        {guests ? `${guests} guests (Men ${r.men}, Women ${r.women}, Children ${r.children})` : "No guest count yet"}
                        {" · "}
                        {r.deposit
                          ? `Deposit ${money(r.deposit.amountCents)} ${PAYMENT_LABELS[r.deposit.method].toLowerCase()}, ${shortDate(r.deposit.receivedOn)}`
                          : "No deposit: comes in as a hold"}
                      </span>
                    </span>
                  </label>
                  {r.menuNotes ? (
                    <p className="m-0 pl-8 text-sm whitespace-pre-line text-muted">{r.menuNotes}</p>
                  ) : null}
                  {r.warnings.length ? (
                    <ul className="m-0 pl-12 text-sm text-warn">
                      {r.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                  {res ? (
                    <p className={`m-0 pl-8 text-sm font-semibold ${res.result === "error" ? "text-warn" : ""}`}>
                      {res.result === "created" ? "Imported." : res.result === "exists" ? "Already in the app." : `Not imported: ${res.message}`}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
