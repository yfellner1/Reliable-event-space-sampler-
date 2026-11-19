import { describe, expect, it } from "vitest";
import { isStandardTime, monthGrid, todayIn, weekday } from "@/lib/dates";
import {
  bookingProblems,
  lengths,
  slotClosedReason,
  startTimes,
  type BookingDraft,
  type SlotRule,
  type VenueRule,
} from "@/lib/schedule";

const TZ = "America/New_York";

const morning: SlotRule = {
  id: "m", key: "morning", label: "Morning", startEarliest: 420, startLatest: 420, endLatest: 600,
  maxMinutes: 180, weekdays: [0, 1, 2, 3, 4], standardTimeOnlyWeekdays: [], allowedStyles: ["bris"], maxGuests: 100,
};
const evening: SlotRule = {
  id: "e", key: "evening", label: "Evening", startEarliest: 1050, startLatest: 1170, endLatest: 1350,
  maxMinutes: 180, weekdays: [0, 1, 2, 3, 4, 6], standardTimeOnlyWeekdays: [6],
  allowedStyles: ["plated", "family", "buffet"], maxGuests: null,
};
const mainHall: VenueRule = {
  id: "k", name: "Main hall", code: "K", color: "#2C7A4B", kind: "event_space",
  exclusive: true, extraFeeCents: 0, slotKeys: null,
};
const catering: VenueRule = { ...mainHall, id: "c", name: "Outside catering", kind: "catering", slotKeys: ["afternoon", "evening"] };

const draft = (over: Partial<BookingDraft> = {}): BookingDraft => ({
  venueId: "k", slotId: "e", date: "2027-01-10", startMinute: 1080, durationMinutes: 180, style: "buffet",
  occasion: "", occasionOther: "", headTable: false, mechitza: false,
  firstName: "Miriam", lastName: "Katz", phone: "732-555-0142", email: "", otherVenueName: "", venueAddress: "",
  venueFeeCents: null, waiters: 0, men: 0, women: 0, children: 0, notes: "", depositPaid: false, depositMethod: "",
  depositAmountCents: null, depositReceivedOn: "", contractSentOn: "", contractSignedOn: "", finalConfirmed: false,
  ...over,
});
const ctx = { slot: evening, venue: mainHall, today: "2026-11-16", timeZone: TZ, checkSchedule: true };

describe("dates", () => {
  it("knows the weekday", () => {
    expect(weekday("2026-11-20")).toBe(5); // Friday
  });
  it("knows winter time in New York, including the changeover days", () => {
    expect(isStandardTime("2026-10-31", TZ)).toBe(false);
    expect(isStandardTime("2026-11-01", TZ)).toBe(true);
    expect(isStandardTime("2027-03-13", TZ)).toBe(true);
    expect(isStandardTime("2027-03-14", TZ)).toBe(false);
  });
  it("gives today's date in New York, not the device's timezone", () => {
    // 2:30 AM UTC on Nov 17 is still Nov 16 in New York.
    expect(todayIn(TZ, new Date("2026-11-17T02:30:00Z"))).toBe("2026-11-16");
  });
  it("builds a Sunday-first month grid", () => {
    const grid = monthGrid("2026-11");
    expect(grid[0]).toBe("2026-11-01"); // Nov 1, 2026 is a Sunday
    expect(grid.length % 7).toBe(0);
    expect(grid).toContain("2026-11-30");
  });
});

describe("slot rules", () => {
  it("closes Fridays", () => {
    expect(slotClosedReason(evening, "2026-11-20", TZ)).toMatch(/Friday/);
  });
  it("opens Saturday night only in the winter", () => {
    expect(slotClosedReason(evening, "2026-11-21", TZ)).toBeNull();
    expect(slotClosedReason(evening, "2027-06-12", TZ)).toMatch(/winter/);
  });
  it("offers one bris start time and lengths that finish by 10 AM", () => {
    expect(startTimes(morning)).toEqual([420]);
    expect(lengths(morning, 420)).toEqual([60, 90, 120, 150, 180]);
  });
  it("trims evening lengths so the party ends by 10:30 PM", () => {
    expect(lengths(evening, 1170).at(-1)).toBe(180);
    expect(lengths(evening, 1170 - 0).every((m) => 1170 + m <= 1350)).toBe(true);
  });
});

describe("afternoon", () => {
  const afternoon: SlotRule = { ...evening, id: "a", key: "afternoon", label: "Afternoon", startEarliest: 750, startLatest: 840, endLatest: 1020, weekdays: [0, 1, 2, 3, 4], standardTimeOnlyWeekdays: [] };
  it("only offers lengths that end by 5:00 PM", () => {
    expect(lengths(afternoon, 840).at(-1)).toBe(180);
    expect(lengths(afternoon, 840).every((m) => 840 + m <= 1020)).toBe(true);
  });
  it("does not offer the garden room", () => {
    const garden: VenueRule = { ...mainHall, id: "n", name: "Garden room", slotKeys: ["evening"] };
    expect(bookingProblems(draft({ slotId: "a", startMinute: 780, durationMinutes: 180 }), { ...ctx, slot: afternoon, venue: garden }).join()).toMatch(/Garden room doesn’t take afternoon/);
  });
});

describe("booking problems", () => {
  it("accepts a good booking", () => {
    expect(bookingProblems(draft(), ctx)).toEqual([]);
  });
  it("needs a name and phone", () => {
    expect(bookingProblems(draft({ lastName: "", phone: " " }), ctx)).toHaveLength(2);
  });
  it("refuses past dates", () => {
    expect(bookingProblems(draft({ date: "2026-11-15" }), ctx).join()).toMatch(/passed/);
  });
  it("allows past dates when the timing didn't change", () => {
    expect(bookingProblems(draft({ date: "2026-11-15" }), { ...ctx, checkSchedule: false })).toEqual([]);
  });
  it("only allows brises in the morning, up to 100 guests", () => {
    const m = { ...ctx, slot: morning };
    const base = { slotId: "m", startMinute: 420, durationMinutes: 180 };
    expect(bookingProblems(draft({ ...base, style: "plated" }), m).join()).toMatch(/brises only/);
    expect(bookingProblems(draft({ ...base, style: "bris", men: 60, women: 41 }), m).join()).toMatch(/100/);
    expect(bookingProblems(draft({ ...base, style: "bris", men: 60, women: 40 }), m)).toEqual([]);
  });
  it("needs an address for outside catering", () => {
    expect(bookingProblems(draft(), { ...ctx, venue: catering }).join()).toMatch(/address/);
  });
  it("needs deposit details when the deposit is paid", () => {
    expect(bookingProblems(draft({ depositPaid: true }), ctx)).toHaveLength(3);
  });
  it("needs guests before final", () => {
    expect(bookingProblems(draft({ finalConfirmed: true }), ctx).join()).toMatch(/guest count/);
  });
});

describe("closed days", () => {
  it("closes a slot on yom tov, and says why", () => {
    const s = { ...evening, closedDates: { "2027-04-22": "Pesach", "2027-04-21": "Erev Pesach" } };
    expect(slotClosedReason(s, "2027-04-22", TZ)).toBe("Closed for Pesach.");
    expect(slotClosedReason(s, "2027-04-21", TZ)).toBe("Erev Pesach: no evening parties (the holiday starts at sundown).");
    expect(slotClosedReason(s, "2027-04-20", TZ)).toBeNull();
  });
});
