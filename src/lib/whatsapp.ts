// The post for the business's WhatsApp group, built from the booking so the
// group chat always matches the app. WhatsApp shows *text* in bold.

import { longDate, type ISODate } from "./dates";
import { clock, money } from "./format";
import type { MenuLine } from "./menu";
import { PAYMENT_LABELS, STYLE_LABELS, type PartyStyle, type PaymentMethod } from "./schedule";

export type WhatsAppInput = {
  date: ISODate;
  slotLabel: string;
  startMinute: number;
  durationMinutes: number;
  venueName: string;
  address: string | null;
  clientName: string;
  phone: string;
  style: PartyStyle;
  /** Type of party ("Sheva Brachos"), optional. */
  occasion?: string;
  /** "Head table, Mechitza", optional. */
  setup?: string;
  /** Waiters sent with the food, optional. */
  waiters?: number;
  men: number;
  women: number;
  children: number;
  menu: MenuLine[];
  menuNotes: string | null;
  status: "hold" | "booked" | "expired" | "cancelled";
  depositPaid: boolean;
  depositCents: number | null;
  depositMethod: PaymentMethod | null;
  contractSentOn: ISODate | null;
  contractSignedOn: ISODate | null;
  finalConfirmed: boolean;
  notes: string | null;
};

function statusText(m: WhatsAppInput): string {
  if (m.status === "cancelled") return "CANCELLED";
  if (m.status === "hold" || m.status === "expired") return "Needs deposit (not confirmed)";
  if (m.finalConfirmed) return "Party finalized";
  return "Booked";
}

export function whatsappMessage(m: WhatsAppInput): string {
  const total = m.men + m.women + m.children;
  const lines: string[] = [];
  lines.push(m.status === "cancelled" ? `*CANCELLED: Party ${longDate(m.date)}*` : `*Party: ${longDate(m.date)}*`);
  if (m.venueName) lines.push(`Venue: ${m.venueName}`);
  if (m.address) lines.push(`Address: ${m.address}`);
  lines.push(
    `Time: ${clock(m.startMinute)} to ${clock(m.startMinute + m.durationMinutes)} (${m.slotLabel})`,
  );
  lines.push(`Client: ${m.clientName}, ${m.phone}`);
  if (m.occasion) lines.push(`Party: ${m.occasion}`);
  lines.push(`Style: ${STYLE_LABELS[m.style]}`);
  lines.push(
    `Guests: ${
      total ? `${total} total (Men ${m.men}, Women ${m.women}, Children ${m.children})` : "not confirmed yet"
    }`,
  );
  if (m.setup) lines.push(`Setup: ${m.setup}`);
  if (m.waiters) lines.push(`Waiters: ${m.waiters}`);
  if (m.menu.length) {
    lines.push("Menu:");
    for (const l of m.menu) lines.push(`• ${l.section}: ${l.items.join(", ")}`);
    if (m.menuNotes?.trim()) lines.push(`Menu notes: ${m.menuNotes.trim()}`);
  } else {
    lines.push(`Menu: ${m.menuNotes?.trim() || "not confirmed yet"}`);
  }
  lines.push(
    `Deposit: ${
      m.depositPaid
        ? `${m.depositCents ? money(m.depositCents) : ""} received${
            m.depositMethod ? ` (${PAYMENT_LABELS[m.depositMethod].toLowerCase()})` : ""
          }`.trim()
        : "not received"
    }`,
  );
  lines.push(
    `Contract: ${m.contractSignedOn ? "signed" : m.contractSentOn ? "sent, not signed yet" : "not sent yet"}`,
  );
  lines.push(`Status: ${statusText(m)}`);
  if (m.notes?.trim()) lines.push(`Notes: ${m.notes.trim()}`);
  return lines.join("\n");
}

/** A link that opens WhatsApp with the message filled in, to pick the group. */
export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
