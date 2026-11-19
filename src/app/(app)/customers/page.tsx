import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { loadSetup } from "@/lib/booking-data";
import { loadCustomers } from "@/lib/customer-data";
import { shortDate } from "@/lib/dates";
import { fullName } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const me = await requireRole("admin", "editor");
  const { org } = await loadSetup(me);
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const customers = await loadCustomers(me, org.timeZone, q);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Customers</h1>
      <form className="panel flex flex-wrap items-end gap-2" role="search">
        <label className="field min-w-0 flex-1">
          Search by name, phone, or email
          <input className="input" name="q" defaultValue={q} type="search" autoComplete="off" />
        </label>
        <button className="btn btn-primary" type="submit">
          Search
        </button>
        {q ? (
          <Link className="btn" href="/customers">
            Show all
          </Link>
        ) : null}
      </form>
      <p className="m-0 text-sm text-muted">
        {customers.length} {customers.length === 1 ? "customer" : "customers"}
        {q ? ` matching “${q}”` : ""}. Saved automatically from every booking.
      </p>
      <ul className="m-0 grid list-none gap-2 p-0" aria-label="Customer list">
        {customers.map((c) => (
          <li key={c.key} className="panel grid gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-lg font-bold">{fullName(c.firstName, c.lastName)}</span>
              <span className="text-sm text-muted">
                {c.parties} {c.parties === 1 ? "party" : "parties"} · last {shortDate(c.lastDate)}
                {c.nextDate ? ` · next ${shortDate(c.nextDate)}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a>
              {c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null}
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <Link className="btn btn-primary" href={`/bookings/new?from=${c.latestBookingId}`}>
                Book again
              </Link>
              <Link className="btn" href={`/bookings/${c.latestBookingId}`}>
                Latest booking
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
