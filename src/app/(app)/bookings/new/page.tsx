import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { loadMenus, loadSetup } from "@/lib/booking-data";
import { isISODate, todayIn } from "@/lib/dates";
import { lengths, slotClosedReason, stylesFor, venueOffersSlot } from "@/lib/schedule";
import { BookingForm } from "../booking-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: PageProps<"/bookings/new">) {
  const me = await requireRole("admin", "editor");
  const [{ org, venues, slots }, menus] = await Promise.all([loadSetup(me), loadMenus()]);
  const params = await searchParams;
  // "Book again" from the Customers page: start with that customer's details.
  let client = { firstName: "", lastName: "", phone: "", email: "" };
  if (typeof params.from === "string" && /^[0-9a-f-]{36}$/i.test(params.from)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bookings")
      .select("client_first_name, client_last_name, client_phone, client_email")
      .eq("id", params.from)
      .maybeSingle();
    if (data) {
      client = {
        firstName: data.client_first_name,
        lastName: data.client_last_name,
        phone: data.client_phone,
        email: data.client_email ?? "",
      };
    }
  }
  // "Book them" from the waitlist: their name and phone.
  if (typeof params.request === "string" && /^[0-9a-f-]{36}$/i.test(params.request)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("date_requests")
      .select("client_name, client_phone, client_email")
      .eq("id", params.request)
      .maybeSingle();
    if (data) {
      const parts = data.client_name.trim().split(/\s+/);
      client = {
        firstName: parts.length > 1 ? parts.slice(0, -1).join(" ") : "",
        lastName: parts[parts.length - 1],
        phone: data.client_phone,
        email: data.client_email ?? "",
      };
    }
  }
  const today = todayIn(org.timeZone);

  const date = isISODate(params.date) ? params.date : today;
  const slot =
    slots.find((s) => s.id === params.slot) ??
    slots.find((s) => !slotClosedReason(s, date, org.timeZone)) ??
    slots[0];
  const venue =
    venues.find((v) => v.id === params.venue && venueOffersSlot(v, slot)) ??
    venues.find((v) => venueOffersSlot(v, slot))!;
  const lens = lengths(slot, slot.startEarliest);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">New booking</h1>
      <BookingForm
        initial={{
          venueId: venue.id,
          slotId: slot.id,
          date,
          startMinute: slot.startEarliest,
          durationMinutes: lens[lens.length - 1],
          style: stylesFor(slot)[0],
          occasion: "",
          occasionOther: "",
          headTable: false,
          mechitza: false,
          ...client,
          otherVenueName: "",
          venueAddress: "",
          venueFeeCents: null,
          waiters: 0,
          men: 0,
          women: 0,
          children: 0,
          notes: "",
          depositPaid: false,
          depositMethod: "",
          depositAmountCents: null,
          depositReceivedOn: "",
          contractSentOn: "",
          contractSignedOn: "",
          finalConfirmed: false,
        }}
        venues={venues}
        slots={slots}
        timeZone={org.timeZone}
        today={today}
        holdHours={org.holdHours}
        depositCents={org.depositCents}
        holidayPricing={org.holidayPricing}
        pricing={org.pricing}
        occasions={org.occasions}
        menus={menus}
        initialMenu={{ choices: [], notes: "" }}
      />
    </div>
  );
}
