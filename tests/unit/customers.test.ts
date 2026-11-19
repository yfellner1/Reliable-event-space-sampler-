import { describe, expect, it } from "vitest";
import { cleanQuery, customerKey, groupCustomers, type CustomerBooking } from "@/lib/customers";

const b = (over: Partial<CustomerBooking>): CustomerBooking => ({
  id: "1", event_date: "2026-12-01", status: "booked", client_first_name: "Chana", client_last_name: "Levi",
  client_phone: "732-555-0100", client_email: null, updated_at: "2026-11-01T00:00:00Z", ...over,
});

describe("customers", () => {
  it("treats the same phone typed differently as one person", () => {
    expect(customerKey(b({ client_phone: "(732) 555-0100" }))).toBe(customerKey(b({ client_phone: "+1 732 555 0100" })));
  });

  it("merges a person's bookings, keeping the latest details and filling gaps", () => {
    const [c, ...rest] = groupCustomers(
      [
        b({ id: "a", event_date: "2026-10-01", client_email: "chana@example.com", updated_at: "2026-09-01T00:00:00Z" }),
        b({ id: "b", event_date: "2027-01-10", client_first_name: "", client_phone: "7325550100", updated_at: "2026-11-10T00:00:00Z" }),
        b({ id: "c", event_date: "2026-08-01", status: "expired", updated_at: "2026-07-01T00:00:00Z" }),
      ],
      "2026-11-19",
    );
    expect(rest).toEqual([]);
    expect(c).toMatchObject({
      firstName: "Chana", lastName: "Levi", phone: "7325550100", email: "chana@example.com",
      parties: 2, lastDate: "2027-01-10", nextDate: "2027-01-10", latestBookingId: "b",
    });
  });

  it("keeps different people apart and sorts by last name", () => {
    const list = groupCustomers([b({ client_last_name: "Weiss", client_phone: "1" , client_email: "w@x.com" }), b({ client_phone: "718-555-0199", client_last_name: "Adler" })], "2026-11-19");
    expect(list.map((c) => c.lastName)).toEqual(["Adler", "Weiss"]);
  });

  it("drops characters that would break a search filter", () => {
    expect(cleanQuery("levi, (732)*")).toBe("levi 732");
  });
});
