// Booking rules shared by the screens (for instant feedback) and the server
// actions (before saving). The database enforces the same rules again.

import { isStandardTime, weekday, type ISODate } from "./dates";
import { clock } from "./format";

export type PartyStyle = "plated" | "family" | "buffet" | "bris";
export type PartyOccasion =
  | "sheva_brachos"
  | "bris"
  | "bat_mitzvah"
  | "corporate"
  | "upsherin"
  | "melava_malka"
  | "shalosh_seudos"
  | "kiddush"
  | "vort"
  | "other";

export const OCCASION_LABELS: Record<PartyOccasion, string> = {
  bris: "Bris",
  melava_malka: "Melava Malka",
  shalosh_seudos: "Shalosh Seudos",
  bat_mitzvah: "Bat Mitzvah",
  upsherin: "Upsherin",
  kiddush: "Kiddush",
  vort: "Vort / L'chaim",
  sheva_brachos: "Sheva Brachos",
  corporate: "Corporate Event",
  other: "Other",
};

export const ALL_OCCASIONS = Object.keys(OCCASION_LABELS) as PartyOccasion[];

/** The business's event types, in its order, always ending with "Other". */
export function occasionChoices(enabled: string[] | null | undefined): PartyOccasion[] {
  const list = (enabled?.length ? enabled : ALL_OCCASIONS).filter((o): o is PartyOccasion =>
    (ALL_OCCASIONS as string[]).includes(o),
  );
  return [...list.filter((o) => o !== "other"), "other"];
}

/** "Sheva Brachos", or the typed name for "Other"; empty when not set. */
export function occasionLabel(occasion: PartyOccasion | "" | null | undefined, other?: string | null): string {
  if (!occasion) return "";
  if (occasion === "other") return other?.trim() || "Other";
  return OCCASION_LABELS[occasion];
}

/** "Head table, Mechitza" for the setup notes; empty when neither. */
export function setupLabel(headTable: boolean, mechitza: boolean): string {
  return [headTable ? "Head table" : "", mechitza ? "Mechitza" : ""].filter(Boolean).join(", ");
}
export type PaymentMethod = "cash" | "check" | "zelle" | "credit_card";
export type VenueKind = "event_space" | "catering" | "other";

export const STYLE_LABELS: Record<PartyStyle, string> = {
  plated: "Plated",
  family: "Family style",
  buffet: "Buffet",
  bris: "Bris",
};

const STYLE_PLURALS: Record<PartyStyle, string> = {
  plated: "plated parties",
  family: "family-style parties",
  buffet: "buffets",
  bris: "brises",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  zelle: "Zelle",
  credit_card: "Credit card",
};

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type SlotRule = {
  id: string;
  key: string;
  label: string;
  startEarliest: number;
  startLatest: number;
  endLatest: number | null;
  maxMinutes: number;
  weekdays: number[];
  standardTimeOnlyWeekdays: number[];
  allowedStyles: PartyStyle[] | null;
  maxGuests: number | null;
  /** Closed days for this time of day (yom tov), date → reason. */
  closedDates?: Record<ISODate, string>;
};

export type VenueRule = {
  id: string;
  name: string;
  code: string;
  color: string;
  kind: VenueKind;
  exclusive: boolean;
  extraFeeCents: number;
  slotKeys: string[] | null;
};

/** Why a slot is closed on a date, or null when it is open. */
export function slotClosedReason(slot: SlotRule, date: ISODate, timeZone: string): string | null {
  const holiday = slot.closedDates?.[date];
  if (holiday) {
    return holiday.startsWith("Erev ")
      ? `${holiday}: no ${slot.label.toLowerCase()} parties (the holiday starts at sundown).`
      : `Closed for ${holiday}.`;
  }
  const dow = weekday(date);
  if (!slot.weekdays.includes(dow)) {
    return `${slot.label} parties aren’t booked on ${WEEKDAY_NAMES[dow]}s.`;
  }
  if (slot.standardTimeOnlyWeekdays.includes(dow) && !isStandardTime(date, timeZone)) {
    return `${WEEKDAY_NAMES[dow]} ${slot.label.toLowerCase()} parties are only booked in the winter.`;
  }
  return null;
}

/** Venues where the fee is typed in per booking: "Other" locations and delivery. */
export function feeTypedIn(kind: VenueKind | undefined): boolean {
  return kind === "other" || kind === "catering";
}

/** The fee for a booking at a venue: the typed-in fee, or the venue's standard fee. */
export function venueFeeFor(venue: VenueRule | undefined, bookingFeeCents: number | null | undefined): number {
  if (!venue) return 0;
  return feeTypedIn(venue.kind) ? (bookingFeeCents ?? venue.extraFeeCents) : venue.extraFeeCents;
}

export function venueFeeLabel(kind: VenueKind | undefined): string {
  return kind === "catering" ? "Delivery fee" : "Location fee";
}

export function venueOffersSlot(venue: VenueRule, slot: SlotRule): boolean {
  return !venue.slotKeys || venue.slotKeys.includes(slot.key);
}

export function stylesFor(slot: SlotRule): PartyStyle[] {
  return slot.allowedStyles ?? ["plated", "family", "buffet"];
}

/** Start times every 15 minutes within the slot's window. */
export function startTimes(slot: SlotRule): number[] {
  const out: number[] = [];
  for (let m = slot.startEarliest; m <= slot.startLatest; m += 15) out.push(m);
  return out;
}

/** Allowed party lengths in minutes for a start time, longest last. */
export function lengths(slot: SlotRule, start: number): number[] {
  const out: number[] = [];
  for (let m = 60; m <= slot.maxMinutes; m += 30) {
    if (slot.endLatest === null || start + m <= slot.endLatest) out.push(m);
  }
  return out;
}

export function hoursLabel(minutes: number): string {
  const h = minutes / 60;
  return `${h % 1 ? h.toFixed(1) : h} ${h === 1 ? "hour" : "hours"}`;
}

export type BookingDraft = {
  venueId: string;
  slotId: string;
  date: ISODate;
  startMinute: number;
  durationMinutes: number;
  style: PartyStyle;
  occasion: PartyOccasion | "";
  occasionOther: string;
  headTable: boolean;
  mechitza: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  otherVenueName: string;
  venueAddress: string;
  venueFeeCents: number | null;
  waiters: number;
  men: number;
  women: number;
  children: number;
  notes: string;
  depositPaid: boolean;
  depositMethod: PaymentMethod | "";
  depositAmountCents: number | null;
  depositReceivedOn: ISODate | "";
  contractSentOn: ISODate | "";
  contractSignedOn: ISODate | "";
  finalConfirmed: boolean;
};

export type RuleContext = {
  slot: SlotRule | undefined;
  venue: VenueRule | undefined;
  today: ISODate;
  timeZone: string;
  /** Check day, time, and past-date rules (new booking, or timing changed). */
  checkSchedule: boolean;
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function guestTotal(d: Pick<BookingDraft, "men" | "women" | "children">): number {
  return d.men + d.women + d.children;
}

/** Problems that stop the booking from being saved, in plain words. */
export function bookingProblems(d: BookingDraft, ctx: RuleContext): string[] {
  const e: string[] = [];
  const { slot, venue } = ctx;

  if (!d.lastName.trim()) e.push("Add the client’s last name.");
  if (!d.phone.trim()) e.push("Add the client’s phone number.");
  if (d.email.trim() && !EMAIL.test(d.email.trim())) e.push("That email address doesn’t look right.");
  if (!venue) e.push("Choose a venue.");
  if (!slot) e.push("Choose a time of day.");
  if (!d.date) e.push("Pick a date.");

  if (venue?.kind === "other" && !d.otherVenueName.trim()) e.push("Enter the name of the other location.");
  if (venue?.kind === "catering" && !d.venueAddress.trim()) e.push("Enter the address where the food goes.");

  if (slot && venue && d.date && ctx.checkSchedule) {
    if (d.date < ctx.today) e.push("That date has already passed.");
    const closed = slotClosedReason(slot, d.date, ctx.timeZone);
    if (closed) e.push(closed);
    if (!venueOffersSlot(venue, slot)) e.push(`${venue.name} doesn’t take ${slot.label.toLowerCase()} parties.`);
    if (!stylesFor(slot).includes(d.style)) {
      e.push(
        slot.allowedStyles?.length === 1
          ? `${slot.label} parties are ${STYLE_PLURALS[slot.allowedStyles[0]]} only.`
          : `${STYLE_LABELS[d.style]} isn’t offered in the ${slot.label.toLowerCase()}.`,
      );
    }
    if (d.startMinute < slot.startEarliest || d.startMinute > slot.startLatest) {
      e.push(
        slot.startEarliest === slot.startLatest
          ? `${slot.label} parties start at ${clock(slot.startEarliest)}.`
          : `${slot.label} parties start between ${clock(slot.startEarliest)} and ${clock(slot.startLatest)}.`,
      );
    }
    if (d.durationMinutes > slot.maxMinutes) e.push(`Parties last ${hoursLabel(slot.maxMinutes)} at most.`);
    if (slot.endLatest !== null && d.startMinute + d.durationMinutes > slot.endLatest) {
      e.push(`${slot.label} parties must end by ${clock(slot.endLatest)}.`);
    }
  }

  if (slot?.maxGuests && guestTotal(d) > slot.maxGuests) {
    e.push(`${slot.label} parties take ${slot.maxGuests} guests at most.`);
  }

  if (d.depositPaid) {
    if (!d.depositMethod) e.push("Choose how the deposit was paid.");
    if (!d.depositAmountCents || d.depositAmountCents <= 0) e.push("Enter the deposit amount.");
    if (!d.depositReceivedOn) e.push("Enter the date the deposit came in.");
  }
  if (d.finalConfirmed && guestTotal(d) === 0) e.push("Enter the guest count before marking the party finalized.");

  return e;
}
