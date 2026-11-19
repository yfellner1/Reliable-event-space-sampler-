import { longDateYear } from "@/lib/dates";
import { clock } from "@/lib/format";
import type { Estimate, MenuLine } from "@/lib/menu";
import { STYLE_LABELS, occasionLabel, setupLabel } from "@/lib/schedule";
import type { Database } from "@/lib/supabase/database.types";
import { FinalizedSwitch, PrintButton } from "./finalized";
import { EstimateBox } from "../menu-picker";

type Row = Database["public"]["Tables"]["bookings"]["Row"];

/** A finalized party: the details, guest list, and menu, laid out to read. */
export function FinalizedSummary({
  b,
  venueName,
  slotLabel,
  menuName,
  menu,
  estimate,
}: {
  b: Row;
  venueName: string;
  slotLabel: string;
  menuName: string | null;
  menu: MenuLine[];
  estimate: Estimate | null;
}) {
  const total = b.guests_men + b.guests_women + b.guests_children;
  return (
    <section className="panel grid gap-5" aria-labelledby="final-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="final-title" className="flex items-center gap-2 text-xl font-bold">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-brand-ink"
          >
            ✓
          </span>
          Party finalized
        </h2>
        <PrintButton />
      </div>

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5">
        <dt className="text-muted">Date</dt>
        <dd className="m-0 font-semibold">{longDateYear(b.event_date)}</dd>
        <dt className="text-muted">Time</dt>
        <dd className="m-0 font-semibold">
          {clock(b.start_minute)} to {clock(b.start_minute + b.duration_minutes)} ({slotLabel})
        </dd>
        <dt className="text-muted">Venue</dt>
        <dd className="m-0 font-semibold">
          {venueName}
          {b.venue_address ? <span className="block font-normal">{b.venue_address}</span> : null}
        </dd>
        <dt className="text-muted">Client</dt>
        <dd className="m-0 font-semibold">
          {b.client_first_name} {b.client_last_name},{" "}
          <a href={`tel:${b.client_phone.replace(/[^\d+]/g, "")}`} className="text-brand">
            {b.client_phone}
          </a>
        </dd>
        {b.occasion ? (
          <>
            <dt className="text-muted">Party</dt>
            <dd className="m-0 font-semibold">{occasionLabel(b.occasion, b.occasion_other)}</dd>
          </>
        ) : null}
        <dt className="text-muted">Style</dt>
        <dd className="m-0 font-semibold">{STYLE_LABELS[b.party_style]}</dd>
        <dt className="text-muted">Setup</dt>
        <dd className="m-0 font-semibold">
          {setupLabel(b.head_table, b.mechitza) || "No head table, no mechitza"}
        </dd>
      </dl>

      <div>
        <h3 className="mb-2 text-lg font-bold">Guest list</h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ["Men", b.guests_men],
            ["Women", b.guests_women],
            ["Children", b.guests_children],
            ["Total", total],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl bg-soft p-2.5">
              <div className="text-2xl font-bold tabular-nums">{n}</div>
              <div className="text-sm text-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-lg font-bold">Menu{menuName ? ` · ${menuName}` : ""}</h3>
        {menu.length ? (
          <dl className="m-0 grid gap-2">
            {menu.map((l) => (
              <div key={l.section} className="grid grid-cols-[7.5rem_1fr] gap-3 border-t border-line pt-2 first:border-t-0 first:pt-0">
                <dt className="font-semibold">{l.section}</dt>
                <dd className="m-0">{l.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {b.menu_notes ? (
          <p className={`m-0 whitespace-pre-wrap ${menu.length ? "mt-3 rounded-xl bg-soft p-3" : ""}`}>
            {menu.length ? <strong>Menu notes: </strong> : null}
            {b.menu_notes}
          </p>
        ) : null}
      </div>

      {estimate ? (
        <section aria-labelledby="total-title">
          <h3 id="total-title" className="mb-2 text-lg font-bold">
            Party total
          </h3>
          <EstimateBox e={estimate} final />
        </section>
      ) : null}

      {b.notes ? (
        <div>
          <h3 className="mb-1 text-lg font-bold">Notes and upgrades</h3>
          <p className="m-0 whitespace-pre-wrap">{b.notes}</p>
        </div>
      ) : null}

      <div className="border-t border-line pt-4 print:hidden">
        <FinalizedSwitch bookingId={b.id} />
      </div>
    </section>
  );
}
