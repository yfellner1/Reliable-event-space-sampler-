"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadClientParty } from "@/lib/client-link";
import { menuProblems } from "@/lib/menu";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  men: z.number().int().min(0).max(5000),
  women: z.number().int().min(0).max(5000),
  children: z.number().int().min(0).max(5000),
  choices: z
    .array(
      z.object({
        itemId: z.uuid(),
        quantity: z.number().int().min(0).max(999),
        choices: z.array(z.string().max(200)).max(20),
      }),
    )
    .max(200),
  message: z.string().max(4000),
});

/**
 * The client sends their guest count and menu from their private link. Nothing
 * on the booking changes: it waits for the secretary to review and apply it.
 */
export async function submitClientDetails(token: string, payload: unknown): Promise<{ ok: boolean; error?: string }> {
  const party = await loadClientParty(String(token));
  if (!party) return { ok: false, error: "This link isn’t valid. Please ask us for a new one." };
  if (party.closed) return { ok: false, error: party.closed };
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Something didn’t look right. Please check the form and try again." };
  const p = parsed.data;

  // Only dishes from this party's menu, within the menu's limits.
  if (party.menu) {
    const ids = new Set(party.menu.sections.flatMap((s) => s.items.filter((i) => !i.included).map((i) => i.id)));
    if (p.choices.some((c) => !ids.has(c.itemId))) return { ok: false, error: "Please choose dishes from the menu." };
    const problems = menuProblems(party.menu, p.choices, false);
    if (problems.length) return { ok: false, error: problems[0] };
  } else if (p.choices.length) {
    return { ok: false, error: "Please choose dishes from the menu." };
  }

  const db = createAdminClient();
  // A few sends an hour is plenty; this stops a runaway form.
  const { count } = await db
    .from("client_submissions")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", party.booking.id)
    .gte("submitted_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 10) return { ok: false, error: "Too many sends in the last hour. Please try again later." };

  // Only the latest send waits for review.
  await db
    .from("client_submissions")
    .update({ status: "dismissed", handled_at: new Date().toISOString() })
    .eq("booking_id", party.booking.id)
    .eq("status", "pending");
  const { error } = await db.from("client_submissions").insert({
    org_id: party.booking.org_id,
    booking_id: party.booking.id,
    guests_men: p.men,
    guests_women: p.women,
    guests_children: p.children,
    menu_items: p.choices.map((c) => ({ item_id: c.itemId, quantity: c.quantity, choices: c.choices })),
    message: p.message.trim() || null,
  });
  if (error) return { ok: false, error: "Couldn’t send. Please try again." };
  revalidatePath(`/bookings/${party.booking.id}`);
  revalidatePath("/attention");
  return { ok: true };
}
