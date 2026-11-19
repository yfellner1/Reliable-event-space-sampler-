// The "Needs attention" list: upcoming parties that need the secretary to do
// something, and what. Pure logic, so it can be tested and reused for the
// daily reminder.

import { daysBetween, type ISODate } from "./dates";

export type AttentionBooking = {
  id: string;
  date: ISODate;
  status: "hold" | "booked" | "expired" | "cancelled";
  holdExpiresAt: string | null;
  depositPaid: boolean;
  depositReceivedOn: ISODate | null;
  contractSentOn: ISODate | null;
  contractSignedOn: ISODate | null;
  finalConfirmed: boolean;
  guests: number;
  /** True when the menu is complete enough to mark the party finalized. */
  menuReady: boolean;
  unreadNotes: number;
  /** Final payment recorded (after the party). */
  finalPaid?: boolean;
  /** The client sent details from their link that wait for review. */
  clientUpdate?: boolean;
};

export type AttentionLevel = "urgent" | "todo" | "ready";

export type AttentionItem = { level: AttentionLevel; text: string; kind: string };

export type AttentionRules = {
  /** Days before the party when the guest count and menu are due. */
  finalDays: number;
  /** Days after the deposit when an unsigned contract becomes urgent. */
  contractDays: number;
};

export const DEFAULT_RULES: AttentionRules = { finalDays: 7, contractDays: 7 };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function attentionFor(
  b: AttentionBooking,
  today: ISODate,
  now: number,
  rules: AttentionRules = DEFAULT_RULES,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  if (b.status === "cancelled") return out;
  const daysOut = daysBetween(today, b.date);
  if (daysOut < 0) {
    // After the party, only the final payment is left to follow up.
    if (b.status === "booked" && b.finalPaid === false) {
      out.push({
        kind: "final_payment",
        level: daysOut < -14 ? "urgent" : "todo",
        text: `Party was ${plural(-daysOut, "day")} ago. Record the final payment when it comes in.`,
      });
    }
    return out;
  }
  const when = daysOut === 0 ? "today" : daysOut === 1 ? "tomorrow" : `in ${daysOut} days`;

  // Unpaid holds keep the date until someone records the deposit or cancels.
  // After the follow-up time (holdExpiresAt), or close to the party, it's urgent.
  if (!b.depositPaid && (b.status === "hold" || b.status === "expired")) {
    const overdue = b.holdExpiresAt === null || Date.parse(b.holdExpiresAt) <= now;
    out.push(
      overdue || daysOut <= rules.finalDays
        ? {
            kind: "needs_deposit",
            level: "urgent",
            text: "Needs deposit, still unpaid. Call the client, or cancel if they’re not booking.",
          }
        : { kind: "needs_deposit", level: "todo", text: "Needs deposit. Collect it to confirm the booking." },
    );
  }

  if (b.depositPaid && !b.contractSignedOn) {
    const since = b.depositReceivedOn ? daysBetween(b.depositReceivedOn, today) : 0;
    const late = since >= rules.contractDays;
    out.push({
      kind: late ? "contract_late" : b.contractSentOn ? "contract_unsigned" : "contract_unsent",
      level: late ? "urgent" : "todo",
      text: late
        ? `Contract still not signed, ${plural(since, "day")} after the deposit.`
        : b.contractSentOn
          ? "Deposit is in. Contract sent, not signed yet."
          : "Deposit is in. Send the contract.",
    });
  }

  if (b.depositPaid && !b.finalConfirmed && daysOut <= rules.finalDays) {
    const missing: string[] = [];
    if (!b.guests) missing.push("guest count");
    if (!b.menuReady) missing.push("menu");
    out.push(
      missing.length
        ? { kind: "final_missing", level: "urgent", text: `Party is ${when}. Still needs the ${missing.join(" and ")}.` }
        : b.contractSignedOn
          ? { kind: "final_ready", level: "ready", text: `Party is ${when}. Everything is in: mark the party finalized.` }
          : { kind: "final_contract", level: "urgent", text: `Party is ${when}. Guest count and menu are in; the contract isn't signed.` },
    );
  }

  if (b.clientUpdate) {
    out.push({ kind: "client_update", level: "todo", text: "The client sent their guest count and menu. Review and apply." });
  }

  if (b.unreadNotes) {
    out.push({
      kind: "notes",
      level: "todo",
      text: `${plural(b.unreadNotes, "new note")} from the kitchen.`,
    });
  }

  return out;
}

export type AttentionEntry<T extends AttentionBooking> = { booking: T; items: AttentionItem[] };

/** Every upcoming booking with something to do, soonest party first. */
export function attentionList<T extends AttentionBooking>(
  bookings: T[],
  today: ISODate,
  now: number,
  rules?: AttentionRules,
): AttentionEntry<T>[] {
  return bookings
    .map((booking) => ({ booking, items: attentionFor(booking, today, now, rules) }))
    .filter((e) => e.items.length)
    .sort((a, b) => a.booking.date.localeCompare(b.booking.date));
}
