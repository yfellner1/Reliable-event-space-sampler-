import "server-only";
import type { DB, Setup } from "@/lib/booking-data";
import type { ISODate } from "@/lib/dates";
import { venueOffersSlot, type VenueRule } from "@/lib/schedule";
import type { Database } from "@/lib/supabase/database.types";

export type RequestRow = Database["public"]["Tables"]["date_requests"]["Row"];

/** Event spaces still free on a date and time of day. */
export async function freeEventSpaces(
  supabase: DB,
  setup: Setup,
  date: ISODate,
  slotId: string,
): Promise<{ free: VenueRule[]; takenIds: Set<string> }> {
  const { data } = await supabase
    .from("bookings")
    .select("venue_id, status, hold_expires_at")
    .eq("event_date", date)
    .eq("slot_id", slotId)
    .eq("blocks_slot", true)
    .in("status", ["hold", "booked"]);
  const takenIds = new Set(
    (data ?? [])
      .map((b) => b.venue_id),
  );
  const slot = setup.slots.find((s) => s.id === slotId);
  const free = setup.venues.filter(
    (v) => v.exclusive && v.kind === "event_space" && slot && venueOffersSlot(v, slot) && !takenIds.has(v.id),
  );
  return { free, takenIds };
}

/** Whether what they asked for is taken: their venue, or every event space when they'd take any. */
export function isFull(venueId: string | null, avail: { free: VenueRule[]; takenIds: Set<string> }): boolean {
  return venueId ? avail.takenIds.has(venueId) : avail.free.length === 0;
}

export type WaitlistEntry = RequestRow & { openNow: boolean };

/** Requests from a date on, with whether their date has opened up since. */
export async function loadWaitlist(supabase: DB, setup: Setup, from: ISODate): Promise<WaitlistEntry[]> {
  const { data } = await supabase
    .from("date_requests")
    .select("*")
    .gte("event_date", from)
    .order("event_date")
    .order("created_at");
  const rows = data ?? [];
  const cache = new Map<string, Awaited<ReturnType<typeof freeEventSpaces>>>();
  const out: WaitlistEntry[] = [];
  for (const r of rows) {
    let openNow = false;
    if (r.status === "waiting" || r.status === "contacted") {
      const key = `${r.event_date}|${r.slot_id}`;
      if (!cache.has(key)) cache.set(key, await freeEventSpaces(supabase, setup, r.event_date, r.slot_id));
      openNow = !isFull(r.venue_id, cache.get(key)!);
    }
    out.push({ ...r, openNow });
  }
  return out;
}
