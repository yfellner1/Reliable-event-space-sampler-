"use server";

import { requireRole } from "@/lib/auth";
import { loadSetup } from "@/lib/booking-data";
import { loadCustomers } from "@/lib/customer-data";
import type { Customer } from "@/lib/customers";

/** Past customers matching what was typed, for the booking form. */
export async function findCustomers(query: string): Promise<Customer[]> {
  const me = await requireRole("admin", "editor");
  if (typeof query !== "string" || query.trim().length < 2) return [];
  const { org } = await loadSetup(me);
  return (await loadCustomers(me, org.timeZone, query, 200)).slice(0, 8);
}
