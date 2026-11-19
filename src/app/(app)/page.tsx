import { requireMember } from "@/lib/auth";
import { loadCalendarWithMenus, loadSetup } from "@/lib/booking-data";
import { isISODate, isMonthKey, monthGrid, monthKey, todayIn } from "@/lib/dates";
import { AutoRefresh } from "@/components/auto-refresh";
import { DayPanel } from "@/components/calendar/day-panel";
import { MonthGrid } from "@/components/calendar/month-grid";

export default async function CalendarPage({ searchParams }: PageProps<"/">) {
  const member = await requireMember();
  const { org, venues, slots } = await loadSetup(member);
  const params = await searchParams;
  const today = todayIn(org.timeZone);

  const month = isMonthKey(params.m) ? params.m : isISODate(params.d) ? monthKey(params.d) : monthKey(today);
  const selected = isISODate(params.d)
    ? params.d
    : month === monthKey(today)
      ? today
      : `${month}-01`;

  const grid = monthGrid(month);
  const from = selected < grid[0] ? selected : grid[0];
  const to = selected > grid[grid.length - 1] ? selected : grid[grid.length - 1];
  const entries = await loadCalendarWithMenus(member, from, to);
  const canEdit = member.role !== "kitchen";

  return (
    <div className="grid gap-4">
      <AutoRefresh />
      {params.saved ? (
        <div className="box box-ok" role="status">
          {params.saved === "cancelled" ? "Booking cancelled. The slot is open again." : "Booking saved."}
        </div>
      ) : null}
      <MonthGrid
        month={month}
        selected={selected}
        today={today}
        entries={entries}
        venues={venues}
        slots={slots}
        timeZone={org.timeZone}
        showHolds={canEdit}
      />
      <DayPanel
        date={selected}
        today={today}
        entries={entries}
        venues={venues}
        slots={slots}
        timeZone={org.timeZone}
        canEdit={canEdit}
      />
    </div>
  );
}
