import "server-only";
import { fullName } from "@/lib/format";
import { attentionFor, type DB } from "@/lib/booking-data";
import { addDays } from "@/lib/dates";
import { buildReminder, whatsappChatId, type Reminder, type ReminderParty } from "@/lib/reminder";

export type ChannelResult = {
  channel: "Email" | "WhatsApp";
  status: "sent" | "not_set_up" | "failed";
  detail: string;
};

export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** Which channels have their keys set on the server (never the keys themselves). */
export function channelSetup() {
  return {
    email: Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_EMAIL_FROM),
    whatsapp: Boolean(process.env.PERISKOPE_API_KEY && process.env.PERISKOPE_PHONE),
  };
}

/** Builds the reminder for an organization, and who it goes to. */
export async function prepareReminder(supabase: DB, orgId: string) {
  const [{ today, entries, setup }, { data: org }] = await Promise.all([
    attentionFor(supabase, orgId),
    supabase
      .from("organizations")
      .select("reminder_emails, reminder_whatsapp")
      .eq("id", orgId)
      .single(),
  ]);
  const base = appUrl();
  const venueName = (id: string, other: string | null) => other ?? setup.venues.find((v) => v.id === id)?.name ?? "";
  const slotLabel = (id: string) => setup.slots.find((s) => s.id === id)?.label ?? "";

  const { data: rows } = await supabase
    .from("bookings")
    .select("event_date, slot_id, start_minute, venue_id, other_venue_name, client_first_name, client_last_name, guests_total, status, hold_expires_at")
    .eq("org_id", orgId)
    .in("event_date", [today, addDays(today, 1)])
    .in("status", ["hold", "booked"])
    .order("start_minute");
  const parties: ReminderParty[] = (rows ?? [])
    .map((r) => ({
      date: r.event_date,
      slotLabel: slotLabel(r.slot_id),
      startMinute: r.start_minute,
      venue: venueName(r.venue_id, r.other_venue_name),
      clientName: fullName(r.client_first_name, r.client_last_name),
      guests: r.guests_total ?? 0,
      status: r.status as "hold" | "booked",
    }));

  const reminder = buildReminder({
    orgName: setup.org.name,
    today,
    appUrl: base,
    parties,
    entries: entries.map(({ booking: b, items }) => ({
      date: b.date,
      slotLabel: slotLabel(b.slotId),
      venue: venueName(b.venueId, b.otherVenueName),
      clientName: b.clientName,
      url: `${base}/bookings/${b.id}`,
      items,
    })),
  });
  return {
    today,
    reminder,
    emails: org?.reminder_emails ?? [],
    whatsapp: org?.reminder_whatsapp ?? null,
  };
}

async function sendEmail(to: string[], r: Reminder): Promise<ChannelResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_EMAIL_FROM;
  if (!key || !from) return { channel: "Email", status: "not_set_up", detail: "The email service isn't connected yet." };
  if (!to.length) return { channel: "Email", status: "not_set_up", detail: "No email addresses in the reminder settings." };
  try {
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: r.subject, html: r.html, text: r.text }),
    });
    if (res.ok) return { channel: "Email", status: "sent", detail: `Sent to ${to.join(", ")}.` };
    const body = await res.text();
    console.error("reminder email failed", res.status, body);
    return { channel: "Email", status: "failed", detail: `The email service refused it (${res.status}).` };
  } catch (e) {
    console.error("reminder email failed", e);
    return { channel: "Email", status: "failed", detail: "Couldn't reach the email service." };
  }
}


/** Sends one WhatsApp message through Periskope. */
export async function periskopeSend(chatId: string, message: string): Promise<{ ok: boolean; status?: number }> {
  const key = process.env.PERISKOPE_API_KEY;
  const phone = process.env.PERISKOPE_PHONE;
  if (!key || !phone) return { ok: false };
  try {
    const res = await fetch(process.env.PERISKOPE_API_URL || "https://api.periskope.app/v1/message/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "x-phone": phone, "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message }),
    });
    if (!res.ok) console.error("whatsapp send failed", res.status, await res.text());
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error("whatsapp send failed", e);
    return { ok: false };
  }
}

async function sendWhatsApp(target: string | null, r: Reminder): Promise<ChannelResult> {
  const key = process.env.PERISKOPE_API_KEY;
  const phone = process.env.PERISKOPE_PHONE;
  if (!key || !phone) return { channel: "WhatsApp", status: "not_set_up", detail: "Periskope isn't connected yet." };
  if (!target?.trim()) {
    return { channel: "WhatsApp", status: "not_set_up", detail: "No WhatsApp number or group in the reminder settings." };
  }
  try {
    const res = await fetch(process.env.PERISKOPE_API_URL || "https://api.periskope.app/v1/message/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "x-phone": phone, "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: whatsappChatId(target), message: r.text }),
    });
    if (res.ok) return { channel: "WhatsApp", status: "sent", detail: `Sent to ${target}.` };
    const body = await res.text();
    console.error("reminder whatsapp failed", res.status, body);
    return { channel: "WhatsApp", status: "failed", detail: `Periskope refused it (${res.status}).` };
  } catch (e) {
    console.error("reminder whatsapp failed", e);
    return { channel: "WhatsApp", status: "failed", detail: "Couldn't reach Periskope." };
  }
}

/** Builds and sends the reminder on every connected channel. */
export async function sendReminder(supabase: DB, orgId: string) {
  const p = await prepareReminder(supabase, orgId);
  const results = await Promise.all([sendEmail(p.emails, p.reminder), sendWhatsApp(p.whatsapp, p.reminder)]);
  return { ...p, results };
}



