// US federal (legal) holidays and Jewish holidays for any date, worked out
// from the calendar itself, so nothing needs to be entered or updated.
// Jewish dates come from the Hebrew calendar built into the JavaScript
// runtime (Intl, "hebrew" calendar). Holidays are listed for the daytime;
// "Erev" days are the day before, when the holiday starts at sundown.

import { addDays, toISODate, weekday, type ISODate } from "./dates";

export type Holiday = { name: string; kind: "us" | "jewish" };

const hebrewFmt = new Intl.DateTimeFormat("en-u-ca-hebrew", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** Hebrew month name and day for a date, e.g. { month: "Nisan", day: 15 }. */
export function hebrewDate(date: ISODate): { month: string; day: number } {
  const parts = hebrewFmt.formatToParts(new Date(`${date}T12:00:00Z`));
  return {
    month: parts.find((p) => p.type === "month")?.value ?? "",
    day: Number(parts.find((p) => p.type === "day")?.value ?? 0),
  };
}

const isAdar = (m: string) => m === "Adar" || m === "Adar II";
const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

function jewishHolidays(date: ISODate): string[] {
  const { month: m, day: d } = hebrewDate(date);
  const dow = weekday(date);
  const out: string[] = [];
  // A fast that falls on Shabbat moves to Sunday.
  const fast = (name: string, fd: number) => {
    if ((d === fd && dow !== 6) || (d === fd + 1 && dow === 0)) out.push(name);
  };

  switch (m) {
    case "Elul":
      if (d === 29) out.push("Erev Rosh Hashanah");
      break;
    case "Tishri":
      if (d === 1 || d === 2) out.push(`Rosh Hashanah${d === 2 ? " (2nd day)" : ""}`);
      fast("Fast of Gedaliah", 3);
      if (d === 9) out.push("Erev Yom Kippur");
      if (d === 10) out.push("Yom Kippur");
      if (d === 14) out.push("Erev Sukkot");
      if (d === 15 || d === 16) out.push("Sukkot");
      if (d >= 17 && d <= 20) out.push("Sukkot (Chol Hamoed)");
      if (d === 21) out.push("Hoshana Rabbah");
      if (d === 22) out.push("Shemini Atzeret");
      if (d === 23) out.push("Simchat Torah");
      break;
    case "Kislev":
      if (d === 24) out.push("Erev Chanukah (1st candle tonight)");
      break;
    case "Tevet":
      fast("Fast of 10 Tevet", 10);
      break;
    case "Shevat":
      if (d === 15) out.push("Tu BiShvat");
      break;
    case "Nisan":
      if (d === 14) out.push("Erev Pesach");
      if (d === 15 || d === 16) out.push("Pesach");
      if (d >= 17 && d <= 20) out.push("Pesach (Chol Hamoed)");
      if (d === 21 || d === 22) out.push("Pesach (last days)");
      break;
    case "Iyar":
      if (d === 18) out.push("Lag BaOmer");
      break;
    case "Sivan":
      if (d === 5) out.push("Erev Shavuot");
      if (d === 6 || d === 7) out.push("Shavuot");
      break;
    case "Tamuz":
      fast("Fast of 17 Tammuz", 17);
      break;
    case "Av":
      // Tisha B'Av on Shabbat moves to Sunday; Erev moves with it.
      if ((d === 8 && dow !== 5) || (d === 9 && dow === 6)) out.push("Erev Tisha B'Av");
      fast("Tisha B'Av", 9);
      break;
  }
  if (isAdar(m)) {
    // Fast of Esther: 13 Adar, or Thursday 11 Adar when the 13th is Shabbat.
    if ((d === 13 && dow !== 6) || (d === 11 && dow === 4)) out.push("Fast of Esther");
    if (d === 14) out.push("Purim");
    if (d === 15) out.push("Shushan Purim");
  }
  // Chanukah: eight days from 25 Kislev.
  for (let i = 0; i < 8; i++) {
    const h = hebrewDate(addDays(date, -i));
    if (h.month === "Kislev" && h.day === 25) {
      out.push(`Chanukah (${ORDINAL[i]} day)`);
      break;
    }
  }
  return out;
}

/** The nth weekday (0 = Sunday) of a month; n = -1 for the last one. */
function nthWeekday(year: number, month: number, dow: number, n: number): ISODate {
  if (n > 0) {
    let d = toISODate(year, month, 1);
    while (weekday(d) !== dow) d = addDays(d, 1);
    return addDays(d, (n - 1) * 7);
  }
  let d = addDays(month === 12 ? toISODate(year + 1, 1, 1) : toISODate(year, month + 1, 1), -1);
  while (weekday(d) !== dow) d = addDays(d, -1);
  return d;
}

const usCache = new Map<number, Map<ISODate, string[]>>();

function usHolidays(year: number): Map<ISODate, string[]> {
  const hit = usCache.get(year);
  if (hit) return hit;
  const map = new Map<ISODate, string[]>();
  const add = (date: ISODate, name: string) => map.set(date, [...(map.get(date) ?? []), name]);
  const fixed = (month: number, day: number, name: string) => {
    const date = toISODate(year, month, day);
    add(date, name);
    // Weekend holidays are observed on the nearest weekday.
    const dow = weekday(date);
    if (dow === 6) add(addDays(date, -1), `${name} (observed)`);
    if (dow === 0) add(addDays(date, 1), `${name} (observed)`);
  };
  fixed(1, 1, "New Year’s Day");
  add(nthWeekday(year, 1, 1, 3), "Martin Luther King Jr. Day");
  add(nthWeekday(year, 2, 1, 3), "Presidents’ Day");
  add(nthWeekday(year, 5, 1, -1), "Memorial Day");
  fixed(6, 19, "Juneteenth");
  fixed(7, 4, "Independence Day");
  add(nthWeekday(year, 9, 1, 1), "Labor Day");
  add(nthWeekday(year, 10, 1, 2), "Columbus Day");
  fixed(11, 11, "Veterans Day");
  add(nthWeekday(year, 11, 4, 4), "Thanksgiving");
  fixed(12, 25, "Christmas Day");
  // New Year's Day on a Saturday is observed on the Friday before (Dec 31).
  const nextNewYear = toISODate(year + 1, 1, 1);
  if (weekday(nextNewYear) === 6) add(toISODate(year, 12, 31), "New Year’s Day (observed)");
  usCache.set(year, map);
  return map;
}

const cache = new Map<ISODate, Holiday[]>();

/** Holidays on a date: US federal first, then Jewish. */
export function holidaysOn(date: ISODate): Holiday[] {
  const hit = cache.get(date);
  if (hit) return hit;
  const year = Number(date.slice(0, 4));
  const list: Holiday[] = [
    ...(usHolidays(year).get(date) ?? []).map((name) => ({ name, kind: "us" as const })),
    ...jewishHolidays(date).map((name) => ({ name, kind: "jewish" as const })),
  ];
  cache.set(date, list);
  return list;
}

/** A short form for the small calendar squares, with soft hyphens in long words. */
export function shortHoliday(name: string): string {
  return shortName(name).replace(/\S{8,}/g, (w) => BREAKS[w] ?? w.replace(/(.{5})(?=.{3})/g, "$1\u00AD"));
}

// Where long words break in the small squares (soft hyphens).
const SH = "\u00AD";
const BREAKS: Record<string, string> = Object.fromEntries(
  [
    "Thanks|giving", "Vete|rans", "Chanu|kah", "Inde|pendence", "June|teenth", "Memo|rial", "Colum|bus",
    "Presi|dents’", "Christ|mas", "Hasha|nah", "Geda|liah", "Shemi|ni", "Sim|chat", "Hosha|na", "BaO|mer",
    "Shu|shan", "Shav|uot",
  ].map((w) => [w.replace("|", ""), w.replace("|", SH)]),
);

function shortName(name: string): string {
  return name
    .replace(/ \(1st candle tonight\)/, "")
    .replace(/ \((\d\w+) day\)$/, " $1")
    .replace(" (Chol Hamoed)", " CH")
    .replace(" (last days)", "")
    .replace(" (2nd day)", " 2")
    .replace(" (observed)", " (obs.)")
    .replace("Martin Luther King Jr. Day", "MLK Day")
    .replace("Independence Day", "July 4th")
    .replace("New Year’s Day", "New Year’s");
}

/**
 * Yom tov closures: closed all day on Rosh Hashanah, Yom Kippur,
 * the first two days of Sukkot, all of Pesach, and Shavuot; the evening
 * before each (Erev) is closed for evening parties. Used to generate the
 * closed_days rows (scripts/closed-days.ts); the database is what's enforced.
 */
export function yomTovClosure(date: ISODate): { reason: string; eveningOnly: boolean } | null {
  const { month: m, day: d } = hebrewDate(date);
  const all = (name: string) => ({ reason: name, eveningOnly: false });
  const erev = (name: string) => ({ reason: `Erev ${name}`, eveningOnly: true });
  if (m === "Tishri") {
    if (d === 1 || d === 2) return all("Rosh Hashanah");
    if (d === 9) return erev("Yom Kippur");
    if (d === 10) return all("Yom Kippur");
    if (d === 14) return erev("Sukkot");
    if (d === 15 || d === 16) return all("Sukkot");
  }
  if (m === "Elul" && d === 29) return erev("Rosh Hashanah");
  if (m === "Nisan") {
    if (d === 14) return erev("Pesach");
    if (d >= 15 && d <= 22) return all("Pesach");
  }
  if (m === "Sivan") {
    if (d === 5) return erev("Shavuot");
    if (d === 6 || d === 7) return all("Shavuot");
  }
  return null;
}
