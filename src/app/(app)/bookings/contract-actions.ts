"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { loadSetup } from "@/lib/booking-data";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export async function markContractSent(bookingId: string): Promise<{ ok: boolean }> {
  const me = await requireRole("admin", "editor");
  if (!z.uuid().safeParse(bookingId).success) return { ok: false };
  const { org } = await loadSetup(me);
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ contract_sent_on: todayIn(org.timeZone) })
    .eq("id", bookingId);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/attention");
  return { ok: !error };
}

/** Where a booking's signed contract files go in storage. */
export async function signedContractFolder(bookingId: string): Promise<string | null> {
  const me = await requireRole("admin", "editor");
  if (!z.uuid().safeParse(bookingId).success) return null;
  return `${me.orgId}/${bookingId}`;
}

/**
 * Called after the browser uploaded the file to storage: checks the file is
 * in this booking's folder, then records it and marks the contract signed.
 */
export async function attachSignedContract(bookingId: string, path: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole("admin", "editor");
  if (!z.uuid().safeParse(bookingId).success) return { ok: false, error: "Unknown booking." };
  const folder = `${me.orgId}/${bookingId}/`;
  const name = path.startsWith(folder) ? path.slice(folder.length) : "";
  if (!name || name.includes("/")) return { ok: false, error: "That file isn't in this booking's folder." };

  const supabase = await createClient();
  const { data: files } = await supabase.storage.from("contracts").list(`${me.orgId}/${bookingId}`, { search: name });
  if (!files?.some((f) => f.name === name)) return { ok: false, error: "The upload didn't finish. Try again." };

  const { data: b } = await supabase.from("bookings").select("contract_signed_on").eq("id", bookingId).maybeSingle();
  if (!b) return { ok: false, error: "Unknown booking." };
  const { org } = await loadSetup(me);
  const { error } = await supabase
    .from("bookings")
    .update({ contract_file_path: path, contract_signed_on: b.contract_signed_on ?? todayIn(org.timeZone) })
    .eq("id", bookingId);
  if (error) return { ok: false, error: "Couldn't save. Please try again." };
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/attention");
  revalidatePath("/");
  return { ok: true };
}
