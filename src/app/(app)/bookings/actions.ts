"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { loadMenus, loadSetup } from "@/lib/booking-data";
import { hasDishes, menuFor, menuProblems } from "@/lib/menu";
import { isISODate, shortDate, todayIn } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { ALL_OCCASIONS, bookingProblems, feeTypedIn, type BookingDraft, type PartyOccasion } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type BookingUpdate = Database["public"]["Tables"]["bookings"]["Update"];

const isoOrEmpty = z.string().refine((s) => s === "" || isISODate(s), "Invalid date");
const text = (max: number) => z.string().max(max);

const draftSchema = z.object({
  id: z.uuid().optional(),
  venueId: z.uuid(),
  slotId: z.uuid(),
  date: z.string().refine(isISODate, "Pick a date."),
  startMinute: z.number().int().min(0).max(1439),
  durationMinutes: z.number().int().min(30).max(720),
  style: z.enum(["plated", "family", "buffet", "bris"]),
  occasion: z.enum(["", ...ALL_OCCASIONS] as ["", ...PartyOccasion[]]),
  occasionOther: text(100),
  headTable: z.boolean(),
  mechitza: z.boolean(),
  firstName: text(100),
  lastName: text(100),
  phone: text(40),
  email: text(200),
  otherVenueName: text(200),
  venueAddress: text(300),
  venueFeeCents: z.number().int().min(0).max(10_000_000).nullable(),
  waiters: z.number().int().min(0).max(50).default(0),
  men: z.number().int().min(0).max(5000),
  women: z.number().int().min(0).max(5000),
  children: z.number().int().min(0).max(5000),
  notes: text(5000),
  depositPaid: z.boolean(),
  depositMethod: z.enum(["", "cash", "check", "zelle", "credit_card"]),
  depositAmountCents: z.number().int().min(0).max(10_000_000).nullable(),
  depositReceivedOn: isoOrEmpty,
  contractSentOn: isoOrEmpty,
  contractSignedOn: isoOrEmpty,
  finalConfirmed: z.boolean(),
  menu: z
    .object({
      choices: z
        .array(
          z.object({
            itemId: z.uuid(),
            quantity: z.number().int().min(0).max(999),
            choices: z.array(z.string().max(100)).max(10),
          }),
        )
        .max(200),
      notes: z.string().max(5000),
    })
    .default({ choices: [], notes: "" }),
});

export type FreeVenue = { id: string; name: string; feeCents: number };

export type SaveState = {
  errors?: string[];
  conflict?: { message: string; freeVenues: FreeVenue[] };
  stamp?: number;
};

const SCHEDULE_HINTS: Record<string, string> = {
  slot_weekday: "That time of day isn't booked on that day of the week.",
  slot_season: "That day is only booked in the winter.",
  venue_slot: "That venue doesn't take parties at that time of day.",
  slot_style: "That party style isn't offered at that time of day.",
  slot_start: "Pick a start time inside the slot's window.",
  slot_length: "The party is too long.",
  slot_end: "The party would end too late.",
  slot_guests: "Too many guests for that time of day.",
  closed_day: "We are closed for the holiday that day.",
};

/** Exclusive venues that are free on that date and slot. */
async function freeVenues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  setup: Awaited<ReturnType<typeof loadSetup>>,
  date: string,
  slotId: string,
  excludeId?: string,
): Promise<{ taken: { venueId: string; status: "hold" | "booked" }[]; free: FreeVenue[] }> {
  const { data } = await supabase
    .from("bookings")
    .select("id, venue_id, status, hold_expires_at")
    .eq("event_date", date)
    .eq("slot_id", slotId)
    .eq("blocks_slot", true)
    .in("status", ["hold", "booked"]);
  const taken = (data ?? [])
    .filter((b) => b.id !== excludeId)
    .map((b) => ({ venueId: b.venue_id, status: b.status as "hold" | "booked" }));
  const slot = setup.slots.find((s) => s.id === slotId);
  const free = setup.venues
    .filter((v) => v.exclusive && (!v.slotKeys || (slot && v.slotKeys.includes(slot.key))))
    .filter((v) => v.kind !== "catering")
    .filter((v) => !taken.some((t) => t.venueId === v.id))
    .map((v) => ({ id: v.id, name: v.name, feeCents: v.extraFeeCents }));
  return { taken, free };
}

/** Which venues are already held or booked for a date and slot. */
export async function checkAvailability(date: string, slotId: string, excludeId?: string) {
  const me = await requireRole("admin", "editor");
  if (!isISODate(date) || !z.uuid().safeParse(slotId).success) return { taken: [], free: [] };
  const setup = await loadSetup(me);
  const supabase = await createClient();
  return freeVenues(supabase, setup, date, slotId, excludeId);
}

export async function saveBooking(_prev: SaveState, fd: FormData): Promise<SaveState> {
  const me = await requireRole("admin", "editor");
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("payload") ?? ""));
  } catch {
    return { errors: ["Something went wrong reading the form. Please try again."] };
  }
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: ["Some fields aren't filled in correctly. Check the form and try again."] };
  }
  const d = parsed.data as BookingDraft & { id?: string };
  const menuInput = parsed.data.menu;

  const setup = await loadSetup(me);
  const supabase = await createClient();
  const slot = setup.slots.find((s) => s.id === d.slotId);
  const venue = setup.venues.find((v) => v.id === d.venueId);

  let existing: Database["public"]["Tables"]["bookings"]["Row"] | null = null;
  if (d.id) {
    const { data } = await supabase.from("bookings").select("*").eq("id", d.id).maybeSingle();
    if (!data) return { errors: ["This booking no longer exists."] };
    if (data.status === "cancelled") return { errors: ["This booking is cancelled. Restore it before changing it."] };
    if (data.final_confirmed) {
      return { errors: ["This party is finalized. Untick Party finalized to make changes."] };
    }
    existing = data;
  }

  const timingChanged =
    !existing ||
    existing.venue_id !== d.venueId ||
    existing.slot_id !== d.slotId ||
    existing.event_date !== d.date ||
    existing.start_minute !== d.startMinute ||
    existing.duration_minutes !== d.durationMinutes ||
    existing.party_style !== d.style;

  const problems = bookingProblems(d, {
    slot,
    venue,
    today: todayIn(setup.org.timeZone),
    timeZone: setup.org.timeZone,
    checkSchedule: timingChanged,
  });
  const menus = await loadMenus();
  const menu = menuFor(menus, d.style, d.occasion);
  const menuIds = new Set(menu?.sections.flatMap((s) => s.items.filter((i) => !i.included).map((i) => i.id)) ?? []);
  const menuChoices = menuInput.choices
    .filter((c) => menuIds.has(c.itemId))
    .map((c) => ({ ...c, choices: c.choices.map((x) => x.trim()).filter(Boolean) }));
  if (menu) problems.push(...menuProblems(menu, menuChoices, d.finalConfirmed && hasDishes(menu)));
  if (d.finalConfirmed && !hasDishes(menu) && !menuInput.notes.trim()) {
    problems.push("Enter the menu before marking the party finalized.");
  }
  if (problems.length) return { errors: problems, stamp: Date.now() };

  // Hold or booked: a paid deposit makes it a booking. Otherwise it is a hold;
  // a hold that is still running keeps its end time, anything else starts fresh.
  const holdUntil = new Date(Date.now() + setup.org.holdHours * 3600_000).toISOString();
  let status: "hold" | "booked" = d.depositPaid ? "booked" : "hold";
  let holdExpiresAt: string | null = null;
  if (status === "hold") {
    const running =
      existing?.status === "hold" && existing.hold_expires_at && Date.parse(existing.hold_expires_at) > Date.now();
    holdExpiresAt = running ? existing!.hold_expires_at : holdUntil;
  }
  if (existing?.status === "booked" && d.depositPaid) status = "booked";

  const isOther = venue!.kind === "other";
  const typedFee = feeTypedIn(venue!.kind);
  const row: BookingUpdate = {
    venue_id: d.venueId,
    slot_id: d.slotId,
    event_date: d.date,
    start_minute: d.startMinute,
    duration_minutes: d.durationMinutes,
    party_style: d.style,
    occasion: d.occasion || null,
    occasion_other: d.occasion === "other" ? d.occasionOther.trim() || null : null,
    head_table: d.headTable,
    mechitza: d.mechitza,
    status,
    hold_expires_at: holdExpiresAt,
    client_first_name: d.firstName.trim(),
    client_last_name: d.lastName.trim(),
    client_phone: d.phone.trim(),
    client_email: d.email.trim() || null,
    other_venue_name: isOther ? d.otherVenueName.trim() : venue!.kind === "catering" ? d.otherVenueName.trim() || null : null,
    venue_address: venue!.kind === "event_space" ? null : d.venueAddress.trim() || null,
    venue_fee_cents: typedFee ? d.venueFeeCents : null,
    waiters: d.waiters,
    guests_men: d.men,
    guests_women: d.women,
    guests_children: d.children,
    notes: d.notes.trim() || null,
    deposit_paid: d.depositPaid,
    deposit_method: d.depositPaid ? d.depositMethod || null : null,
    deposit_amount_cents: d.depositPaid ? d.depositAmountCents : null,
    deposit_received_on: d.depositPaid ? d.depositReceivedOn || null : null,
    contract_sent_on: d.contractSentOn || null,
    contract_signed_on: d.contractSignedOn || null,
    final_confirmed: d.finalConfirmed,
  };

  const result = existing
    ? await supabase.from("bookings").update(row).eq("id", existing.id).select("id").single()
    : await supabase
        .from("bookings")
        .insert({ ...(row as Database["public"]["Tables"]["bookings"]["Insert"]), org_id: me.orgId })
        .select("id")
        .single();

  if (result.error) {
    if (result.error.code === "23505") {
      const { free } = await freeVenues(supabase, setup, d.date, d.slotId, existing?.id);
      return {
        conflict: {
          message: `${venue!.name} is already taken for ${shortDate(d.date)} ${slot!.label.toLowerCase()}.`,
          freeVenues: free,
        },
        stamp: Date.now(),
      };
    }
    const hint = result.error.hint && SCHEDULE_HINTS[result.error.hint];
    if (hint) return { errors: [hint], stamp: Date.now() };
    if (result.error.code === "23514") return { errors: [result.error.message], stamp: Date.now() };
    console.error("saveBooking failed", result.error);
    return { errors: ["Couldn't save the booking. Please try again."], stamp: Date.now() };
  }

  // Save the menu (and its notes) only when it changed, so an unchanged menu
  // doesn't add a line to the booking's history on every save.
  const { data: savedMenu } = await supabase
    .from("booking_menu_items")
    .select("item_id, quantity, choices")
    .eq("booking_id", result.data.id);
  const key = (rows: { item_id?: string; itemId?: string; quantity: number; choices: string[] }[]) =>
    JSON.stringify(
      rows
        .map((r) => [r.item_id ?? r.itemId, r.quantity, r.choices])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  const notesBefore = existing?.menu_notes ?? "";
  if (key(savedMenu ?? []) !== key(menuChoices) || notesBefore.trim() !== menuInput.notes.trim()) {
    const { error: menuError } = await supabase.rpc("set_booking_menu", {
      p_booking_id: result.data.id,
      p_items: menuChoices.map((c) => ({ item_id: c.itemId, quantity: c.quantity, choices: c.choices })),
      p_notes: menuInput.notes,
    });
    if (menuError) {
      console.error("set_booking_menu failed", menuError);
      revalidatePath("/");
      return {
        errors: ["The booking was saved, but the menu wasn't. Open the booking and save the menu again."],
        stamp: Date.now(),
      };
    }
  }

  revalidatePath("/");
  revalidatePath(`/bookings/${result.data.id}`);
  redirect(`/?d=${d.date}&saved=1`);
}

const idSchema = z.uuid();

async function loadBooking(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  return { supabase, booking: data };
}

export async function cancelBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin", "editor");
  const id = idSchema.safeParse(fd.get("id"));
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
  if (!id.success) return { error: "Unknown booking." };
  const { supabase, booking } = await loadBooking(id.data);
  if (!booking) return { error: "Unknown booking." };
  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancel_reason: reason || null })
    .eq("id", booking.id);
  if (error) return { error: "Couldn't cancel the booking. Please try again." };
  revalidatePath("/");
  revalidatePath(`/bookings/${booking.id}`);
  redirect(`/?d=${booking.event_date}&saved=cancelled`);
}

export async function restoreBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin", "editor");
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return { error: "Unknown booking." };
  const { supabase, booking } = await loadBooking(id.data);
  if (!booking || booking.status !== "cancelled") return { error: "Only cancelled bookings can be restored." };
  const { org } = await loadSetup(me);
  const { error } = await supabase
    .from("bookings")
    .update(
      booking.deposit_paid
        ? { status: "booked" }
        : { status: "hold", hold_expires_at: new Date(Date.now() + org.holdHours * 3600_000).toISOString() },
    )
    .eq("id", booking.id);
  if (error?.code === "23505") return { error: "That slot has been taken since this booking was cancelled." };
  if (error?.hint && SCHEDULE_HINTS[error.hint]) {
    return { error: `Can't restore it: ${SCHEDULE_HINTS[error.hint]}` };
  }
  if (error) return { error: "Couldn't restore the booking. Please try again." };
  revalidatePath("/");
  revalidatePath(`/bookings/${booking.id}`);
  return { ok: booking.deposit_paid ? "Booking restored." : "Restored as a hold (needs deposit).", stamp: Date.now() };
}

export async function deleteBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return { error: "Unknown booking." };
  const { supabase, booking } = await loadBooking(id.data);
  if (!booking) return { error: "Unknown booking." };
  const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
  if (error) return { error: "Couldn't delete the booking. Please try again." };
  revalidatePath("/");
  redirect(`/?d=${booking.event_date}&saved=cancelled`);
}

/** Untick "Party finalized" so the booking can be edited again. */
export async function unfinalizeBooking(id: string): Promise<{ ok: boolean }> {
  await requireRole("admin", "editor");
  if (!idSchema.safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").update({ final_confirmed: false }).eq("id", id);
  revalidatePath("/");
  revalidatePath("/attention");
  revalidatePath(`/bookings/${id}`);
  return { ok: !error };
}
