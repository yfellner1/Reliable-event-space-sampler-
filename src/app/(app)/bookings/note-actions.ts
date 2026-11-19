"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember, requireRole } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

export async function addNote(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireMember();
  const bookingId = z.uuid().safeParse(fd.get("bookingId"));
  const body = String(fd.get("body") ?? "").trim();
  if (!bookingId.success) return { error: "Unknown party." };
  if (!body) return { error: "Write a note first." };
  if (body.length > 2000) return { error: "Keep the note under 2,000 characters." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("booking_notes")
    .insert({ booking_id: bookingId.data, org_id: me.orgId, body });
  if (error) return { error: "Couldn't send the note. Please try again." };
  revalidatePath(`/bookings/${bookingId.data}`);
  return { ok: "Note sent to the secretary.", stamp: Date.now() };
}

export async function markNoteRead(fd: FormData): Promise<void> {
  await requireRole("admin", "editor");
  const id = z.uuid().safeParse(fd.get("noteId"));
  const bookingId = z.uuid().safeParse(fd.get("bookingId"));
  if (!id.success) return;
  const me = await requireMember();
  const supabase = await createClient();
  await supabase
    .from("booking_notes")
    .update({ read_at: new Date().toISOString(), read_by: me.id })
    .eq("id", id.data);
  if (bookingId.success) revalidatePath(`/bookings/${bookingId.data}`);
}
