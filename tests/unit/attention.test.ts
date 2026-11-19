import { describe, expect, it } from "vitest";
import { attentionFor, attentionList, type AttentionBooking } from "@/lib/attention";

const today = "2026-11-16";
const now = Date.parse("2026-11-16T15:00:00Z");
const b = (over: Partial<AttentionBooking> = {}): AttentionBooking => ({
  id: "x", date: "2026-12-20", status: "booked", holdExpiresAt: null, depositPaid: true,
  depositReceivedOn: "2026-11-15", contractSentOn: "2026-11-15", contractSignedOn: "2026-11-16",
  finalConfirmed: false, guests: 0, menuReady: false, unreadNotes: 0, ...over,
});
const kinds = (x: AttentionBooking) => attentionFor(x, today, now).map((i) => i.kind);

describe("needs attention", () => {
  it("has nothing to say about a party on track and far away", () => {
    expect(kinds(b())).toEqual([]);
  });

  it("asks for the deposit on an unpaid hold, urgently once the follow-up time passes", () => {
    const hold = { status: "hold" as const, depositPaid: false, depositReceivedOn: null, contractSentOn: null, contractSignedOn: null };
    expect(attentionFor(b({ ...hold, holdExpiresAt: "2026-11-17T15:00:00Z" }), today, now)).toEqual([
      { kind: "needs_deposit", level: "todo", text: "Needs deposit. Collect it to confirm the booking." },
    ]);
    expect(attentionFor(b({ ...hold, holdExpiresAt: "2026-11-16T14:00:00Z" }), today, now)).toEqual([
      { kind: "needs_deposit", level: "urgent", text: "Needs deposit, still unpaid. Call the client, or cancel if they’re not booking." },
    ]);
    // Close to the party it's urgent whatever the follow-up time.
    expect(attentionFor(b({ ...hold, date: "2026-11-19", holdExpiresAt: "2026-11-30T15:00:00Z" }), today, now)[0].level).toBe("urgent");
  });

  it("asks for the contract to be sent, then signed", () => {
    expect(kinds(b({ contractSentOn: null, contractSignedOn: null }))).toEqual(["contract_unsent"]);
    expect(kinds(b({ contractSignedOn: null }))).toEqual(["contract_unsigned"]);
  });

  it("makes an unsigned contract urgent a week after the deposit", () => {
    const items = attentionFor(b({ depositReceivedOn: "2026-11-09", contractSignedOn: null }), today, now);
    expect(items).toEqual([
      { kind: "contract_late", level: "urgent", text: "Contract still not signed, 7 days after the deposit." },
    ]);
    expect(kinds(b({ depositReceivedOn: "2026-11-10", contractSignedOn: null }))).toEqual(["contract_unsigned"]);
  });

  it("asks for the guest count and menu within 7 days of the party", () => {
    const items = attentionFor(b({ date: "2026-11-23" }), today, now);
    expect(items).toEqual([
      { kind: "final_missing", level: "urgent", text: "Party is in 7 days. Still needs the guest count and menu." },
    ]);
    expect(kinds(b({ date: "2026-11-24" }))).toEqual([]);
  });

  it("says when everything is in and the party can be marked final", () => {
    const items = attentionFor(b({ date: "2026-11-17", guests: 47, menuReady: true }), today, now);
    expect(items).toEqual([{ kind: "final_ready", level: "ready", text: "Party is tomorrow. Everything is in: mark the party finalized." }]);
    expect(kinds(b({ date: "2026-11-17", guests: 47, menuReady: true, finalConfirmed: true }))).toEqual([]);
  });

  it("counts unread kitchen notes", () => {
    expect(attentionFor(b({ unreadNotes: 2 }), today, now)).toEqual([
      { kind: "notes", level: "todo", text: "2 new notes from the kitchen." },
    ]);
  });

  it("lists upcoming parties with something to do, soonest first", () => {
    const list = attentionList(
      [
        b({ id: "far", date: "2027-01-10", contractSignedOn: null }),
        b({ id: "past", date: "2026-11-01", contractSignedOn: null }),
        b({ id: "fine", date: "2026-12-01" }),
        b({ id: "soon", date: "2026-11-20", guests: 40, menuReady: true }),
      ],
      today,
      now,
    );
    expect(list.map((e) => e.booking.id)).toEqual(["soon", "far"]);
  });
});

describe("after the party", () => {
  const today = "2026-11-20";
  const now = Date.parse("2026-11-20T15:00:00Z");
  const past = {
    id: "p", date: "2026-11-15", status: "booked" as const, holdExpiresAt: null, depositPaid: true,
    depositReceivedOn: "2026-10-01", contractSentOn: null, contractSignedOn: null, finalConfirmed: true,
    guests: 40, menuReady: true, unreadNotes: 0,
  };

  it("asks for the final payment until it is recorded", () => {
    expect(attentionFor({ ...past, finalPaid: false }, today, now)).toEqual([
      { kind: "final_payment", level: "todo", text: "Party was 5 days ago. Record the final payment when it comes in." },
    ]);
    expect(attentionFor({ ...past, finalPaid: true }, today, now)).toEqual([]);
    expect(attentionFor({ ...past, date: "2026-10-01", finalPaid: false }, today, now)[0].level).toBe("urgent");
  });

  it("lists unpaid past parties first", () => {
    const list = attentionList([{ ...past, id: "future", date: "2026-11-21", status: "hold" as const, depositPaid: false, holdExpiresAt: "2026-11-20T10:00:00Z" }, { ...past, finalPaid: false }], today, now);
    expect(list.map((e) => e.booking.id)).toEqual(["p", "future"]);
  });
});
