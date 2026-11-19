"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { isISODate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

const date = z.string().refine(isISODate);
const rowSchema = z.object({
  ref: z.string().min(1).max(300),
  venueId: z.uuid(),
  slotId: z.uuid(),
  date,
  startMinute: z.number().int().min(0).max(1439),
  durationMinutes: z.number().int().min(30).max(720),
  venueAddress: z.string().max(500),
  otherVenueName: z.string().max(200),
  firstName: z.string().max(100),
  lastName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(100),
  email: z.string().max(200),
  style: z.enum(["plated", "family", "buffet", "bris"]),
  men: z.number().int().min(0).max(5000),
  women: z.number().int().min(0).max(5000),
  children: z.number().int().min(0).max(5000),
  menuNotes: z.string().max(10000),
  notes: z.string().max(20000),
  deposit: z
    .object({
      method: z.enum(["cash", "check", "zelle", "credit_card"]),
      amountCents: z.number().int().positive(),
      receivedOn: date,
    })
    .nullable(),
});

export type ImportPayload = z.infer<typeof rowSchema>;
export type ImportResult = { ref: string; result: "created" | "exists" | "error"; message?: string };

const CARD = /(?:\d[ -]?){13,19}/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Saves calendar parties. Runs again safely: parties already imported are skipped. */
export async function importBookings(rows: unknown): Promise<{ results: ImportResult[] } | { error: string }> {
  await requireRole("admin");
  const parsed = z.array(rowSchema).max(2000).safeParse(rows);
  if (!parsed.success) return { error: "The import data didn’t look right. Load the file again and retry." };
  const supabase = await createClient();
  const results: ImportResult[] = [];
  for (const r of parsed.data) {
    // Card numbers never belong in a booking, whatever the browser sent.
    if (CARD.test(r.notes.replace(/\(\d{3}\)/g, "")) || CARD.test(r.menuNotes)) {
      results.push({ ref: r.ref, result: "error", message: "Looks like a card number is in the notes; skipped." });
      continue;
    }
    const { data, error } = await supabase.rpc("admin_import_booking", {
      p: {
        import_ref: r.ref,
        venue_id: r.venueId,
        slot_id: r.slotId,
        event_date: r.date,
        start_minute: r.startMinute,
        duration_minutes: r.durationMinutes,
        client_first_name: r.firstName.trim(),
        client_last_name: r.lastName.trim(),
        client_phone: r.phone.trim(),
        client_email: EMAIL.test(r.email.trim()) ? r.email.trim() : "",
        other_venue_name: r.otherVenueName.trim(),
        venue_address: r.venueAddress.trim(),
        party_style: r.style,
        guests_men: r.men,
        guests_women: r.women,
        guests_children: r.children,
        notes: r.notes,
        menu_notes: r.menuNotes,
        deposit_paid: Boolean(r.deposit),
        deposit_method: r.deposit?.method ?? null,
        deposit_amount_cents: r.deposit?.amountCents ?? null,
        deposit_received_on: r.deposit?.receivedOn ?? null,
      },
    });
    if (error) results.push({ ref: r.ref, result: "error", message: error.message });
    else results.push({ ref: r.ref, result: data === "exists" ? "exists" : "created" });
  }
  revalidatePath("/", "layout");
  return { results };
}
