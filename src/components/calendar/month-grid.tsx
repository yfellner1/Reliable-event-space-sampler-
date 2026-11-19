import Link from "next/link";
import type { CalendarEntry } from "@/lib/booking-data";
import { monthGrid, monthTitle, shiftMonth, shortDate, type ISODate } from "@/lib/dates";
import { holidaysOn, shortHoliday } from "@/lib/holidays";
import { slotClosedReason, type SlotRule, type VenueRule } from "@/lib/schedule";

type Props = {
  month: string;
  selected: ISODate;
  today: ISODate;
  entries: CalendarEntry[];
  venues: VenueRule[];
  slots: SlotRule[];
  timeZone: string;
  showHolds: boolean;
};

const MAX_BARS = 4;

export function MonthGrid({ month, selected, today, entries, venues, slots, timeZone, showHolds }: Props) {
  const days = monthGrid(month);
  const venueById = new Map(venues.map((v) => [v.id, v]));
  const slotOrder = new Map(slots.map((s, i) => [s.id, i]));
  const venueOrder = new Map(venues.map((v, i) => [v.id, i]));
  const byDay = new Map<ISODate, CalendarEntry[]>();
  for (const e of entries) {
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }
  for (const list of byDay.values()) {
    list.sort(
      (a, b) =>
        (slotOrder.get(a.slotId) ?? 0) - (slotOrder.get(b.slotId) ?? 0) ||
        (venueOrder.get(a.venueId) ?? 0) - (venueOrder.get(b.venueId) ?? 0),
    );
  }

  return (
    <section className="panel" aria-label="Month">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={`/?m=${shiftMonth(month, -1)}`}
          scroll={false}
          className="btn h-11 w-11 p-0 text-xl"
          aria-label="Previous month"
        >
          ‹
        </Link>
        <div className="text-center">
          <h2 className="text-xl font-bold">{monthTitle(month)}</h2>
          {month !== today.slice(0, 7) || selected !== today ? (
            <Link href="/" scroll={false} className="text-sm font-semibold text-brand">
              Back to today
            </Link>
          ) : null}
        </div>
        <Link
          href={`/?m=${shiftMonth(month, 1)}`}
          scroll={false}
          className="btn h-11 w-11 p-0 text-xl"
          aria-label="Next month"
        >
          ›
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="pb-1 text-center text-xs text-muted" aria-hidden>
            {d}
          </span>
        ))}
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const inMonth = day.slice(0, 7) === month;
          const closed = slots.every((s) => slotClosedReason(s, day, timeZone));
          const isSel = day === selected;
          const hols = holidaysOn(day);
          const words = list.length
            ? `${list.filter((e) => e.status === "booked").length} booked${
                showHolds ? `, ${list.filter((e) => e.status === "hold").length} on hold` : ""
              }`
            : closed
              ? "closed"
              : "nothing booked";
          return (
            <Link
              key={day}
              href={`/?m=${month}&d=${day}`}
              scroll={false}
              aria-current={isSel ? "date" : undefined}
              aria-label={`${shortDate(day)}${hols.length ? ` (${hols.map((h) => h.name).join(", ")})` : ""}: ${words}`}
              className={`flex min-h-16 flex-col gap-1 rounded-xl border p-1 text-ink no-underline ${
                isSel ? "border-brand bg-soft" : "border-transparent bg-bg"
              } ${inMonth ? "" : "opacity-40"} ${day < today ? "opacity-55" : ""}`}
            >
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center self-start rounded-full px-1 text-sm font-semibold ${
                  day === today ? "bg-brand text-brand-ink" : ""
                } ${closed && day !== today ? "text-muted" : ""}`}
              >
                {Number(day.slice(8))}
              </span>
              {hols.length ? (
                <span
                  aria-hidden
                  className={`line-clamp-3 overflow-hidden text-[0.58rem] leading-tight font-semibold hyphens-auto ${
                    hols[0].kind === "jewish" ? "text-jewish" : "text-accent"
                  }`}
                  title={hols.map((h) => h.name).join(", ")}
                >
                  {shortHoliday(hols[0].name)}
                  {hols.length > 1 ? " +" : ""}
                </span>
              ) : null}
              <span className="mt-auto grid gap-0.5" aria-hidden>
                {list.slice(0, MAX_BARS).map((e) => {
                  const v = venueById.get(e.venueId);
                  const color = v?.color ?? "var(--muted)";
                  const hold = e.status === "hold";
                  return (
                    <span
                      key={e.id}
                      className="flex h-3.5 items-center rounded-[3px] px-0.5 text-[0.6rem] leading-none font-bold"
                      style={
                        hold
                          ? { border: `1.5px dashed ${color}`, color }
                          : { background: color, color: "#fff" }
                      }
                    >
                      {v?.code}
                    </span>
                  );
                })}
                {list.length > MAX_BARS ? (
                  <span className="text-[0.65rem] leading-none text-muted">+{list.length - MAX_BARS}</span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>

      <ul className="mt-4 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-sm text-muted">
        {venues.map((v) => (
          <li key={v.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-flex h-4 w-5 items-center justify-center rounded-[3px] text-[0.65rem] font-bold text-white"
              style={{ background: v.color }}
            >
              {v.code}
            </span>
            {v.name}
          </li>
        ))}
        {showHolds ? (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-4 w-5 rounded-[3px] border-[1.5px] border-dashed border-muted" />
            Dashed = on hold
          </li>
        ) : null}
      </ul>
    </section>
  );
}
