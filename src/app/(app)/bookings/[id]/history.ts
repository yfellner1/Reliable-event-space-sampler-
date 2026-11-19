// Turns audit log rows into plain sentences for the booking's history panel.

const FIELD_LABELS: Record<string, string> = {
  venue_id: "venue",
  slot_id: "time of day",
  event_date: "date",
  start_minute: "start time",
  duration_minutes: "length",
  status: "status",
  hold_expires_at: "hold time",
  client_first_name: "first name",
  client_last_name: "last name",
  client_phone: "phone",
  client_email: "email",
  other_venue_name: "location name",
  venue_address: "address",
  venue_fee_cents: "location fee",
  party_style: "style",
  guests_men: "guests",
  guests_women: "guests",
  guests_children: "guests",
  notes: "notes",
  deposit_paid: "deposit",
  deposit_method: "deposit",
  deposit_amount_cents: "deposit",
  deposit_received_on: "deposit",
  contract_sent_on: "contract sent",
  contract_signed_on: "contract signed",
  contract_file_path: "contract file",
  final_confirmed: "party finalized",
  final_paid: "final payment",
  final_paid_on: "final payment",
  final_paid_method: "final payment",
  final_paid_amount_cents: "final payment",
  cancel_reason: "cancel reason",
  menu_notes: "menu",
  menu_updated_at: "menu",
};

const STATUS_WORDS: Record<string, string> = {
  hold: "put on hold",
  booked: "booked",
  cancelled: "cancelled",
  expired: "hold expired",
};

type Json = Record<string, unknown> | null;

export function describeChange(action: string, oldData: Json, newData: Json): string {
  if (action === "insert") {
    return newData?.status === "booked" ? "Created the booking" : "Placed a hold";
  }
  if (action === "delete") return "Deleted the booking";
  if (!oldData || !newData) return "Changed the booking";
  if (
    JSON.stringify(oldData.whatsapp_posted_at) !== JSON.stringify(newData.whatsapp_posted_at) &&
    Object.keys(FIELD_LABELS).every((k) => JSON.stringify(oldData[k]) === JSON.stringify(newData[k]))
  ) {
    return "Posted to the WhatsApp group";
  }

  const changed = new Set<string>();
  for (const key of Object.keys(FIELD_LABELS)) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) changed.add(key);
  }
  const parts: string[] = [];
  if (changed.has("status")) {
    parts.push(STATUS_WORDS[String(newData.status)] ?? "changed the status");
    changed.delete("status");
    changed.delete("hold_expires_at");
  }
  if (changed.has("hold_expires_at") && newData.status === "hold") {
    parts.push("extended the hold");
    changed.delete("hold_expires_at");
  }
  const labels = [...new Set([...changed].map((k) => FIELD_LABELS[k]))];
  if (labels.length) parts.push(`changed ${labels.join(", ")}`);
  if (!parts.length) return "Saved with no changes";
  const s = parts.join("; ");
  return s[0].toUpperCase() + s.slice(1);
}
