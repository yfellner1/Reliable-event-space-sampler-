import Link from "next/link";
import type { CalendarEntry } from "@/lib/booking-data";
import { longDate, type ISODate } from "@/lib/dates";
import { clock, money } from "@/lib/format";
import { STYLE_LABELS, slotClosedReason, venueOffersSlot, type SlotRule, type VenueRule } from "@/lib/schedule";
import { holidaysOn } from "@/lib/holidays";
import { NoteForm } from "./note-form";
import { StatusMarks } from "./status-marks";
import { VenueBadge } from "./venue-badge";

type Props = {
  date: ISODate;
  today: ISODate;
  entries: CalendarEntry[];
  venues: VenueRule[];
  slots: SlotRule[];
  timeZone: string;
  canEdit: boolean;
};

const timeRange = (e: CalendarEntry) => `${clock(e.startMinute)} to ${clock(e.startMinute + e.durationMinutes)}`;

function guestLine(e: CalendarEntry) {
  if (!e.guests.total) return "Guest count not in yet";
  return `${e.guests.total} guests (men ${e.guests.men}, women ${e.guests.women}, children ${e.guests.children})`;
}

export function DayPanel({ date, today, entries, venues, slots, timeZone, canEdit }: Props) {
  const past = date < today;
  const dayEntries = entries.filter((e) => e.date === date);
  const reasons = slots.map((s) => slotClosedReason(s, date, timeZone));
  const allClosed = reasons.every(Boolean);
  const otherVenue = venues.find((v) => !v.exclusive);

  return (
    <section className="panel" aria-labelledby="day-title">
      <h2 id="day-title" className="text-xl font-bold">
        {longDate(date)}
      </h2>
      {holidaysOn(date).length ? (
        <ul className="mt-1 mb-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Holidays">
          {holidaysOn(date).map((h) => (
            <li
              key={h.name}
              className="rounded-full px-2.5 py-0.5 text-sm font-semibold"
              style={
                h.kind === "jewish"
                  ? { background: "color-mix(in srgb, var(--jewish) 14%, transparent)", color: "var(--jewish)" }
                  : { background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }
              }
            >
              {h.name}
            </li>
          ))}
        </ul>
      ) : null}
      {past ? <p className="mt-1 mb-0 text-sm text-muted">This day has passed.</p> : null}
      {allClosed && !dayEntries.length ? (
        <p className="mt-2 mb-0 text-muted">{reasons[0]}</p>
      ) : null}

      {slots.map((slot, i) => {
        const closed = reasons[i];
        const inSlot = dayEntries.filter((e) => e.slotId === slot.id);
        if (closed && !inSlot.length) {
          if (allClosed) return null;
          return (
            <div key={slot.id} className="border-t border-line py-3 text-sm text-muted">
              <strong className="text-ink">{slot.label}:</strong> {closed}
            </div>
          );
        }

        const window =
          slot.startEarliest === slot.startLatest
            ? `Starts ${clock(slot.startEarliest)}`
            : `Starts ${clock(slot.startEarliest)} to ${clock(slot.startLatest)}`;

        return (
          <section
            key={slot.id}
            aria-labelledby={`slot-${slot.id}`}
            className="grid gap-2 border-t border-line py-3 first-of-type:mt-3"
          >
            <div>
              <h3 id={`slot-${slot.id}`} className="text-lg font-bold">
                {slot.label}
              </h3>
              <p className="m-0 text-sm text-muted">
                {window}
                {slot.endLatest ? `, done by ${clock(slot.endLatest)}` : ""}
                {slot.allowedStyles?.length === 1 ? ` · ${STYLE_LABELS[slot.allowedStyles[0]]} only` : ""}
              </p>
            </div>

            {canEdit ? (
              <ul className="m-0 grid list-none gap-2 p-0">
                {venues
                  .filter((v) => v.exclusive && venueOffersSlot(v, slot))
                  .map((v) => {
                    const e = inSlot.find((x) => x.venueId === v.id);
                    return (
                      <li key={v.id} className="rounded-xl border border-line p-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex items-center gap-2 font-semibold">
                            <VenueBadge venue={v} />
                            {v.name}
                            {v.extraFeeCents && !e ? (
                              <span className="text-sm font-normal text-muted">+{money(v.extraFeeCents)}</span>
                            ) : null}
                          </span>
                          {!e ? (
                            past ? (
                              <span className="chip text-muted">Open</span>
                            ) : (
                              <Link
                                className="btn btn-primary"
                                href={`/bookings/new?date=${date}&slot=${slot.id}&venue=${v.id}`}
                              >
                                Book
                              </Link>
                            )
                          ) : null}
                        </div>
                        {e ? <EntryDetails entry={e} /> : null}
                      </li>
                    );
                  })}
                {inSlot
                  .filter((e) => !venues.find((v) => v.id === e.venueId)?.exclusive)
                  .map((e) => {
                    const v = venues.find((x) => x.id === e.venueId);
                    return (
                      <li key={e.id} className="rounded-xl border border-line p-3">
                        <span className="flex items-center gap-2 font-semibold">
                          {v ? <VenueBadge venue={v} /> : null}
                          {e.otherVenueName ?? v?.name}
                        </span>
                        <EntryDetails entry={e} />
                      </li>
                    );
                  })}
                {otherVenue && !past && !closed && venueOffersSlot(otherVenue, slot) ? (
                  <li>
                    {venues.some((v) => v.exclusive && venueOffersSlot(v, slot)) ? (
                      <Link
                        className="text-sm font-semibold text-brand"
                        href={`/bookings/new?date=${date}&slot=${slot.id}&venue=${otherVenue.id}`}
                      >
                        + Book at another location
                      </Link>
                    ) : (
                      // Catering-only businesses: every job goes to the client's address.
                      <Link
                        className="btn btn-primary"
                        href={`/bookings/new?date=${date}&slot=${slot.id}&venue=${otherVenue.id}`}
                      >
                        {inSlot.length ? "+ Book another job" : "Book"}
                      </Link>
                    )}
                  </li>
                ) : null}
                {!past && !closed && inSlot.some((e) => venues.find((v) => v.id === e.venueId)?.exclusive) ? (
                  <li>
                    <Link
                      className="text-sm font-semibold text-brand"
                      href={`/waitlist?date=${date}&slot=${slot.id}#add`}
                    >
                      + Someone else wants this {slot.label.toLowerCase()}? Add to the waitlist
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : inSlot.length ? (
              <ul className="m-0 grid list-none gap-2 p-0">
                {inSlot.map((e) => {
                  const v = venues.find((x) => x.id === e.venueId);
                  return (
                    <li key={e.id} className="grid gap-1.5 rounded-xl border border-line p-3">
                      <span className="flex items-center gap-2 font-semibold">
                        {v ? <VenueBadge venue={v} /> : null}
                        {e.otherVenueName ?? v?.name}
                        {e.finalConfirmed ? <span className="chip">✓ Party finalized</span> : null}
                      </span>
                      <span className="text-sm">
                        {timeRange(e)} · {e.occasion ? `${e.occasion} · ` : ""}
                        {STYLE_LABELS[e.style]}
                      </span>
                      <span className="text-sm">{guestLine(e)}</span>
                      {e.setup ? <span className="text-sm font-semibold">{e.setup}</span> : null}
                      {e.waiters ? (
                        <span className="text-sm font-semibold">
                          {e.waiters} {e.waiters === 1 ? "waiter" : "waiters"}
                        </span>
                      ) : null}
                      {e.venueAddress ? <span className="text-sm text-muted">{e.venueAddress}</span> : null}
                      <MenuList entry={e} />
                      <NoteForm bookingId={e.id} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="m-0 text-sm text-muted">No parties booked.</p>
            )}
          </section>
        );
      })}
    </section>
  );
}

function MenuList({ entry: e }: { entry: CalendarEntry }) {
  if (!e.menu.length && !e.menuNotes) {
    return <span className="text-sm text-muted">Menu not chosen yet</span>;
  }
  return (
    <div className="rounded-lg bg-soft p-2.5 text-sm">
      {e.menu.length ? (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {e.menu.map((l) => (
            <div key={l.section} className="contents">
              <dt className="font-semibold">{l.section}</dt>
              <dd className="m-0">{l.items.join(", ")}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {e.menuNotes ? <p className={`m-0 whitespace-pre-wrap ${e.menu.length ? "mt-2" : ""}`}>{e.menuNotes}</p> : null}
    </div>
  );
}

function EntryDetails({ entry: e }: { entry: CalendarEntry }) {
  return (
    <div className="mt-2 grid gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span>
          <strong>{e.client?.name}</strong>
          {e.client?.phone ? (
            <>
              {", "}
              <a href={`tel:${e.client.phone.replace(/[^\d+]/g, "")}`} className="text-brand">
                {e.client.phone}
              </a>
            </>
          ) : null}
        </span>
        <Link href={`/bookings/${e.id}`} className="text-sm font-semibold text-brand">
          Open booking
        </Link>
      </div>
      <span className="text-sm text-muted">
        {timeRange(e)} · {e.occasion ? `${e.occasion} · ` : ""}
        {STYLE_LABELS[e.style]} · {guestLine(e)}
        {e.setup ? ` · ${e.setup}` : ""}
        {e.waiters ? ` · ${e.waiters} ${e.waiters === 1 ? "waiter" : "waiters"}` : ""}
      </span>
      {e.venueAddress ? <span className="text-sm text-muted">{e.venueAddress}</span> : null}
      <StatusMarks entry={e} />
    </div>
  );
}
