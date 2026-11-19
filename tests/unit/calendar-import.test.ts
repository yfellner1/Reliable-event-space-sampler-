import { describe, expect, it } from "vitest";
import { notesWithWarnings, parseIcs, stripCards, toImportRows } from "@/lib/calendar-import";

// Made-up events in the shape Google exports. Card numbers are test numbers.
const ics = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "DTSTART:20261112T003000Z",
  "DTEND:20261112T033000Z",
  "UID:aaa@google.com",
  "CREATED:20261020T150000Z",
  "STATUS:CONFIRMED",
  "SUMMARY:Levi SB : 7325550101",
  "DESCRIPTION:chana@example.com\\n\\n$400\\nCC 4111 1111 1111 1111\\n08/29\\n123\\n\\nbooked 10/14\\n\\nH",
  " ead table\\n\\nGuest count : 16 women - 22 men + C&K\\n\\nBread : House rolls\\nSalad : Amazon\\nFish : Maple glazed salmon",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261113T003000Z",
  "DTEND:20261113T033000Z",
  "UID:bbb@google.com",
  "CREATED:20261001T150000Z",
  "STATUS:CONFIRMED",
  "SUMMARY:KATZ : 9175550102 (PremierX)",
  "DESCRIPTION:Guest count : 50 ( 6 kids menu )\\nFamily style",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261113T003000Z",
  "DTEND:20261113T033000Z",
  "UID:ccc@google.com",
  "CREATED:20261001T150000Z",
  "STATUS:CONFIRMED",
  "SUMMARY:Gold : 7185550103",
  "DESCRIPTION:<a href=\"mailto:x@y.com\">gold@example.com</a><br><br>$400 zelle booked 9/3<br>Buffet $52",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261128T140000Z",
  "DTEND:20261128T150000Z",
  "UID:ddd@google.com",
  "CREATED:20261101T150000Z",
  "STATUS:CONFIRMED",
  "SUMMARY:Outside Catering\\, 60 ppl +1 (848) 555-0104  118 7th St. in Main hall",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261128T000000Z",
  "DTEND:20261128T003000Z",
  "UID:eee@google.com",
  "STATUS:CONFIRMED",
  "SUMMARY:27% gratuity",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261201",
  "DTEND;VALUE=DATE:20261202",
  "UID:fff@google.com",
  "SUMMARY:Chanukah",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261020T003000Z",
  "DTEND:20261020T033000Z",
  "UID:ggg@google.com",
  "SUMMARY:Old party : 7325550000",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const events = parseIcs(ics, "America/New_York");
const { rows, skipped } = toImportRows(events, { from: "2026-11-01", depositCents: 40000 });
const by = (name: string) => rows.find((r) => r.lastName.startsWith(name))!;

describe("calendar import", () => {
  it("reads events in New York time and leaves out old, all-day, and note entries", () => {
    expect(rows.map((r) => r.lastName)).toEqual(["Levi", "KATZ (PremierX)", "Gold", "Outside catering"]);
    expect(by("Levi")).toMatchObject({ date: "2026-11-11", startMinute: 1170, durationMinutes: 180, slotKey: "evening" });
    expect(skipped).toEqual([{ date: "2026-11-27", title: "27% gratuity", reason: "A note, not a party." }]);
  });

  it("never keeps card numbers or the lines after them", () => {
    const all = JSON.stringify(rows);
    expect(all).not.toMatch(/4111/);
    expect(all).not.toMatch(/08\/29/);
    expect(by("Levi").deposit).toEqual({ method: "credit_card", amountCents: 40000, receivedOn: "2026-10-14" });
    expect(stripCards("a\nCC: 4111-1111-1111-1111 exp 12/29 CVV 721\nb")).toEqual({ text: "a\nb", hadCard: true });
  });

  it("splits out the client, guests, menu, and occasion", () => {
    const levi = by("Levi");
    expect(levi).toMatchObject({ phone: "732-555-0101", email: "chana@example.com", men: 23, women: 17, children: 0 });
    expect(levi.menuNotes).toBe("Bread : House rolls\nSalad : Amazon\nFish : Maple glazed salmon");
    expect(levi.notes).toContain("Sheva brachos");
    expect(levi.notes).toContain("Head table");
    expect(levi.notes).not.toContain("chana@example.com");
  });

  it("splits a bare total evenly and says so", () => {
    const katz = by("KATZ");
    expect(katz).toMatchObject({ style: "family", men: 22, women: 22, children: 6, deposit: null });
    expect(katz.warnings).toContain("The calendar gave 44 adults without a men/women split; it was split evenly.");
    expect(katz.warnings).toContain("No deposit in the calendar; imported as a hold (needs deposit).");
  });

  it("flags two parties the same evening, and reads HTML notes", () => {
    const gold = by("Gold");
    expect(gold).toMatchObject({ email: "gold@example.com", style: "buffet" });
    expect(gold.deposit).toEqual({ method: "zelle", amountCents: 40000, receivedOn: "2026-09-03" });
    expect(gold.warnings).toContain("Same evening as KATZ (PremierX). Both are imported.");
  });

  it("reads outside catering: address and head count, no client name", () => {
    expect(by("Outside")).toMatchObject({
      venueKey: "catering",
      venueAddress: "118 7th St. in Main hall",
      phone: "848-555-0104",
      men: 30,
      women: 30,
      slotKey: "morning",
    });
  });

  it("puts the things to check into the booking's notes", () => {
    expect(notesWithWarnings(by("KATZ"))).toMatch(/Imported from the Google calendar\. Check:\n- The calendar gave 44/);
  });
});
