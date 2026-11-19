// Calendar dates are plain "YYYY-MM-DD" strings in the organization's
// timezone. These helpers never depend on the device's own timezone.

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function parseISODate(s: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseISODate(s);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function toISODate(y: number, m: number, d: number): ISODate {
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addDays(s: ISODate, n: number): ISODate {
  const { y, m, d } = parseISODate(s);
  return toISODate(y, m, d + n);
}

/** 0 = Sunday. */
export function weekday(s: ISODate): number {
  const { y, m, d } = parseISODate(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const pa = parseISODate(a);
  const pb = parseISODate(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

/** Today's date in the given timezone. */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Minutes the timezone is ahead of UTC at a given instant (New York winter: -300). */
function offsetMinutes(timeZone: string, instant: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/**
 * True when the date is in standard (winter) time: the half of the year with
 * the smaller UTC offset. Matches app.is_standard_time in the database.
 */
export function isStandardTime(s: ISODate, timeZone: string): boolean {
  const { y, m, d } = parseISODate(s);
  const at = (mm: number, dd: number) => offsetMinutes(timeZone, new Date(Date.UTC(y, mm - 1, dd, 17)));
  return at(m, d) === Math.min(at(1, 1), at(7, 1));
}

export function monthKey(s: ISODate): string {
  return s.slice(0, 7);
}

export function isMonthKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}

/** The 6-week grid (Sunday first) that shows the month. */
export function monthGrid(key: string): ISODate[] {
  const [y, m] = key.split("-").map(Number);
  const first = toISODate(y, m, 1);
  const start = addDays(first, -weekday(first));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Math.ceil((weekday(first) + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => addDays(start, i));
}

const fmt = (opts: Intl.DateTimeFormatOptions) => (s: ISODate) => {
  const { y, m, d } = parseISODate(s);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
};

export const longDate = fmt({ weekday: "long", month: "long", day: "numeric" });
export const longDateYear = fmt({ weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const shortDate = fmt({ weekday: "short", month: "short", day: "numeric" });
export const monthTitle = (key: string) => fmt({ month: "long", year: "numeric" })(`${key}-01`);

/** "Wed, Nov 18, 3:15 PM" for an instant, in the given timezone. */
export function dateTimeIn(instant: string | Date, timeZone: string): string {
  return new Date(instant).toLocaleString("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
