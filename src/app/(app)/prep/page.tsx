import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { loadCalendarWithMenus, loadSetup } from "@/lib/booking-data";
import { addDays, isISODate, longDate, shortDate, todayIn } from "@/lib/dates";
import { clock } from "@/lib/format";
import { prepTotals } from "@/lib/prep";
import { STYLE_LABELS } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { VenueBadge } from "@/components/calendar/venue-badge";

export const metadata: Metadata = { title: "Prep sheet" };

const RANGES = [
  { days: 1, label: "One day" },
  { days: 3, label: "Three days" },
  { days: 7, label: "One week" },
];

export default async function PrepPage({ searchParams }: PageProps<"/prep">) {
  const member = await requireMember();
  const { org, venues, slots } = await loadSetup(member);
  const params = await searchParams;
  const today = todayIn(org.timeZone);
  const from = isISODate(params.from) ? params.from : today;
  const days = RANGES.some((r) => String(r.days) === params.days) ? Number(params.days) : 1;
  const to = addDays(from, days - 1);

  const parties = (await loadCalendarWithMenus(member, from, to))
    .filter((e) => e.status === "booked")
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute);

  // Booking notes (allergies, seating) for editors and admins only.
  const notes = new Map<string, string>();
  if (member.role !== "kitchen" && parties.length) {
    const supabase = await createClient();
    const { data } = await supabase.from("bookings").select("id, notes").in("id", parties.map((p) => p.id));
    for (const r of data ?? []) if (r.notes?.trim()) notes.set(r.id, r.notes.trim());
  }

  const dishes = prepTotals(parties);
  const guests = parties.reduce(
    (t, p) => ({
      men: t.men + p.guests.men,
      women: t.women + p.guests.women,
      children: t.children + p.guests.children,
      total: t.total + p.guests.total,
    }),
    { men: 0, women: 0, children: 0, total: 0 },
  );
  const dates = [...new Set(parties.map((p) => p.date))];
  const rangeLabel = days === 1 ? longDate(from) : `${shortDate(from)} to ${shortDate(to)}`;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Prep sheet</h1>
        <PrintButton />
      </div>

      <form className="panel flex flex-wrap items-end gap-3 print:hidden">
        <label className="field">
          From
          <input className="input" type="date" name="from" defaultValue={from} />
        </label>
        <label className="field">
          Show
          <select className="input" name="days" defaultValue={String(days)}>
            {RANGES.map((r) => (
              <option key={r.days} value={r.days}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" type="submit">
          Show
        </button>
      </form>

      <section className="panel grid gap-2" aria-labelledby="prep-summary">
        <h2 id="prep-summary" className="text-xl font-bold">
          {rangeLabel}
        </h2>
        {parties.length ? (
          <p className="m-0 text-lg">
            <strong>{parties.length}</strong> {parties.length === 1 ? "party" : "parties"} ·{" "}
            <strong>{guests.total}</strong> guests (men {guests.men}, women {guests.women}, children {guests.children})
          </p>
        ) : (
          <p className="m-0 text-muted">No booked parties.</p>
        )}
      </section>

      {dishes.length ? (
        <section className="panel grid gap-2" aria-labelledby="prep-dishes">
          <h2 id="prep-dishes" className="text-lg font-bold">
            Dishes
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 pr-3 font-semibold">Section</th>
                <th className="py-1 pr-3 font-semibold">Dish</th>
                <th className="py-1 pr-3 text-right font-semibold">Parties</th>
                <th className="py-1 text-right font-semibold">Guests</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((d, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1.5 pr-3 align-top text-muted">
                    {i === 0 || dishes[i - 1].section !== d.section ? d.section : ""}
                  </td>
                  <td className="py-1.5 pr-3 align-top font-semibold">{d.dish}</td>
                  <td className="py-1.5 pr-3 text-right align-top tabular-nums">{d.parties}</td>
                  <td className="py-1.5 text-right align-top tabular-nums">{d.guests}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {parties.some((p) => !p.menu.length) ? (
            <p className="m-0 text-xs text-muted">
              Parties whose menu is only in the notes aren’t counted here; see each party below.
            </p>
          ) : null}
        </section>
      ) : null}

      {dates.map((date) => (
        <section key={date} className="grid gap-2 break-inside-avoid" aria-label={longDate(date)}>
          {days > 1 ? <h2 className="mt-2 text-lg font-bold">{longDate(date)}</h2> : null}
          {parties
            .filter((p) => p.date === date)
            .map((p) => {
              const venue = venues.find((v) => v.id === p.venueId);
              const slot = slots.find((s) => s.id === p.slotId);
              const note = notes.get(p.id);
              return (
                <article key={p.id} className="panel grid gap-2 break-inside-avoid">
                  <div className="flex flex-wrap items-center gap-2">
                    {venue ? <VenueBadge venue={venue} /> : null}
                    <strong>
                      {clock(p.startMinute)}–{clock(p.startMinute + p.durationMinutes)}
                    </strong>
                    <span className="text-muted">
                      {slot?.label} · {p.otherVenueName ?? venue?.name} · {p.occasion ? `${p.occasion} · ` : ""}
                      {STYLE_LABELS[p.style]}
                      {p.client ? ` · ${p.client.name}` : ""}
                    </span>
                  </div>
                  <p className="m-0 font-semibold">
                    {p.guests.total
                      ? `${p.guests.total} guests: men ${p.guests.men}, women ${p.guests.women}, children ${p.guests.children}`
                      : "Guest count not in yet"}
                    {p.setup ? ` · ${p.setup}` : ""}
                    {p.waiters ? ` · ${p.waiters} ${p.waiters === 1 ? "waiter" : "waiters"}` : ""}
                  </p>
                  {p.venueAddress ? <p className="m-0 text-sm">{p.venueAddress}</p> : null}
                  {p.menu.length ? (
                    <dl className="m-0 grid gap-1 text-sm">
                      {p.menu.map((l) => (
                        <div key={l.section} className="grid grid-cols-[6.5rem_1fr] gap-2">
                          <dt className="text-muted">{l.section}</dt>
                          <dd className="m-0">{l.items.join(", ")}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {p.menuNotes ? (
                    <p className="m-0 text-sm whitespace-pre-wrap">
                      <strong>Menu notes: </strong>
                      {p.menuNotes}
                    </p>
                  ) : null}
                  {note ? (
                    <p className="m-0 rounded-lg bg-soft p-2 text-sm whitespace-pre-wrap">
                      <strong>Notes: </strong>
                      {note}
                    </p>
                  ) : null}
                </article>
              );
            })}
        </section>
      ))}
    </div>
  );
}
