"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { loadSetup } from "@/lib/booking-data";
import { isISODate } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { freeEventSpaces, isFull } from "@/lib/waitlist-data";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Adds someone who wants a date, noting whether it was already taken. */
export async function addRequest(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin", "editor");
  const setup = await loadSetup(me);
  const date = str(fd, "date");
  const slotId = str(fd, "slot");
  const venueId = str(fd, "venue") || null;
  const name = str(fd, "name");
  const phone = str(fd, "phone");
  const email = str(fd, "email");
  const guestsRaw = str(fd, "guests");
  const style = str(fd, "style");
  if (!isISODate(date)) return { error: "Pick the date they wanted." };
  if (!setup.slots.some((s) => s.id === slotId)) return { error: "Choose the time of day." };
  if (venueId && !setup.venues.some((v) => v.id === venueId)) return { error: "Choose a venue." };
  if (!name) return { error: "Enter their name." };
  if (!phone) return { error: "Enter their phone number." };
  if (email && !EMAIL.test(email)) return { error: "That email address doesn’t look right." };
  const guests = guestsRaw ? Number(guestsRaw) : null;
  if (guests !== null && (!Number.isInteger(guests) || guests < 0 || guests > 5000)) {
    return { error: "Enter the guest count as a number." };
  }
  const partyStyle = z.enum(["plated", "family", "buffet", "bris"]).safeParse(style);

  const supabase = await createClient();
  const avail = await freeEventSpaces(supabase, setup, date, slotId);
  const wasFull = isFull(venueId, avail);
  const { error } = await supabase.from("date_requests").insert({
    org_id: me.orgId,
    event_date: date,
    slot_id: slotId,
    venue_id: venueId,
    client_name: name,
    client_phone: phone,
    client_email: email || null,
    guests,
    party_style: partyStyle.success ? partyStyle.data : null,
    notes: str(fd, "notes") || null,
    was_full: wasFull,
  });
  if (error) return { error: "Couldn’t save. Please try again." };
  revalidatePath("/waitlist");
  revalidatePath("/attention");
  return {
    ok: wasFull
      ? "Added to the waitlist. You’ll see it in Needs attention if the date opens up."
      : "Added. That time is still open, so you can book it now.",
    stamp: Date.now(),
  };
}

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["waiting", "contacted", "booked", "not_interested"]),
});

export async function setRequestStatus(id: string, status: string): Promise<{ ok: boolean }> {
  await requireRole("admin", "editor");
  const parsed = statusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("date_requests")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  revalidatePath("/waitlist");
  revalidatePath("/attention");
  return { ok: !error };
}

export async function deleteRequest(id: string): Promise<{ ok: boolean }> {
  await requireRole("admin", "editor");
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("date_requests").delete().eq("id", id);
  revalidatePath("/waitlist");
  revalidatePath("/attention");
  return { ok: !error };
}
