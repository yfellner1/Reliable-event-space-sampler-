import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { requireRole } from "@/lib/auth";
import { loadSetup } from "@/lib/booking-data";
import { isISODate, shortDate, todayIn } from "@/lib/dates";
import { STYLE_LABELS } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { loadWaitlist } from "@/lib/waitlist-data";
import { addRequest } from "./actions";
import { RequestControls } from "./request-controls";

export const metadata: Metadata = { title: "Waitlist" };

export default async function WaitlistPage({ searchParams }: PageProps<"/waitlist">) {
  const me = await requireRole("admin", "editor");
  const setup = await loadSetup(me);
  const { org, venues, slots } = setup;
  const params = await searchParams;
  const today = todayIn(org.timeZone);
  const date = isISODate(params.date) ? params.date : "";
  const slotParam = typeof params.slot === "string" && slots.some((s) => s.id === params.slot) ? params.slot : "";
  const supabase = await createClient();
  const list = await loadWaitlist(supabase, setup, today);
  const active = list.filter((r) => r.status === "waiting" || r.status === "contacted");
  const done = list.filter((r) => r.status === "booked" || r.status === "not_interested");
  const opened = active.filter((r) => r.openNow);
  const eventSpaces = venues.filter((v) => v.exclusive && v.kind === "event_space");

  const card = (r: (typeof list)[number]) => {
    const slot = slots.find((s) => s.id === r.slot_id);
    const venue = venues.find((v) => v.id === r.venue_id);
    return (
      <li key={r.id} className="panel grid gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-lg font-bold">{r.client_name}</span>
          <span className="text-sm text-muted">
            {shortDate(r.event_date)} · {slot?.label}
            {venue ? ` · ${venue.name}` : " · any venue"}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {r.client_phone ? <a href={`tel:${r.client_phone.replace(/[^\d+]/g, "")}`}>{r.client_phone}</a> : null}
          {r.client_email ? <a href={`mailto:${r.client_email}`}>{r.client_email}</a> : null}
          {r.guests ? <span>{r.guests} guests</span> : null}
          {r.party_style ? <span>{STYLE_LABELS[r.party_style]}</span> : null}
          <span className="text-muted">Asked {shortDate(r.created_at.slice(0, 10))}</span>
          {r.was_full ? <span className="chip">Date was taken</span> : null}
        </div>
        {r.notes ? <p className="m-0 text-sm whitespace-pre-wrap">{r.notes}</p> : null}
        {r.openNow ? (
          <div className="box box-ok flex flex-wrap items-center justify-between gap-2">
            <strong>This date opened up. Call them!</strong>
            <Link
              className="btn btn-primary"
              href={`/bookings/new?date=${r.event_date}&slot=${r.slot_id}${r.venue_id ? `&venue=${r.venue_id}` : ""}&request=${r.id}`}
            >
              Book them
            </Link>
          </div>
        ) : null}
        <RequestControls id={r.id} status={r.status} />
      </li>
    );
  };

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Waitlist</h1>
      <p className="m-0 text-muted">
        People who wanted a date that was already booked. If a date opens up, it shows here and in Needs attention.
        The reports count everyone who asked for a taken date.
      </p>

      {opened.length ? (
        <div className="box box-ok" role="status">
          <strong>
            {opened.length} {opened.length === 1 ? "person is" : "people are"} waiting for a date that opened up.
          </strong>
        </div>
      ) : null}

      <section id="add" className="panel grid gap-3" aria-labelledby="add-title">
        <h2 id="add-title" className="text-lg font-bold">
          Add someone
        </h2>
        <ActionForm action={addRequest} submitLabel="Add to the waitlist" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="field">
              Date they wanted
              <input className="input" type="date" name="date" min={today} defaultValue={date} required />
            </label>
            <label className="field">
              Time of day
              <select className="input" name="slot" defaultValue={slotParam}>
                <option value="">Choose…</option>
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Venue
              <select className="input" name="venue" defaultValue="">
                <option value="">Any</option>
                {eventSpaces.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Name
              <input className="input" name="name" autoComplete="off" />
            </label>
            <label className="field">
              Phone
              <input className="input" name="phone" type="tel" autoComplete="off" />
            </label>
            <label className="field">
              Email (optional)
              <input className="input" name="email" type="email" autoComplete="off" autoCapitalize="none" />
            </label>
            <label className="field">
              Guests (about)
              <input className="input" name="guests" inputMode="numeric" />
            </label>
            <label className="field">
              Style
              <select className="input" name="style" defaultValue="">
                <option value="">Not sure</option>
                {(["plated", "family", "buffet", "bris"] as const).map((s) => (
                  <option key={s} value={s}>
                    {STYLE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Notes (optional)
            <input className="input" name="notes" autoComplete="off" />
          </label>
        </ActionForm>
      </section>

      <section className="grid gap-2" aria-labelledby="waiting-title">
        <h2 id="waiting-title" className="text-lg font-bold">
          Waiting ({active.length})
        </h2>
        {active.length ? (
          <ul className="m-0 grid list-none gap-2 p-0" aria-label="Waiting">
            {active.map(card)}
          </ul>
        ) : (
          <p className="m-0 text-muted">Nobody is waiting for an upcoming date.</p>
        )}
      </section>

      {done.length ? (
        <details className="grid gap-2">
          <summary className="cursor-pointer font-semibold">Booked or no longer interested ({done.length})</summary>
          <ul className="m-0 mt-2 grid list-none gap-2 p-0">{done.map(card)}</ul>
        </details>
      ) : null}

    </div>
  );
}
