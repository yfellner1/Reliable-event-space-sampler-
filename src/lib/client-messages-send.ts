import "server-only";
import { menusFor, setupFor, type DB, type Setup } from "@/lib/booking-data";
import { clientLinkPath, newClientToken } from "@/lib/client-link";
import { fillTemplate, clientChatId, phoneDigits } from "@/lib/client-messages";
import { bookingEstimate } from "@/lib/contract-data";
import { addDays, longDate, todayIn } from "@/lib/dates";
import { money } from "@/lib/format";
import type { MenuDef } from "@/lib/menu";
import { appUrl, periskopeSend } from "@/lib/reminder-send";
import type { Database } from "@/lib/supabase/database.types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];

/** The sending number on the server (digits), or null when WhatsApp isn't set up. */
export function sendingNumber(): string | null {
  const key = process.env.PERISKOPE_API_KEY;
  const phone = process.env.PERISKOPE_PHONE;
  return key && phone ? phoneDigits(phone) : null;
}

type OrgMsgSettings = {
  name: string;
  final_days: number;
  client_before_days: number;
  client_before_text: string;
  client_after_text: string;
};

async function linkFor(db: DB, b: Booking): Promise<string> {
  let token = b.client_token;
  if (!token) {
    token = newClientToken();
    await db
      .from("bookings")
      .update({ client_token: token, client_token_created_at: new Date().toISOString() })
      .eq("id", b.id);
  }
  return `${appUrl()}${clientLinkPath(token)}`;
}

async function balanceFor(db: DB, b: Booking, setup: Setup, menus: MenuDef[]): Promise<number> {
  if (b.final_paid) return 0;
  const { data } = await db
    .from("booking_menu_items")
    .select("item_id, quantity, choices, price_cents, price_unit, extra_unit_price_cents")
    .eq("booking_id", b.id);
  const est = bookingEstimate(
    b,
    setup,
    menus,
    (data ?? []).map((r) => ({
      itemId: r.item_id,
      quantity: r.quantity,
      choices: r.choices,
      priceCents: r.price_cents,
      unit: r.price_unit,
      extraUnitPriceCents: r.extra_unit_price_cents,
    })),
  );
  return est && b.guests_total ? Math.max(0, est.balanceCents) : 0;
}

/** The message text for one booking. */
export async function messageFor(
  db: DB,
  kind: "before" | "after",
  b: Booking,
  org: OrgMsgSettings,
  setup: Setup,
  menus: MenuDef[],
): Promise<string> {
  const balance = kind === "after" ? await balanceFor(db, b, setup, menus) : 0;
  const vars: Record<string, string> = {
    first_name: b.client_first_name.trim() || b.client_last_name.trim(),
    business: org.name,
    date: longDate(b.event_date),
    due_date: longDate(addDays(b.event_date, -org.final_days)),
    link: kind === "before" || org.client_after_text.includes("{link}") ? await linkFor(db, b) : "",
    balance: money(balance),
    balance_line: balance > 0 ? `Your remaining balance is ${money(balance)}.` : "",
  };
  return fillTemplate(kind === "before" ? org.client_before_text : org.client_after_text, vars);
}

export type ClientMessageResult = { bookingId: string; kind: "before" | "after"; status: "sent" | "failed" | "no_phone" };

/**
 * Sends the due client messages for an organization: "before" to booked,
 * not-yet-finalized parties up to N days out (and at least 3 days away), and
 * "after" the day after the party (up to 3 days late if a run was missed).
 * Each booking gets each message once.
 */
export async function sendClientMessages(db: DB, orgId: string): Promise<ClientMessageResult[]> {
  const { data: org } = await db
    .from("organizations")
    .select(
      "name, final_days, client_msgs_enabled, client_msgs_confirmed_number, client_before_enabled, client_before_days, client_before_text, client_after_enabled, client_after_text",
    )
    .eq("id", orgId)
    .single();
  const number = sendingNumber();
  if (!org || !org.client_msgs_enabled || !number || org.client_msgs_confirmed_number !== number) return [];
  const setup = await setupFor(db, orgId);
  const menus = await menusFor(db, orgId);
  const today = todayIn(setup.org.timeZone);
  const results: ClientMessageResult[] = [];

  const run = async (kind: "before" | "after", rows: Booking[]) => {
    const column = kind === "before" ? "client_before_msg_at" : "client_after_msg_at";
    const mark = (at: string | null) => (kind === "before" ? { client_before_msg_at: at } : { client_after_msg_at: at });
    for (const b of rows) {
      const chat = clientChatId(b.client_phone);
      // Claim it first, so two runs can't both send.
      const { data: claimed } = await db
        .from("bookings")
        .update(mark(new Date().toISOString()))
        .eq("id", b.id)
        .is(column, null)
        .select("id");
      if (!claimed?.length) continue;
      if (!chat) {
        results.push({ bookingId: b.id, kind, status: "no_phone" });
        continue;
      }
      const sent = await periskopeSend(chat, await messageFor(db, kind, b, org, setup, menus));
      if (!sent.ok) await db.from("bookings").update(mark(null)).eq("id", b.id); // try again next run
      results.push({ bookingId: b.id, kind, status: sent.ok ? "sent" : "failed" });
    }
  };

  if (org.client_before_enabled) {
    const { data } = await db
      .from("bookings")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "booked")
      .eq("final_confirmed", false)
      .is("client_before_msg_at", null)
      .gte("event_date", addDays(today, 3))
      .lte("event_date", addDays(today, org.client_before_days));
    await run("before", data ?? []);
  }
  if (org.client_after_enabled) {
    const { data } = await db
      .from("bookings")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "booked")
      .is("client_after_msg_at", null)
      .gte("event_date", addDays(today, -3))
      .lte("event_date", addDays(today, -1));
    await run("after", data ?? []);
  }
  return results;
}
