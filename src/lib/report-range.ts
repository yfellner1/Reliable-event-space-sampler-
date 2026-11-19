import { addDays, isISODate, toISODate, type ISODate } from "./dates";

/** The report's dates from the address, defaulting to this month. */
export function reportRange(params: { from?: unknown; to?: unknown }, today: ISODate): { from: ISODate; to: ISODate } {
  const monthStart = `${today.slice(0, 8)}01`;
  const from = isISODate(params.from) ? params.from : monthStart;
  let to = isISODate(params.to) ? params.to : lastOfMonth(monthStart);
  if (to < from) to = from;
  return { from, to };
}

export function lastOfMonth(day: ISODate): ISODate {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  return addDays(m === 12 ? toISODate(y + 1, 1, 1) : toISODate(y, m + 1, 1), -1);
}

/** Quick choices: this month, last month, this year, last year. */
export function quickRanges(today: ISODate): { label: string; from: ISODate; to: ISODate }[] {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const thisMonth = toISODate(y, m, 1);
  const lastMonth = m === 1 ? toISODate(y - 1, 12, 1) : toISODate(y, m - 1, 1);
  return [
    { label: "This month", from: thisMonth, to: lastOfMonth(thisMonth) },
    { label: "Last month", from: lastMonth, to: lastOfMonth(lastMonth) },
    { label: "This year", from: toISODate(y, 1, 1), to: toISODate(y, 12, 31) },
    { label: "Last year", from: toISODate(y - 1, 1, 1), to: toISODate(y - 1, 12, 31) },
  ];
}
