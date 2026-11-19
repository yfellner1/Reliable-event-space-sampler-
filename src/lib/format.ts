/** Minutes after midnight to "7:00 AM". */
export function clock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Cents to "$500" or "$12.50". */
export function money(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** "Chana Levi", or just "Levi" when the first name is missing (imported bookings). */
export function fullName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
}
