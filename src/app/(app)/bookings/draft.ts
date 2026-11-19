import type { Database } from "@/lib/supabase/database.types";
import type { BookingDraft, PaymentMethod } from "@/lib/schedule";

type Row = Database["public"]["Tables"]["bookings"]["Row"];

export function draftFromRow(b: Row): BookingDraft {
  return {
    venueId: b.venue_id,
    slotId: b.slot_id,
    date: b.event_date,
    startMinute: b.start_minute,
    durationMinutes: b.duration_minutes,
    style: b.party_style,
    occasion: b.occasion ?? "",
    occasionOther: b.occasion_other ?? "",
    headTable: b.head_table,
    mechitza: b.mechitza,
    firstName: b.client_first_name,
    lastName: b.client_last_name,
    phone: b.client_phone,
    email: b.client_email ?? "",
    otherVenueName: b.other_venue_name ?? "",
    venueAddress: b.venue_address ?? "",
    venueFeeCents: b.venue_fee_cents,
    waiters: b.waiters,
    men: b.guests_men,
    women: b.guests_women,
    children: b.guests_children,
    notes: b.notes ?? "",
    depositPaid: b.deposit_paid,
    depositMethod: (b.deposit_method ?? "") as PaymentMethod | "",
    depositAmountCents: b.deposit_amount_cents,
    depositReceivedOn: b.deposit_received_on ?? "",
    contractSentOn: b.contract_sent_on ?? "",
    contractSignedOn: b.contract_signed_on ?? "",
    finalConfirmed: b.final_confirmed,
  };
}
