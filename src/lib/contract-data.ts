import "server-only";
import type { Setup } from "@/lib/booking-data";
import { longDateYear, weekday } from "@/lib/dates";
import { clock } from "@/lib/format";
import { pricedMenu } from "@/lib/holiday-pricing";
import { estimate, menuFor, type MenuChoice, type MenuDef, type MenuLine } from "@/lib/menu";
import { STYLE_LABELS, occasionLabel, setupLabel, venueFeeFor, venueFeeLabel } from "@/lib/schedule";
import type { Database } from "@/lib/supabase/database.types";
import type { ContractData } from "./contract-pdf";

type Row = Database["public"]["Tables"]["bookings"]["Row"];

/** The price estimate for a saved booking, or null when its style has no menu. */
export function bookingEstimate(b: Row, setup: Setup, menus: MenuDef[], choices: MenuChoice[]) {
  const venue = setup.venues.find((v) => v.id === b.venue_id);
  const slot = setup.slots.find((s) => s.id === b.slot_id);
  const base = menuFor(menus, b.party_style, b.occasion);
  if (!base) return null;
  const saturdayNight = weekday(b.event_date) === 6 && slot?.key === "evening";
  const { menu, notes } = pricedMenu(base, b.event_date, b.party_style, setup.org.holidayPricing, saturdayNight);
  return menu
    ? estimate({
        menu,
        notes,
        choices,
        men: b.guests_men,
        women: b.guests_women,
        children: b.guests_children,
        saturdayNight,
        venueFeeCents: venueFeeFor(venue, b.venue_fee_cents),
        venueName: venue?.name ?? null,
        venueFeeLabel: venueFeeLabel(venue?.kind),
        waiters: b.waiters,
        durationMinutes: b.duration_minutes,
        staffing: setup.org.pricing.staffing,
        salesTaxPercent: setup.org.pricing.salesTaxPercent,
        depositPaidCents: b.deposit_paid ? (b.deposit_amount_cents ?? 0) : 0,
      })
    : null;
}

export function contractData(
  b: Row,
  setup: Setup,
  menus: MenuDef[],
  choices: MenuChoice[],
  menuLines: MenuLine[],
  terms: string,
  today: string,
): ContractData {
  const venue = setup.venues.find((v) => v.id === b.venue_id);
  const slot = setup.slots.find((s) => s.id === b.slot_id);
  const menu = menuFor(menus, b.party_style, b.occasion);
  const est = bookingEstimate(b, setup, menus, choices);
  return {
    orgName: setup.org.name,
    profile: setup.org.profile,
    waiters: b.waiters,
    firstName: b.client_first_name,
    lastName: b.client_last_name,
    phone: b.client_phone,
    email: b.client_email,
    eventDate: longDateYear(b.event_date),
    startTime: clock(b.start_minute),
    endTime: clock(b.start_minute + b.duration_minutes),
    slotLabel: slot?.label ?? "",
    venue: b.other_venue_name ?? (venue?.kind === "catering" ? "" : (venue?.name ?? "")),
    address: b.venue_address,
    style: STYLE_LABELS[b.party_style],
    occasion: occasionLabel(b.occasion, b.occasion_other),
    setup: setupLabel(b.head_table, b.mechitza),
    men: b.guests_men,
    women: b.guests_women,
    children: b.guests_children,
    menuName: menu?.name ?? null,
    menu: menuLines,
    menuNotes: b.menu_notes,
    notes: b.notes,
    estimate: est,
    gratuityPercent: est?.gratuityPercent ?? menu?.gratuityPercent ?? 0,
    terms,
    preparedOn: longDateYear(today).replace(/^\w+, /, ""),
  };
}
