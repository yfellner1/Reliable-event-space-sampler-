// Customers are the people on bookings. Bookings stay the one record; this
// groups them by person (phone number first, then email, then name).

import type { ISODate } from "./dates";

export type CustomerBooking = {
  id: string;
  event_date: ISODate;
  status: string;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  client_email: string | null;
  updated_at: string;
};

export type Customer = {
  key: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  parties: number;
  lastDate: ISODate;
  /** The booking whose details are shown (most recently edited). */
  latestBookingId: string;
  /** Soonest party from today on, if any. */
  nextDate: ISODate | null;
};

export function customerKey(b: Pick<CustomerBooking, "client_phone" | "client_email" | "client_first_name" | "client_last_name">): string {
  const digits = b.client_phone.replace(/\D/g, "");
  if (digits.length >= 7) return `p:${digits.slice(-10)}`;
  if (b.client_email?.trim()) return `e:${b.client_email.trim().toLowerCase()}`;
  return `n:${`${b.client_first_name} ${b.client_last_name}`.trim().toLowerCase()}`;
}

export function groupCustomers(rows: CustomerBooking[], today: ISODate): Customer[] {
  const byKey = new Map<string, CustomerBooking[]>();
  for (const r of rows) {
    const k = customerKey(r);
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const out: Customer[] = [];
  for (const [key, list] of byKey) {
    const latest = [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    const email = latest.client_email?.trim() || list.find((r) => r.client_email?.trim())?.client_email?.trim() || "";
    const firstName = latest.client_first_name.trim() || list.find((r) => r.client_first_name.trim())?.client_first_name.trim() || "";
    const dates = list.map((r) => r.event_date).sort();
    const upcoming = list
      .filter((r) => r.event_date >= today && (r.status === "booked" || r.status === "hold"))
      .map((r) => r.event_date)
      .sort();
    out.push({
      key,
      firstName,
      lastName: latest.client_last_name.trim(),
      phone: latest.client_phone.trim(),
      email,
      parties: list.filter((r) => r.status !== "expired").length,
      lastDate: dates[dates.length - 1],
      latestBookingId: latest.id,
      nextDate: upcoming[0] ?? null,
    });
  }
  return out.sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "en", { sensitivity: "base" }),
  );
}

/** Characters that would break a PostgREST filter are dropped. */
export function cleanQuery(q: string): string {
  return q.replace(/[%*,()\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}
