import "server-only";
import { randomBytes } from "node:crypto";
import { menusFor, setupFor, type Setup } from "@/lib/booking-data";
import { todayIn } from "@/lib/dates";
import { menuFor, type MenuChoice, type MenuDef } from "@/lib/menu";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Submission = Database["public"]["Tables"]["client_submissions"]["Row"];

const TOKEN = /^[A-Za-z0-9_-]{32}$/;

export function newClientToken(): string {
  return randomBytes(24).toString("base64url");
}

export function clientLinkPath(token: string): string {
  return `/c/${token}`;
}

export function submissionChoices(s: Pick<Submission, "menu_items">): MenuChoice[] {
  const items = Array.isArray(s.menu_items) ? s.menu_items : [];
  return items.flatMap((x) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) return [];
    const o = x as Record<string, unknown>;
    if (typeof o.item_id !== "string") return [];
    return [
      {
        itemId: o.item_id,
        quantity: Number(o.quantity) || 0,
        choices: Array.isArray(o.choices) ? o.choices.map(String) : [],
      },
    ];
  });
}

export type ClientParty = {
  booking: Booking;
  setup: Setup;
  menu: MenuDef | null;
  /** What to show in the form: the latest pending submission, else the booking. */
  current: { men: number; women: number; children: number; choices: MenuChoice[] };
  pending: Submission | null;
  /** Why the client can't send changes now, or null when they can. */
  closed: string | null;
};

/** The party behind a client link, read with the secret key. Null for a bad link. */
export async function loadClientParty(token: string): Promise<ClientParty | null> {
  if (!TOKEN.test(token)) return null;
  const db = createAdminClient();
  const { data: booking } = await db.from("bookings").select("*").eq("client_token", token).maybeSingle();
  if (!booking) return null;
  const setup = await setupFor(db, booking.org_id);
  const menus = await menusFor(db, booking.org_id);
  const menu = menuFor(menus, booking.party_style, booking.occasion) ?? null;
  const [{ data: pending }, { data: saved }] = await Promise.all([
    db
      .from("client_submissions")
      .select("*")
      .eq("booking_id", booking.id)
      .eq("status", "pending")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("booking_menu_items").select("item_id, quantity, choices").eq("booking_id", booking.id),
  ]);
  const today = todayIn(setup.org.timeZone);
  const closed =
    booking.status === "cancelled" || booking.status === "expired"
      ? "This booking isn’t active. Please call us."
      : booking.event_date < today
        ? "This party has already taken place. Thank you!"
        : booking.final_confirmed
          ? "Your party details are final. To change anything, please call us."
          : null;
  return {
    booking,
    setup,
    menu,
    pending: pending ?? null,
    closed,
    current: pending
      ? {
          men: pending.guests_men,
          women: pending.guests_women,
          children: pending.guests_children,
          choices: submissionChoices(pending),
        }
      : {
          men: booking.guests_men,
          women: booking.guests_women,
          children: booking.guests_children,
          choices: (saved ?? []).map((r) => ({ itemId: r.item_id, quantity: r.quantity, choices: r.choices })),
        },
  };
}
