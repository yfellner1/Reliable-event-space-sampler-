"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { isISODate } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  id: z.uuid(),
  paid: z.boolean(),
  on: z.string(),
  method: z.enum(["cash", "check", "zelle", "credit_card", ""]),
  amount: z.string(),
});

/** Records (or clears) the final payment for a booking. */
export async function saveFinalPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin", "editor");
  const parsed = schema.safeParse({
    id: fd.get("id"),
    paid: fd.get("paid") === "on",
    on: String(fd.get("on") ?? ""),
    method: String(fd.get("method") ?? ""),
    amount: String(fd.get("amount") ?? "").replace(/[$,\s]/g, ""),
  });
  if (!parsed.success) return { error: "Something went wrong. Please try again." };
  const p = parsed.data;
  let amountCents: number | null = null;
  if (p.paid) {
    if (!isISODate(p.on)) return { error: "Enter the date the payment came in." };
    if (!p.method) return { error: "Choose how it was paid." };
    if (p.amount) {
      const n = Number(p.amount);
      if (!Number.isFinite(n) || n <= 0) return { error: "The amount doesn’t look right." };
      amountCents = Math.round(n * 100);
    }
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update(
      p.paid
        ? { final_paid: true, final_paid_on: p.on, final_paid_method: p.method || null, final_paid_amount_cents: amountCents }
        : { final_paid: false, final_paid_on: null, final_paid_method: null, final_paid_amount_cents: null },
    )
    .eq("id", p.id);
  if (error) return { error: "Couldn’t save. Please try again." };
  revalidatePath(`/bookings/${p.id}`);
  revalidatePath("/attention");
  return { ok: p.paid ? "Final payment saved." : "Final payment cleared.", stamp: Date.now() };
}
