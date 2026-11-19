import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { loadMenus, loadSetup } from "@/lib/booking-data";
import { longDateYear, todayIn } from "@/lib/dates";
import { money } from "@/lib/format";
import { buildReport, type ReportGroup } from "@/lib/report-data";
import { quickRanges, reportRange } from "@/lib/report-range";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports" };

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-soft p-3">
      <div className={`text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"}`}>{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

function GroupTable({ title, rows }: { title: string; rows: ReportGroup[] }) {
  if (!rows.length) return null;
  return (
    <section className="panel grid gap-2" aria-label={title}>
      <h2 className="text-lg font-bold">{title}</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1 pr-3 font-semibold"></th>
            <th className="py-1 pr-3 text-right font-semibold">Parties</th>
            <th className="py-1 pr-3 text-right font-semibold">Guests</th>
            <th className="py-1 text-right font-semibold">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.label} className="border-t border-line">
              <td className="py-1.5 pr-3">{g.label}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{g.parties}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{g.guests}</td>
              <td className="py-1.5 text-right tabular-nums">{money(g.revenueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const me = await requireRole("admin", "editor");
  const setup = await loadSetup(me);
  const today = todayIn(setup.org.timeZone);
  const { from, to } = reportRange(await searchParams, today);
  const r = await buildReport(await createClient(), setup, await loadMenus(), from, to);
  const t = r.totals;
  const d = r.demand;

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Reports</h1>

      <form className="panel grid gap-3" aria-label="Dates">
        <div className="flex flex-wrap items-end gap-3">
          <label className="field">
            From
            <input className="input" type="date" name="from" defaultValue={from} />
          </label>
          <label className="field">
            To
            <input className="input" type="date" name="to" defaultValue={to} />
          </label>
          <button className="btn btn-primary" type="submit">
            Show
          </button>
          <a className="btn" href={`/reports/pdf?from=${from}&to=${to}`} target="_blank" rel="noopener">
            Download PDF
          </a>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {quickRanges(today).map((q) => (
            <Link key={q.label} className="chip min-h-9 px-3 no-underline" href={`/reports?from=${q.from}&to=${q.to}`}>
              {q.label}
            </Link>
          ))}
        </div>
      </form>

      <section className="panel grid gap-3" aria-label="Summary">
        <h2 className="text-lg font-bold">
          {longDateYear(from)} to {longDateYear(to)}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Booked parties" value={String(t.parties)} />
          <Stat label="Guests" value={String(t.guests)} />
          <Stat label="Party totals (revenue)" value={money(t.revenueCents)} strong />
          <Stat label="Deposits received" value={money(t.depositsCents)} />
          <Stat label="Final payments recorded" value={money(t.finalPaymentsCents)} />
          <Stat label="Balance still to collect" value={money(t.dueCents)} strong />
        </div>
        <p className="m-0 text-sm text-muted">
          {t.cancelled} cancelled · {t.holds} on hold, not yet booked
          {t.withoutTotal ? ` · ${t.withoutTotal} booked ${t.withoutTotal === 1 ? "party has" : "parties have"} no total yet (no menu or guest count)` : ""}
        </p>
      </section>

      <section className="panel grid gap-3" aria-label="Demand for taken dates">
        <h2 className="text-lg font-bold">Demand for taken dates</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Asked for a date that was already booked" value={String(d.takenRequests)} strong />
          <Stat label="Taken dates and times asked for" value={String(d.takenDates)} />
          <Stat label="Guests they planned" value={String(d.guests)} />
        </div>
        <p className="m-0 text-sm text-muted">
          From the waitlist: {d.requests} {d.requests === 1 ? "request" : "requests"} in all, {d.bookedLater} booked
          later.
        </p>
        {d.byMonth.length ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 pr-3 font-semibold">Month</th>
                <th className="py-1 pr-3 text-right font-semibold">Asked</th>
                <th className="py-1 text-right font-semibold">Date was taken</th>
              </tr>
            </thead>
            <tbody>
              {d.byMonth.map((m) => (
                <tr key={m.label} className="border-t border-line">
                  <td className="py-1.5 pr-3">{m.label}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{m.requests}</td>
                  <td className="py-1.5 text-right tabular-nums">{m.taken}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <GroupTable title="By month" rows={r.byMonth} />
      <GroupTable title="By venue" rows={r.byVenue} />
      <GroupTable title="By style" rows={r.byStyle} />
      <GroupTable title="By type of party" rows={r.byOccasion} />
    </div>
  );
}
