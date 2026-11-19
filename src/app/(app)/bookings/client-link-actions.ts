"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { newClientToken, submissionChoices } from "@/lib/client-link";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

/** Makes (or replaces) the booking's private client link. */
export async function createClientLink(bookingId: string): Promise<Result> {
  await requireRole("admin", "editor");
  if (!z.uuid().safeParse(bookingId).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ client_token: newClientToken(), client_token_created_at: new Date().toISOString() })
    .eq("id", bookingId);
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: !error };
}

/** Turns the link off: the old address stops working. */
export async function revokeClientLink(bookingId: string): Promise<Result> {
  await requireRole("admin", "editor");
  if (!z.uuid().safeParse(bookingId).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ client_token: null, client_token_created_at: null })
    .eq("id", bookingId);
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: !error };
}

/** Copies what the client sent onto the booking: guests, menu, and their message in the notes. */
export async function applySubmission(submissionId: string): Promise<Result> {
  const me = await requireRole("admin", "editor");
  if (!z.uuid().safeParse(submissionId).success) return { ok: false };
  const supabase = await createClient();
  const { data: s } = await supabase.from("client_submissions").select("*").eq("id", submissionId).maybeSingle();
  if (!s || s.status !== "pending") return { ok: false, error: "This was already handled." };
  const { data: b } = await supabase
    .from("bookings")
    .select("id, final_confirmed, notes, menu_notes")
    .eq("id", s.booking_id)
    .single();
  if (!b) return { ok: false };
  if (b.final_confirmed) return { ok: false, error: "Untick “Party finalized” first, then apply." };

  const { data: org } = await supabase.from("organizations").select("timezone").eq("id", me.orgId).single();
  const stamp = todayIn(org?.timezone ?? "America/New_York");
  const notes = s.message
    ? [b.notes?.trim(), `From the client (${stamp}): ${s.message.trim()}`].filter(Boolean).join("\n\n")
    : b.notes;
  const { error } = await supabase
    .from("bookings")
    .update({
      guests_men: s.guests_men,
      guests_women: s.guests_women,
      guests_children: s.guests_children,
      notes,
    })
    .eq("id", b.id);
  if (error) return { ok: false, error: "Couldn’t save the guest count. Please try again." };
  const choices = submissionChoices(s);
  if (choices.length) {
    const { error: menuError } = await supabase.rpc("set_booking_menu", {
      p_booking_id: b.id,
      p_items: choices.map((c) => ({ item_id: c.itemId, quantity: c.quantity, choices: c.choices })),
      p_notes: b.menu_notes ?? "",
    });
    if (menuError) return { ok: false, error: "The guest count was saved, but the menu wasn’t. Please try again." };
  }
  await supabase
    .from("client_submissions")
    .update({ status: "applied", handled_by: me.id, handled_at: new Date().toISOString() })
    .eq("id", s.id);
  revalidatePath(`/bookings/${b.id}`);
  revalidatePath("/attention");
  revalidatePath("/");
  return { ok: true };
}

export async function dismissSubmission(submissionId: string): Promise<Result> {
  const me = await requireRole("admin", "editor");
  if (!z.uuid().safeParse(submissionId).success) return { ok: false };
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("client_submissions")
    .update({ status: "dismissed", handled_by: me.id, handled_at: new Date().toISOString() })
    .eq("id", submissionId)
    .eq("status", "pending")
    .select("booking_id")
    .maybeSingle();
  if (s) revalidatePath(`/bookings/${s.booking_id}`);
  revalidatePath("/attention");
  return { ok: Boolean(s) };
}
