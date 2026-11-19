"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MenuLine } from "@/lib/menu";
import { applySubmission, createClientLink, dismissSubmission, revokeClientLink } from "../client-link-actions";

type Props = {
  bookingId: string;
  url: string | null;
  clientFirstName: string;
  clientPhoneDigits: string;
  dateLabel: string;
  finalized: boolean;
  pending: {
    id: string;
    sentLabel: string;
    guests: { men: number; women: number; children: number };
    before: { men: number; women: number; children: number };
    menu: MenuLine[];
    message: string | null;
  } | null;
};

export function ClientLinkPanel(p: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      setStatus(r.ok ? { ok } : { error: r.error ?? "Couldn’t save. Please try again." });
      router.refresh();
    });

  const text = p.url
    ? `Hi${p.clientFirstName ? ` ${p.clientFirstName}` : ""}! Please use this private link to send your guest count and menu for your party on ${p.dateLabel}: ${p.url}`
    : "";
  const whatsapp = p.url
    ? `https://wa.me/${p.clientPhoneDigits.length === 10 ? `1${p.clientPhoneDigits}` : p.clientPhoneDigits}?text=${encodeURIComponent(text)}`
    : "";
  const total = (g: { men: number; women: number; children: number }) => g.men + g.women + g.children;

  return (
    <div className="grid gap-3">
      {p.pending ? (
        <div className="box box-warn grid gap-2" role="status">
          <p className="m-0 font-semibold">The client sent their details {p.pending.sentLabel}.</p>
          <p className="m-0">
            Guests: <strong>{total(p.pending.guests)}</strong> (men {p.pending.guests.men}, women {p.pending.guests.women},
            children {p.pending.guests.children}) · now {total(p.pending.before)}
          </p>
          {p.pending.menu.length ? (
            <dl className="m-0 grid gap-1 text-sm">
              {p.pending.menu.map((l) => (
                <div key={l.section} className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="font-semibold">{l.section}</dt>
                  <dd className="m-0">{l.items.join(", ")}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="m-0 text-sm">No dishes chosen.</p>
          )}
          {p.pending.message ? (
            <p className="m-0 text-sm whitespace-pre-wrap">
              <strong>Message: </strong>
              {p.pending.message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => run(() => applySubmission(p.pending!.id), "Applied to the booking.")}
            >
              Apply to the booking
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => run(() => dismissSubmission(p.pending!.id), "Dismissed.")}
            >
              Dismiss
            </button>
          </div>
          {p.finalized ? <p className="m-0 text-sm">Untick “Party finalized” to apply changes.</p> : null}
        </div>
      ) : null}

      {p.url ? (
        <>
          <p className="m-0 text-sm text-muted">
            The client opens this link (no login) to send their guest count and menu. What they send waits here for
            you to apply.
          </p>
          <input className="input font-mono text-sm" readOnly value={p.url} aria-label="Client link" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  setStatus({ ok: "Copied the message with the link." });
                } catch {
                  setStatus({ error: "Select the link above and copy it." });
                }
              }}
            >
              Copy message with link
            </button>
            {p.clientPhoneDigits.length >= 10 ? (
              <a className="btn" href={whatsapp} target="_blank" rel="noopener noreferrer">
                Send on WhatsApp
              </a>
            ) : null}
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                if (confirm("Turn off this link? The client won’t be able to use it anymore.")) {
                  run(() => revokeClientLink(p.bookingId), "Link turned off.");
                }
              }}
            >
              Turn off link
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => run(() => createClientLink(p.bookingId), "Link created.")}
          >
            Create client link
          </button>
          <span className="text-sm text-muted">A private link for the client to send their guest count and menu.</span>
        </div>
      )}
      {status.ok ? (
        <p className="m-0 text-sm font-semibold" role="status">
          {status.ok}
        </p>
      ) : status.error ? (
        <p className="m-0 text-sm font-semibold" role="alert">
          {status.error}
        </p>
      ) : null}
    </div>
  );
}
