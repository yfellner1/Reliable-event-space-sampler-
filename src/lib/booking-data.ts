import "server-only";
import { fullName } from "@/lib/format";
import { holidayPricingFromRow, type HolidayPricing } from "@/lib/holiday-pricing";
import { cache } from "react";
import type { Member } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { occasionLabel, setupLabel, type PartyStyle, type SlotRule, type VenueRule } from "@/lib/schedule";
import { daysBetween, todayIn, type ISODate, addDays } from "@/lib/dates";
import { attentionList, type AttentionBooking } from "@/lib/attention";
import { choiceText, hasDishes, menuFor, menuProblems, type BusinessPricing, type MenuChoice, type MenuDef, type MenuLine } from "@/lib/menu";

export type OrgSettings = {
  id: string;
  name: string;
  timeZone: string;
  holdHours: number;
  depositCents: number;
  finalDays: number;
  contractDays: number;
  holidayPricing: HolidayPricing;
  /** Business profile shown on screens, contracts, and reports. */
  profile: BusinessProfile;
  /** Event types offered in the booking form, in order. */
  occasions: string[];
  pricing: BusinessPricing;
};

export type BusinessProfile = {
  name: string;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  brandColor: string;
};

export type Setup = { org: OrgSettings; venues: VenueRule[]; slots: SlotRule[] };

export type DB = SupabaseClient<Database>;

/** Organization settings, venues, and slots for the signed-in member. */
export const loadSetup = cache(async (member: Member): Promise<Setup> => setupFor(await createClient(), member.orgId));

/**
 * Settings, venues, and slots for an organization. Works with the signed-in
 * user's client and with the secret-key client used by scheduled jobs.
 */
export async function setupFor(supabase: DB, orgId: string): Promise<Setup> {
  const [{ data: org }, { data: venues }, { data: slots }, { data: closed }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id, name, timezone, hold_hours, deposit_cents, final_days, contract_days, holiday_gratuity_percent, holiday_gratuity_days, chanukah_prices, tagline, phone, email, website, address, brand_color, occasions, sales_tax_percent, waiter_rate_cents, waiter_min, waiter_hours_included, waiter_extra_hour_cents",
      )
      .eq("id", orgId)
      .single(),
    supabase
      .from("venues")
      .select("id, name, code, color, kind, exclusive, extra_fee_cents, slot_keys")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("slots")
      .select(
        "id, key, label, start_earliest, start_latest, end_latest, max_minutes, weekdays, standard_time_only_weekdays, allowed_styles, max_guests",
      )
      .eq("org_id", orgId)
      .eq("active", true)
      .order("sort_order"),
    // Closed days (yom tov) from a year back on.
    supabase
      .from("closed_days")
      .select("day, evening_only, reason")
      .eq("org_id", orgId)
      .gte("day", addDays(todayIn("UTC"), -400))
      .order("day"),
  ]);
  if (!org) throw new Error("Organization not found.");
  const closedFor = (key: string) =>
    Object.fromEntries(
      (closed ?? []).filter((c) => !c.evening_only || key === "evening").map((c) => [c.day, c.reason]),
    );
  return {
    org: {
      id: org.id,
      name: org.name,
      timeZone: org.timezone,
      holdHours: org.hold_hours,
      depositCents: org.deposit_cents,
      finalDays: org.final_days,
      contractDays: org.contract_days,
      holidayPricing: holidayPricingFromRow(org),
      profile: {
        name: org.name,
        tagline: org.tagline,
        phone: org.phone,
        email: org.email,
        website: org.website,
        address: org.address,
        brandColor: org.brand_color,
      },
      occasions: org.occasions,
      pricing: {
        salesTaxPercent: Number(org.sales_tax_percent),
        staffing: {
          rateCents: org.waiter_rate_cents,
          min: org.waiter_min,
          hoursIncluded: org.waiter_hours_included,
          extraHourCents: org.waiter_extra_hour_cents,
        },
      },
    },
    venues: (venues ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      code: v.code,
      color: v.color,
      kind: v.kind,
      exclusive: v.exclusive,
      extraFeeCents: v.extra_fee_cents,
      slotKeys: v.slot_keys,
    })),
    slots: (slots ?? []).map((s) => ({
      id: s.id,
      key: s.key,
      label: s.label,
      startEarliest: s.start_earliest,
      startLatest: s.start_latest,
      endLatest: s.end_latest,
      maxMinutes: s.max_minutes,
      weekdays: s.weekdays,
      standardTimeOnlyWeekdays: s.standard_time_only_weekdays,
      allowedStyles: s.allowed_styles as PartyStyle[] | null,
      maxGuests: s.max_guests,
      closedDates: closedFor(s.key),
    })),
  };
}

/**
 * One party on the calendar. Client details are only filled in for editors
 * and admins; kitchen staff get the fields of the kitchen_schedule view.
 */
export type CalendarEntry = {
  id: string;
  venueId: string;
  slotId: string;
  date: ISODate;
  startMinute: number;
  durationMinutes: number;
  style: PartyStyle;
  /** "Sheva Brachos" etc., or "" when not set. */
  occasion: string;
  /** "Head table, Mechitza", or "" when neither. */
  setup: string;
  guests: { men: number; women: number; children: number; total: number };
  otherVenueName: string | null;
  venueAddress: string | null;
  /** Waiters sent with the food (0: drop-off). */
  waiters: number;
  finalConfirmed: boolean;
  status: "hold" | "booked";
  holdExpiresAt: string | null;
  depositPaid: boolean;
  contractSigned: boolean;
  /** Final payment received; left out for kitchen staff. */
  finalPaid?: boolean;
  client: { name: string; phone: string } | null;
  menuNotes: string | null;
  menu: MenuLine[];
};

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

export async function loadCalendar(member: Member, from: ISODate, to: ISODate): Promise<CalendarEntry[]> {
  const supabase = await createClient();

  if (member.role === "kitchen") {
    const { data } = await supabase
      .from("kitchen_schedule")
      .select("*")
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date")
      .order("start_minute");
    return (data ?? []).map((r) => ({
      id: r.id,
      venueId: r.venue_id,
      slotId: r.slot_id,
      date: r.event_date,
      startMinute: r.start_minute,
      durationMinutes: r.duration_minutes,
      style: r.party_style,
      occasion: occasionLabel(r.occasion, r.occasion_other),
      setup: setupLabel(Boolean(r.head_table), Boolean(r.mechitza)),
      guests: { men: r.guests_men, women: r.guests_women, children: r.guests_children, total: r.guests_total ?? 0 },
      otherVenueName: r.other_venue_name,
      venueAddress: r.venue_address,
      waiters: r.waiters ?? 0,
      finalConfirmed: r.final_confirmed,
      status: "booked" as const,
      holdExpiresAt: null,
      depositPaid: true,
      contractSigned: false,
      client: null,
      menuNotes: r.menu_notes,
      menu: [] as MenuLine[],
    }));
  }

  const { data } = await supabase
    .from("bookings")
    .select("*")
    .gte("event_date", from)
    .lte("event_date", to)
    .in("status", ["hold", "booked"])
    .order("event_date")
    .order("start_minute");
  return ((data ?? []) as BookingRow[])
    // A hold whose time ran out frees the slot, even before the minute job runs.
    .map((b) => ({
      id: b.id,
      venueId: b.venue_id,
      slotId: b.slot_id,
      date: b.event_date,
      startMinute: b.start_minute,
      durationMinutes: b.duration_minutes,
      style: b.party_style,
      occasion: occasionLabel(b.occasion, b.occasion_other),
      setup: setupLabel(b.head_table, b.mechitza),
      guests: { men: b.guests_men, women: b.guests_women, children: b.guests_children, total: b.guests_total ?? 0 },
      otherVenueName: b.other_venue_name,
      venueAddress: b.venue_address,
      waiters: b.waiters,
      finalConfirmed: b.final_confirmed,
      status: b.status as "hold" | "booked",
      holdExpiresAt: b.hold_expires_at,
      depositPaid: b.deposit_paid,
      contractSigned: Boolean(b.contract_signed_on),
      finalPaid: b.final_paid,
      client: { name: fullName(b.client_first_name, b.client_last_name), phone: b.client_phone },
      menuNotes: b.menu_notes,
      menu: [] as MenuLine[],
    }));
}

/** Calendar entries with their chosen dishes filled in. */
export async function loadCalendarWithMenus(member: Member, from: ISODate, to: ISODate) {
  const entries = await loadCalendar(member, from, to);
  const lines = await loadMenuLines(entries.map((e) => e.id));
  return entries.map((e) => ({ ...e, menu: lines.get(e.id) ?? [] }));
}

/** Active menus with their sections and items. Editors and admins only. */
export const loadMenus = cache(async (): Promise<MenuDef[]> => menusFor(await createClient(), null));

/** Menus for an organization (null: whatever the signed-in user can read). */
export async function menusFor(supabase: DB, orgId: string | null): Promise<MenuDef[]> {
  let query = supabase
    .from("menus")
    .select(
      "id, name, styles, pricing, base_price_cents, saturday_price_cents, min_guests, saturday_min_guests, gratuity_percent, child_price_percent, occasions, child_price_cents, min_children, guests_per_table, included_note, sort_order, menu_sections(id, name, note, group_label, min_choices, max_choices, included_choices, extra_choice_price_cents, sort_order, menu_items(id, name, included, price_cents, price_unit, unit_label, extra_unit_price_cents, extra_unit_label, choice_count, choice_options, choice_from_section, sort_order, active))",
    )
    .eq("active", true)
    .order("sort_order");
  if (orgId) query = query.eq("org_id", orgId);
  const { data } = await query;
  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    styles: m.styles as PartyStyle[],
    pricing: m.pricing,
    basePriceCents: m.base_price_cents,
    saturdayPriceCents: m.saturday_price_cents,
    minGuests: m.min_guests,
    saturdayMinGuests: m.saturday_min_guests,
    gratuityPercent: Number(m.gratuity_percent),
    childPricePercent: m.child_price_percent,
    occasions: m.occasions,
    childPriceCents: m.child_price_cents,
    minChildren: m.min_children,
    guestsPerTable: m.guests_per_table,
    includedNote: m.included_note,
    sections: [...(m.menu_sections ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        id: s.id,
        name: s.name,
        note: s.note,
        groupLabel: s.group_label,
        minChoices: s.min_choices,
        maxChoices: s.max_choices,
        includedChoices: s.included_choices,
        extraChoicePriceCents: s.extra_choice_price_cents,
        items: [...(s.menu_items ?? [])]
          .filter((i) => i.active)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => ({
            id: i.id,
            name: i.name,
            included: i.included,
            priceCents: i.price_cents,
            unit: i.price_unit,
            unitLabel: i.unit_label,
            extraUnitPriceCents: i.extra_unit_price_cents,
            extraUnitLabel: i.extra_unit_label,
            choiceCount: i.choice_count,
            choiceOptions: i.choice_options,
            choiceFromSection: i.choice_from_section,
          })),
      })),
  }));
}

/** The dishes chosen for one booking, with the prices saved on it. */
export async function loadBookingMenu(bookingId: string): Promise<MenuChoice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_menu_items")
    .select("item_id, quantity, choices, price_cents, price_unit, extra_unit_price_cents")
    .eq("booking_id", bookingId);
  return (data ?? []).map((r) => ({
    itemId: r.item_id,
    quantity: r.quantity,
    choices: r.choices,
    priceCents: r.price_cents,
    unit: r.price_unit,
    extraUnitPriceCents: r.extra_unit_price_cents,
  }));
}

/** Clean menu lines for parties on the calendar, by booking id. No prices. */
export async function loadMenuLines(bookingIds: string[]): Promise<Map<string, MenuLine[]>> {
  const out = new Map<string, MenuLine[]>();
  if (!bookingIds.length) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("kitchen_menu")
    .select("booking_id, section_name, section_order, item_name, item_order, price_unit, extra_unit_label, quantity, choices")
    .in("booking_id", bookingIds);
  const rows = [...(data ?? [])].sort(
    (a, b) => (a.section_order ?? 0) - (b.section_order ?? 0) || (a.item_order ?? 0) - (b.item_order ?? 0),
  );
  for (const r of rows) {
    if (!r.booking_id || !r.section_name || !r.item_name || !r.price_unit) continue;
    const lines = out.get(r.booking_id) ?? [];
    const text = choiceText(r.item_name, r.price_unit, r.quantity ?? 0, r.choices ?? [], r.extra_unit_label);
    const last = lines[lines.length - 1];
    if (last?.section === r.section_name) last.items.push(text);
    else lines.push({ section: r.section_name, items: [text] });
    out.set(r.booking_id, lines);
  }
  return out;
}

export type AttentionRow = AttentionBooking & {
  clientName: string;
  phone: string;
  venueId: string;
  slotId: string;
  otherVenueName: string | null;
};

/** Upcoming parties that need the secretary, with what each one needs. */
export const loadAttention = cache(async (member: Member) => attentionFor(await createClient(), member.orgId));

/**
 * The Needs-attention list for an organization. Works with the signed-in
 * user's client and with the secret-key client used by the daily reminder.
 */
export async function attentionFor(supabase: DB, orgId: string) {
  const setup = await setupFor(supabase, orgId);
  const { org } = setup;
  const today = todayIn(org.timeZone);
  const now = Date.now();

  const [{ data: upcoming }, { data: unpaid }, { data: notes }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .eq("org_id", orgId)
      .gte("event_date", today)
      .in("status", ["hold", "booked", "expired", "cancelled"])
      .order("event_date"),
    // Parties in the last 90 days still waiting for the final payment.
    supabase
      .from("bookings")
      .select("*")
      .eq("org_id", orgId)
      .lt("event_date", today)
      .gte("event_date", addDays(today, -90))
      .eq("status", "booked")
      .eq("final_paid", false)
      .order("event_date"),
    supabase.from("booking_notes").select("booking_id").eq("org_id", orgId).is("read_at", null),
  ]);
  const { data: submissions } = await supabase
    .from("client_submissions")
    .select("booking_id")
    .eq("org_id", orgId)
    .eq("status", "pending");
  const clientUpdates = new Set((submissions ?? []).map((s) => s.booking_id));
  const rows = [...(unpaid ?? []), ...(upcoming ?? [])];
  const unread = new Map<string, number>();
  for (const n of notes ?? []) unread.set(n.booking_id, (unread.get(n.booking_id) ?? 0) + 1);

  // Menu completeness only matters close to the party; check those.
  const soonIds = rows
    .filter((r) => r.event_date >= today && daysBetween(today, r.event_date) <= org.finalDays)
    .map((r) => r.id);
  const menus = soonIds.length ? await menusFor(supabase, orgId) : [];
  const choicesByBooking = new Map<string, MenuChoice[]>();
  if (soonIds.length) {
    const { data } = await supabase
      .from("booking_menu_items")
      .select("booking_id, item_id, quantity, choices")
      .in("booking_id", soonIds);
    for (const c of data ?? []) {
      const list = choicesByBooking.get(c.booking_id) ?? [];
      list.push({ itemId: c.item_id, quantity: c.quantity, choices: c.choices });
      choicesByBooking.set(c.booking_id, list);
    }
  }
  const menuReady = (r: NonNullable<typeof rows>[number]) => {
    const menu = menuFor(menus, r.party_style, r.occasion);
    if (!hasDishes(menu)) return Boolean(r.menu_notes?.trim());
    const chosen = choicesByBooking.get(r.id) ?? [];
    return chosen.length > 0 && menuProblems(menu!, chosen, true).length === 0;
  };

  const bookings: AttentionRow[] = rows.map((r) => ({
    id: r.id,
    date: r.event_date,
    status: r.status,
    holdExpiresAt: r.hold_expires_at,
    depositPaid: r.deposit_paid,
    depositReceivedOn: r.deposit_received_on,
    contractSentOn: r.contract_sent_on,
    contractSignedOn: r.contract_signed_on,
    finalConfirmed: r.final_confirmed,
    guests: r.guests_total ?? 0,
    menuReady: soonIds.includes(r.id) ? menuReady(r) : false,
    unreadNotes: unread.get(r.id) ?? 0,
    finalPaid: r.final_paid,
    clientUpdate: clientUpdates.has(r.id),
    clientName: fullName(r.client_first_name, r.client_last_name),
    phone: r.client_phone,
    venueId: r.venue_id,
    slotId: r.slot_id,
    otherVenueName: r.other_venue_name,
  }));

  return {
    today,
    setup,
    entries: attentionList(bookings, today, now, { finalDays: org.finalDays, contractDays: org.contractDays }),
  };
}
