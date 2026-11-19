import "server-only";
import type { DB, Setup } from "@/lib/booking-data";
import { bookingEstimate } from "@/lib/contract-data";
import { monthTitle, type ISODate } from "@/lib/dates";
import { fullName } from "@/lib/format";
import type { MenuChoice, MenuDef } from "@/lib/menu";
import { STYLE_LABELS, occasionLabel, type PartyStyle } from "@/lib/schedule";

export type ReportParty = {
  id: string;
  date: ISODate;
  client: string;
  venue: string;
  slot: string;
  style: PartyStyle;
  occasion: string;
  guests: number;
  /** Party total from the menu and guest count, or null when no menu was chosen. */
  totalCents: number | null;
  depositCents: number;
  finalPaid: boolean;
  finalPaidCents: number;
  /** Still to collect: total less deposit and final payment (0 once paid in full). */
  dueCents: number;
};

export type ReportGroup = { label: string; parties: number; guests: number; revenueCents: number };

export type Report = {
  from: ISODate;
  to: ISODate;
  parties: ReportParty[];
  totals: {
    parties: number;
    guests: number;
    revenueCents: number;
    withoutTotal: number;
    depositsCents: number;
    finalPaymentsCents: number;
    finalPaidCount: number;
    dueCents: number;
    cancelled: number;
    holds: number;
  };
  byMonth: ReportGroup[];
  byVenue: ReportGroup[];
  byStyle: ReportGroup[];
  byOccasion: ReportGroup[];
  demand: {
    requests: number;
    takenRequests: number;
    takenDates: number;
    guests: number;
    bookedLater: number;
    byMonth: { label: string; requests: number; taken: number }[];
    bySlot: { label: string; requests: number; taken: number }[];
  };
};

function group(parties: ReportParty[], key: (p: ReportParty) => string): ReportGroup[] {
  const map = new Map<string, ReportGroup>();
  for (const p of parties) {
    const k = key(p);
    const g = map.get(k) ?? { label: k, parties: 0, guests: 0, revenueCents: 0 };
    g.parties += 1;
    g.guests += p.guests;
    g.revenueCents += p.totalCents ?? 0;
    map.set(k, g);
  }
  return [...map.values()];
}

/** Everything for the report between two dates (party dates, inclusive). */
export async function buildReport(
  supabase: DB,
  setup: Setup,
  menus: MenuDef[],
  from: ISODate,
  to: ISODate,
): Promise<Report> {
  const [{ data: rows }, { data: requests }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date")
      .order("start_minute"),
    supabase
      .from("date_requests")
      .select("event_date, slot_id, was_full, guests, status")
      .gte("event_date", from)
      .lte("event_date", to),
  ]);
  const all = rows ?? [];
  const booked = all.filter((b) => b.status === "booked");

  const choices = new Map<string, MenuChoice[]>();
  if (booked.length) {
    const { data } = await supabase
      .from("booking_menu_items")
      .select("booking_id, item_id, quantity, choices, price_cents, price_unit, extra_unit_price_cents")
      .in("booking_id", booked.map((b) => b.id));
    for (const r of data ?? []) {
      choices.set(r.booking_id, [
        ...(choices.get(r.booking_id) ?? []),
        {
          itemId: r.item_id,
          quantity: r.quantity,
          choices: r.choices,
          priceCents: r.price_cents,
          unit: r.price_unit,
          extraUnitPriceCents: r.extra_unit_price_cents,
        },
      ]);
    }
  }

  const parties: ReportParty[] = booked.map((b) => {
    const venue = setup.venues.find((v) => v.id === b.venue_id);
    const slot = setup.slots.find((s) => s.id === b.slot_id);
    const picked = choices.get(b.id) ?? [];
    // Without chosen dishes there's no real total (the menu may be only in the notes).
    const est = picked.length || (b.guests_total ?? 0) > 0 ? bookingEstimate(b, setup, menus, picked) : null;
    const totalCents = est && (b.guests_total ?? 0) > 0 ? est.totalCents : null;
    const depositCents = b.deposit_paid ? (b.deposit_amount_cents ?? 0) : 0;
    const finalPaidCents = b.final_paid ? (b.final_paid_amount_cents ?? Math.max(0, (totalCents ?? 0) - depositCents)) : 0;
    const dueCents = b.final_paid ? 0 : Math.max(0, (totalCents ?? 0) - depositCents);
    return {
      id: b.id,
      date: b.event_date,
      client: fullName(b.client_first_name, b.client_last_name),
      venue: b.other_venue_name ?? venue?.name ?? "",
      slot: slot?.label ?? "",
      style: b.party_style,
      occasion: occasionLabel(b.occasion, b.occasion_other) || "Not set",
      guests: b.guests_total ?? 0,
      totalCents,
      depositCents,
      finalPaid: b.final_paid,
      finalPaidCents,
      dueCents,
    };
  });

  const sum = (f: (p: ReportParty) => number) => parties.reduce((t, p) => t + f(p), 0);
  const reqs = requests ?? [];
  const taken = reqs.filter((r) => r.was_full);
  const slotLabel = (id: string) => setup.slots.find((s) => s.id === id)?.label ?? "";
  const demandBy = (key: (r: (typeof reqs)[number]) => string, order: string[]) => {
    const map = new Map<string, { label: string; requests: number; taken: number }>();
    for (const r of reqs) {
      const k = key(r);
      const g = map.get(k) ?? { label: k, requests: 0, taken: 0 };
      g.requests += 1;
      if (r.was_full) g.taken += 1;
      map.set(k, g);
    }
    return [...map.values()].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  };
  const monthOrder = [...new Set([...parties.map((p) => p.date), ...reqs.map((r) => r.event_date)].sort().map((d) => monthTitle(d.slice(0, 7))))];

  return {
    from,
    to,
    parties,
    totals: {
      parties: parties.length,
      guests: sum((p) => p.guests),
      revenueCents: sum((p) => p.totalCents ?? 0),
      withoutTotal: parties.filter((p) => p.totalCents === null).length,
      depositsCents: sum((p) => p.depositCents),
      finalPaymentsCents: sum((p) => p.finalPaidCents),
      finalPaidCount: parties.filter((p) => p.finalPaid).length,
      dueCents: sum((p) => p.dueCents),
      cancelled: all.filter((b) => b.status === "cancelled").length,
      holds: all.filter((b) => b.status === "hold").length,
    },
    byMonth: group(parties, (p) => monthTitle(p.date.slice(0, 7))),
    byVenue: group(parties, (p) => p.venue).sort((a, b) => b.parties - a.parties),
    byStyle: group(parties, (p) => STYLE_LABELS[p.style]).sort((a, b) => b.parties - a.parties),
    byOccasion: group(parties, (p) => p.occasion).sort((a, b) => b.parties - a.parties),
    demand: {
      requests: reqs.length,
      takenRequests: taken.length,
      takenDates: new Set(taken.map((r) => `${r.event_date}|${r.slot_id}`)).size,
      guests: taken.reduce((t, r) => t + (r.guests ?? 0), 0),
      bookedLater: reqs.filter((r) => r.status === "booked").length,
      byMonth: demandBy((r) => monthTitle(r.event_date.slice(0, 7)), monthOrder),
      bySlot: demandBy((r) => slotLabel(r.slot_id), setup.slots.map((s) => s.label)),
    },
  };
}
