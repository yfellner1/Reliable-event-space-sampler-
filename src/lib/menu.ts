// Menu rules, cost estimate, and the clean menu text. Shared by the booking
// form (live) and the server (before saving).

import { money } from "./format";
import type { PartyStyle } from "./schedule";

export type PriceUnit = "per_person" | "flat" | "per_unit" | "per_table";

export type MenuItemDef = {
  id: string;
  name: string;
  included: boolean;
  priceCents: number;
  unit: PriceUnit;
  unitLabel: string | null;
  extraUnitPriceCents: number | null;
  extraUnitLabel: string | null;
  choiceCount: number | null;
  choiceOptions: string[] | null;
  choiceFromSection: boolean;
};

export type MenuSectionDef = {
  id: string;
  name: string;
  note: string | null;
  groupLabel: string | null;
  minChoices: number;
  maxChoices: number | null;
  /** Choices covered by the base price; each one past this costs extraChoicePriceCents per person. */
  includedChoices?: number | null;
  extraChoicePriceCents?: number | null;
  items: MenuItemDef[];
};

/** How many picks in this section are past the included number. */
export function extraChoices(s: MenuSectionDef, choices: MenuChoice[]): number {
  if (!s.extraChoicePriceCents || s.includedChoices === null || s.includedChoices === undefined) return 0;
  const ids = new Set(s.items.filter((i) => !i.included).map((i) => i.id));
  const picked = choices.filter((c) => ids.has(c.itemId)).length;
  return Math.max(0, picked - s.includedChoices);
}

export type MenuDef = {
  id: string;
  name: string;
  styles: PartyStyle[];
  pricing: "per_person" | "package";
  basePriceCents: number;
  saturdayPriceCents: number | null;
  minGuests: number;
  saturdayMinGuests: number | null;
  gratuityPercent: number;
  childPricePercent: number;
  /** Event types this menu is for (null: any). */
  occasions?: string[] | null;
  /** When set, children pay this price, with their own minimum. */
  childPriceCents?: number | null;
  minChildren?: number;
  /** For items priced per table. */
  guestsPerTable?: number;
  includedNote: string | null;
  sections: MenuSectionDef[];
};

/** What the booking chose. Prices are the ones saved with the booking, if any. */
export type MenuChoice = {
  itemId: string;
  quantity: number;
  choices: string[];
  priceCents?: number;
  unit?: PriceUnit;
  extraUnitPriceCents?: number | null;
};

/**
 * The menu for a booking: the first menu for its party style made for its
 * event type, otherwise the first menu for its style not tied to event types.
 */
export function menuFor(
  menus: MenuDef[],
  style: PartyStyle,
  occasion?: string | null,
): MenuDef | undefined {
  const forStyle = menus.filter((m) => m.styles.includes(style));
  return (
    (occasion ? forStyle.find((m) => m.occasions?.includes(occasion)) : undefined) ??
    forStyle.find((m) => !m.occasions?.length) ??
    forStyle[0]
  );
}

export function hasDishes(menu: MenuDef | undefined): boolean {
  return Boolean(menu?.sections.some((s) => s.items.some((i) => !i.included)));
}

export function defaultQuantity(item: MenuItemDef): number {
  if (item.unit === "per_unit") return 1;
  return 0; // flat items: additional units
}

/** Price as shown next to an item: "+$4 pp", "$85 per platter", "$250". */
export function priceLabel(item: MenuItemDef): string {
  if (item.included) return "Included";
  if (!item.priceCents) return "";
  if (item.unit === "per_person") return `+${money(item.priceCents)} pp`;
  if (item.unit === "per_unit") return `${money(item.priceCents)} per ${item.unitLabel ?? "item"}`;
  if (item.unit === "per_table") return `${money(item.priceCents)} per ${item.unitLabel ?? "table"}`;
  const extra = item.extraUnitPriceCents
    ? `, ${money(item.extraUnitPriceCents)} per ${item.extraUnitLabel ?? "extra"}`
    : "";
  return `${money(item.priceCents)}${extra}`;
}

export function ruleLabel(s: MenuSectionDef): string {
  if (s.items.every((i) => i.included)) return s.note ?? "Included";
  const n = (x: number) => ["zero", "one", "two", "three", "four", "five"][x] ?? String(x);
  let rule: string;
  if (s.minChoices === 0 && s.maxChoices === null) rule = "Optional";
  else if (s.minChoices === 0) rule = `Optional, up to ${n(s.maxChoices!)}`;
  else if (s.maxChoices === s.minChoices) rule = `Choose ${n(s.minChoices)}`;
  else if (s.maxChoices === null && s.extraChoicePriceCents) rule = `Choose ${n(s.minChoices)}`;
  else if (s.maxChoices === null) rule = `Choose at least ${n(s.minChoices)}`;
  else rule = `Choose ${n(s.minChoices)} to ${n(s.maxChoices)}`;
  if (s.extraChoicePriceCents) {
    rule +=
      s.includedChoices === 0
        ? ` · ${money(s.extraChoicePriceCents)} pp each`
        : ` · more ${money(s.extraChoicePriceCents)} pp each`;
  }
  return s.note && s.note !== "Optional" ? `${rule} · ${s.note}` : rule;
}

/**
 * Problems with the menu. `complete` also checks that every section has its
 * required number of choices; otherwise only rules that are never allowed
 * (too many choices) are checked, so a menu can be saved half-planned.
 */
export function menuProblems(menu: MenuDef, choices: MenuChoice[], complete: boolean): string[] {
  const out: string[] = [];
  const chosen = new Map(choices.map((c) => [c.itemId, c]));
  for (const s of menu.sections) {
    const picked = s.items.filter((i) => !i.included && chosen.has(i.id));
    // Per-person menus may offer guests a choice of several dishes (each one's
    // price is charged for every guest). Package menus keep their limits.
    if (menu.pricing === "package" && s.maxChoices !== null && picked.length > s.maxChoices) {
      out.push(`${s.name}: choose ${s.maxChoices === 1 ? "only one" : `no more than ${s.maxChoices}`}.`);
    }
    if (complete && picked.length < s.minChoices) {
      out.push(
        s.minChoices === 1
          ? `${s.name}: choose one.`
          : `${s.name}: choose ${s.minChoices} (${picked.length} chosen).`,
      );
    }
    for (const item of picked) {
      const c = chosen.get(item.id)!;
      if (item.choiceCount) {
        const filled = c.choices.map((x) => x.trim()).filter(Boolean);
        if (filled.length > item.choiceCount || new Set(filled).size !== filled.length) {
          out.push(`${item.name}: pick ${item.choiceCount} different ${item.choiceCount === 1 ? "option" : "options"}.`);
        } else if (complete && filled.length < item.choiceCount) {
          out.push(`${item.name}: pick ${item.choiceCount === 1 ? "one option" : `${item.choiceCount} options`}.`);
        }
      }
      if (item.unit === "per_unit" && c.quantity < 1) out.push(`${item.name}: how many?`);
    }
  }
  return out;
}

/** "Ravioli (cheese)", "Avocado salad × 2", "Sushi platters + 3 additional platters". */
export function choiceText(
  name: string,
  unit: PriceUnit,
  quantity: number,
  choices: string[],
  extraUnitLabel?: string | null,
): string {
  const picks = choices.map((c) => c.trim()).filter(Boolean);
  let s = picks.length ? `${name} (${picks.join(", ").toLowerCase()})` : name;
  if (unit === "per_unit" && quantity > 1) s += ` × ${quantity}`;
  if (unit === "flat" && quantity > 0 && extraUnitLabel) {
    s += ` + ${quantity} ${extraUnitLabel}${quantity === 1 ? "" : "s"}`;
  }
  return s;
}

export type MenuLine = { section: string; items: string[] };

/** The clean menu, in menu order, without prices. */
export function menuSummary(menu: MenuDef, choices: MenuChoice[]): MenuLine[] {
  const chosen = new Map(choices.map((c) => [c.itemId, c]));
  const lines: MenuLine[] = [];
  for (const s of menu.sections) {
    const items = s.items
      .filter((i) => !i.included && chosen.has(i.id))
      .map((i) => {
        const c = chosen.get(i.id)!;
        return choiceText(i.name, i.unit, c.quantity, c.choices, i.extraUnitLabel);
      });
    if (items.length) lines.push({ section: s.name, items });
  }
  return lines;
}

export type EstimateLine = { label: string; cents: number };

export type Estimate = {
  lines: EstimateLine[];
  foodCents: number;
  gratuityCents: number;
  venueFeeCents: number;
  /** "Delivery fee", "Location fee". */
  venueFeeLabel: string;
  waiterCents: number;
  waiterLabel: string;
  taxCents: number;
  taxPercent: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  billedGuests: number;
  minimum: number;
  underMinimum: boolean;
  gratuityPercent: number;
  /** Why prices differ from the regular menu (holiday pricing). */
  notes: string[];
};

export type EstimateInput = {
  menu: MenuDef;
  choices: MenuChoice[];
  men: number;
  women: number;
  children: number;
  saturdayNight: boolean;
  venueFeeCents: number;
  venueName: string | null;
  venueFeeLabel?: string;
  /** Waiters sent with the food, and the business's waiter prices. */
  waiters?: number;
  durationMinutes?: number;
  staffing?: Staffing;
  salesTaxPercent?: number;
  depositPaidCents: number;
  /** Holiday pricing notes (from pricedMenu). */
  notes?: string[];
};

/** Business-wide prices that apply to every menu. */
export type BusinessPricing = { staffing: Staffing; salesTaxPercent: number };

export type Staffing = {
  rateCents: number;
  min: number;
  hoursIncluded: number;
  extraHourCents: number | null;
};

const pct = (cents: number, p: number) => Math.round((cents * p) / 100);

/** Waiter charge: each waiter's price covers the included hours; extra hours cost more. */
export function waiterCharge(
  waiters: number,
  durationMinutes: number,
  staffing: Staffing | undefined,
): { cents: number; label: string } {
  if (!waiters || !staffing?.rateCents) return { cents: 0, label: "" };
  const extraHours = Math.max(0, Math.ceil(durationMinutes / 60 - staffing.hoursIncluded));
  const extra = staffing.extraHourCents ? staffing.extraHourCents * extraHours * waiters : 0;
  const label =
    `${waiters} ${waiters === 1 ? "waiter" : "waiters"} at ${money(staffing.rateCents)} (up to ${staffing.hoursIncluded} hours)` +
    (extra ? ` + ${extraHours} extra ${extraHours === 1 ? "hour" : "hours"}` : "");
  return { cents: waiters * staffing.rateCents + extra, label };
}

export function estimate(input: EstimateInput): Estimate {
  const { menu } = input;
  const lines: EstimateLine[] = [];
  const adults = input.men + input.women;
  const total = adults + input.children;
  const minimum =
    input.saturdayNight && menu.saturdayMinGuests !== null ? menu.saturdayMinGuests : menu.minGuests;

  // How many people each per-person price applies to. Everyone up to the
  // minimum pays the full base price; children past it pay the child share.
  let full: number;
  let reduced: number;
  // Menus with their own children's price bill adults and children apart,
  // each with its own minimum.
  const childPrice = menu.pricing === "per_person" ? (menu.childPriceCents ?? null) : null;
  const billedChildren = childPrice !== null && input.children > 0 ? Math.max(input.children, menu.minChildren ?? 0) : 0;
  if (childPrice !== null) {
    full = Math.max(adults, minimum);
    reduced = 0;
  } else if (menu.pricing === "package" || total <= minimum) {
    full = Math.max(total, minimum);
    reduced = 0;
  } else {
    full = Math.max(adults, minimum);
    reduced = total - full;
  }
  const childShare = menu.childPricePercent;
  // Children past the minimum get the child share of the base price only;
  // per-person add-ons are charged in full for every billed guest.
  const ppCents = (price: number) => price * full + pct(price * reduced, childShare);
  const addOnCents = (price: number) => price * (full + reduced + billedChildren);
  const tables = Math.ceil(full / Math.max(1, menu.guestsPerTable ?? 10));

  let food = 0;
  if (menu.pricing === "package") {
    lines.push({ label: `${menu.name} package (up to ${minimum} guests)`, cents: menu.basePriceCents });
    food += menu.basePriceCents;
  } else {
    const price =
      input.saturdayNight && menu.saturdayPriceCents !== null ? menu.saturdayPriceCents : menu.basePriceCents;
    const night = input.saturdayNight && menu.saturdayPriceCents !== null ? ", Saturday night" : "";
    // Menus priced only by what is chosen (base price 0) skip the guest line.
    if (price) {
      lines.push({
        label: `${full} ${childPrice !== null ? (full === 1 ? "adult" : "adults") : "guests"} at ${money(price)}${night}`,
        cents: price * full,
      });
    }
    if (billedChildren) {
      lines.push({
        label: `${billedChildren} ${billedChildren === 1 ? "child" : "children"} at ${money(childPrice!)}`,
        cents: childPrice! * billedChildren,
      });
      food += childPrice! * billedChildren;
    }
    if (reduced) {
      lines.push({
        label: `${reduced} ${reduced === 1 ? "child" : "children"} at ${money(pct(price, childShare))}`,
        cents: pct(price * reduced, childShare),
      });
    }
    food += ppCents(price);
  }

  const items = new Map(menu.sections.flatMap((s) => s.items).map((i) => [i.id, i]));
  for (const c of input.choices) {
    const item = items.get(c.itemId);
    if (!item || item.included) continue;
    const price = c.priceCents ?? item.priceCents;
    const unit = c.unit ?? item.unit;
    const extra = c.extraUnitPriceCents !== undefined ? c.extraUnitPriceCents : item.extraUnitPriceCents;
    let cents = 0;
    if (unit === "per_person") cents = addOnCents(price);
    else if (unit === "per_unit") cents = price * Math.max(1, c.quantity);
    else if (unit === "per_table") cents = price * tables;
    else cents = price + (extra ?? 0) * c.quantity;
    if (!cents) continue;
    const label = choiceText(item.name, unit, c.quantity, [], item.extraUnitLabel);
    lines.push({
      label: unit === "per_table" ? `${label} × ${tables} ${tables === 1 ? "table" : "tables"}` : label,
      cents,
    });
    food += cents;
  }

  for (const sec of menu.sections) {
    const extra = extraChoices(sec, input.choices);
    if (!extra) continue;
    const cents = addOnCents(sec.extraChoicePriceCents!) * extra;
    lines.push({
      label:
        sec.includedChoices === 0
          ? `${sec.name}: ${extra} × ${money(sec.extraChoicePriceCents!)} pp`
          : `${sec.name}: ${extra} extra ${extra === 1 ? "choice" : "choices"} × ${money(sec.extraChoicePriceCents!)} pp`,
      cents,
    });
    food += cents;
  }

  const gratuity = pct(food, menu.gratuityPercent);
  const venueFee = input.venueFeeCents;
  const waiter = waiterCharge(input.waiters ?? 0, input.durationMinutes ?? 0, input.staffing);
  const taxPercent = input.salesTaxPercent ?? 0;
  const tax = Math.round(((food + waiter.cents + venueFee) * taxPercent) / 100);
  const totalCents = food + gratuity + waiter.cents + venueFee + tax;
  const childrenShort = childPrice !== null && input.children > 0 && input.children < (menu.minChildren ?? 0);
  return {
    lines,
    foodCents: food,
    gratuityCents: gratuity,
    venueFeeCents: venueFee,
    venueFeeLabel: input.venueFeeLabel ?? "Location fee",
    waiterCents: waiter.cents,
    waiterLabel: waiter.label,
    taxCents: tax,
    taxPercent,
    totalCents,
    depositCents: input.depositPaidCents,
    balanceCents: totalCents - input.depositPaidCents,
    billedGuests: full + reduced + billedChildren,
    minimum,
    underMinimum: childPrice !== null ? (adults > 0 && adults < minimum) || childrenShort : total > 0 && total < minimum,
    gratuityPercent: menu.gratuityPercent,
    notes: input.notes ?? [],
  };
}
