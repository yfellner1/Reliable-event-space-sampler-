import "server-only";
import { fullName } from "@/lib/format";
import { occasionLabel, setupLabel } from "@/lib/schedule";
import type { Setup } from "@/lib/booking-data";
import type { MenuLine } from "@/lib/menu";
import type { Database } from "@/lib/supabase/database.types";
import { whatsappMessage } from "@/lib/whatsapp";

type Row = Database["public"]["Tables"]["bookings"]["Row"];

/** The WhatsApp post for a saved booking. */
export function messageForBooking(b: Row, setup: Setup, menu: MenuLine[]): string {
  const venue = setup.venues.find((v) => v.id === b.venue_id);
  const slot = setup.slots.find((s) => s.id === b.slot_id);
  return whatsappMessage({
    date: b.event_date,
    slotLabel: slot?.label ?? "",
    startMinute: b.start_minute,
    durationMinutes: b.duration_minutes,
    venueName:
      venue?.kind === "catering"
        ? (b.other_venue_name ?? "")
        : b.other_venue_name
          ? `${b.other_venue_name} (other location)`
          : (venue?.name ?? ""),
    address: b.venue_address,
    clientName: fullName(b.client_first_name, b.client_last_name),
    phone: b.client_phone,
    style: b.party_style,
    occasion: occasionLabel(b.occasion, b.occasion_other),
    setup: setupLabel(b.head_table, b.mechitza),
    waiters: b.waiters,
    men: b.guests_men,
    women: b.guests_women,
    children: b.guests_children,
    menu,
    menuNotes: b.menu_notes,
    status: b.status,
    depositPaid: b.deposit_paid,
    depositCents: b.deposit_amount_cents,
    depositMethod: b.deposit_method,
    contractSentOn: b.contract_sent_on,
    contractSignedOn: b.contract_signed_on,
    finalConfirmed: b.final_confirmed,
    notes: b.notes,
  });
}
