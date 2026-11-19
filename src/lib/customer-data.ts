import "server-only";
import type { Member } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { cleanQuery, groupCustomers, type Customer } from "@/lib/customers";

const FIELDS = "id, event_date, status, client_first_name, client_last_name, client_phone, client_email, updated_at";

/** Customers from the organization's bookings, optionally matching a search. */
export async function loadCustomers(member: Member, timeZone: string, query = "", limit = 5000): Promise<Customer[]> {
  const supabase = await createClient();
  let req = supabase.from("bookings").select(FIELDS).eq("org_id", member.orgId);
  const q = cleanQuery(query);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const words = q.split(" ").filter(Boolean);
    const parts = words.flatMap((w) => [`client_first_name.ilike.*${w}*`, `client_last_name.ilike.*${w}*`, `client_email.ilike.*${w}*`]);
    if (digits.length >= 3) parts.push(`client_phone_digits.like.*${digits}*`);
    req = req.or(parts.join(","));
  }
  const { data } = await req.order("event_date", { ascending: false }).limit(limit);
  let customers = groupCustomers(data ?? [], todayIn(timeZone));
  // Several words ("chana levi"): every word must match the person.
  if (q && q.split(" ").length > 1 && !/^\d[\d\s-]*$/.test(q)) {
    const words = q.toLowerCase().split(" ");
    customers = customers.filter((c) => {
      const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  return customers;
}
