// Holiday pricing: a higher gratuity on chosen federal holidays (and the day
// they're observed), and special per-person prices during Chanukah.

import type { ISODate } from "./dates";
import { holidaysOn } from "./holidays";
import type { MenuDef } from "./menu";
import type { PartyStyle } from "./schedule";

export const HOLIDAY_OPTIONS = [
  { key: "new_year", label: "New Year’s Day", match: "New Year’s Day" },
  { key: "mlk", label: "Martin Luther King Jr. Day", match: "Martin Luther King Jr. Day" },
  { key: "presidents", label: "Presidents’ Day", match: "Presidents’ Day" },
  { key: "memorial", label: "Memorial Day", match: "Memorial Day" },
  { key: "juneteenth", label: "Juneteenth", match: "Juneteenth" },
  { key: "july4", label: "Independence Day (July 4th)", match: "Independence Day" },
  { key: "labor", label: "Labor Day", match: "Labor Day" },
  { key: "columbus", label: "Columbus Day", match: "Columbus Day" },
  { key: "veterans", label: "Veterans Day", match: "Veterans Day" },
  { key: "thanksgiving", label: "Thanksgiving", match: "Thanksgiving" },
  { key: "christmas", label: "Christmas Day", match: "Christmas Day" },
] as const;

export type HolidayPricing = {
  gratuityPercent: number;
  gratuityDays: string[];
  /** Per-person price in cents by style during Chanukah. */
  chanukahPrices: Partial<Record<PartyStyle, number>>;
};

export const NO_HOLIDAY_PRICING: HolidayPricing = { gratuityPercent: 0, gratuityDays: [], chanukahPrices: {} };

/**
 * The menu as priced on a date: the base price and gratuity changed for the
 * holiday, with a note saying why. Brises (package price, no gratuity) and
 * Saturday nights (their own price) keep their prices.
 */
export function pricedMenu(
  menu: MenuDef,
  date: ISODate | "",
  style: PartyStyle,
  rules: HolidayPricing,
  saturdayNight = false,
): { menu: MenuDef; notes: string[] } {
  if (!date) return { menu, notes: [] };
  const names = holidaysOn(date).map((h) => h.name);
  const notes: string[] = [];
  let out = menu;
  const federal = HOLIDAY_OPTIONS.find(
    (o) => rules.gratuityDays.includes(o.key) && names.some((n) => n === o.match || n === `${o.match} (observed)`),
  );
  if (federal && menu.gratuityPercent > 0 && rules.gratuityPercent > 0 && rules.gratuityPercent !== menu.gratuityPercent) {
    out = { ...out, gratuityPercent: rules.gratuityPercent };
    notes.push(`${federal.label}: ${rules.gratuityPercent}% gratuity`);
  }
  const chanukah = names.some((n) => n.startsWith("Chanukah ("));
  const price = rules.chanukahPrices[style];
  if (chanukah && price && menu.pricing === "per_person" && !saturdayNight && price !== menu.basePriceCents) {
    out = { ...out, basePriceCents: price };
    notes.push(`Chanukah pricing: $${price / 100} per person`);
  }
  return { menu: out, notes };
}

export function holidayPricingFromRow(row: {
  holiday_gratuity_percent: number | string;
  holiday_gratuity_days: string[];
  chanukah_prices: unknown;
}): HolidayPricing {
  const prices = (row.chanukah_prices ?? {}) as Record<string, unknown>;
  const chanukahPrices: Partial<Record<PartyStyle, number>> = {};
  for (const s of ["plated", "family", "buffet"] as const) {
    const v = Number(prices[s]);
    if (Number.isFinite(v) && v > 0) chanukahPrices[s] = Math.round(v);
  }
  return {
    gratuityPercent: Number(row.holiday_gratuity_percent),
    gratuityDays: row.holiday_gratuity_days ?? [],
    chanukahPrices,
  };
}
