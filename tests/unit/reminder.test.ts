import { describe, expect, it } from "vitest";
import { buildReminder, hourIn, whatsappChatId, type ReminderInput } from "@/lib/reminder";

const base: ReminderInput = {
  orgName: "Sample Catering",
  today: "2026-11-17",
  appUrl: "https://parties.example.com",
  entries: [
    {
      date: "2026-11-19", slotLabel: "Evening", venue: "Novel", clientName: "Avi Levy", url: "https://parties.example.com/bookings/1",
      items: [{ kind: "contract_late", level: "urgent", text: "Contract still not signed, 8 days after the deposit." }],
    },
    {
      date: "2026-12-02", slotLabel: "Afternoon", venue: "Main hall", clientName: "Bina <Gold>", url: "https://parties.example.com/bookings/2",
      items: [{ kind: "hold_waiting", level: "todo", text: "On hold, 30 hours left. Collect the deposit." }],
    },
  ],
  parties: [
    { date: "2026-11-17", slotLabel: "Evening", startMinute: 1080, venue: "Main hall", clientName: "Miriam Katz", guests: 47, status: "booked" },
    { date: "2026-11-18", slotLabel: "Morning", startMinute: 420, venue: "Main hall", clientName: "Eli Weiss", guests: 0, status: "hold" },
  ],
};

describe("daily reminder", () => {
  it("leads with the urgent items, then the rest, then today and tomorrow", () => {
    const r = buildReminder(base);
    expect(r.subject).toBe("Sample Catering parties: 2 need attention, 1 urgent");
    expect(r.text).toBe(
      [
        "*Sample Catering parties, Tuesday, November 17*",
        "",
        "*Urgent (1)*",
        "Thu, Nov 19 evening, Avi Levy (Novel)",
        "❗ Contract still not signed, 8 days after the deposit.",
        "",
        "*Also to do (1)*",
        "Wed, Dec 2 afternoon, Bina <Gold> (Main hall)",
        "• On hold, 30 hours left. Collect the deposit.",
        "",
        "*Today:*",
        "6:00 PM Main hall: Miriam Katz, 47 guests",
        "",
        "*Tomorrow:*",
        "7:00 AM Main hall: Eli Weiss, guest count not in (on hold)",
        "",
        "Open the app: https://parties.example.com/attention",
      ].join("\n"),
    );
  });

  it("escapes names in the email", () => {
    const r = buildReminder(base);
    expect(r.html).toContain("Bina &lt;Gold&gt;");
    expect(r.html).not.toContain("<Gold>");
  });

  it("says when everything is on track", () => {
    const r = buildReminder({ ...base, entries: [], parties: [] });
    expect(r.subject).toBe("Sample Catering parties: all on track");
    expect(r.text).toContain("Nothing needs follow-up.");
    expect(r.text).toContain("*Today:* no parties");
  });
});

describe("reminder helpers", () => {
  it("turns a phone number into a WhatsApp chat id, and leaves group ids alone", () => {
    expect(whatsappChatId("+1 (732) 555-0100")).toBe("17325550100@c.us");
    expect(whatsappChatId("120363025555555555@g.us")).toBe("120363025555555555@g.us");
  });
  it("knows the hour in New York, across the clock change", () => {
    expect(hourIn("America/New_York", new Date("2026-11-17T13:30:00Z"))).toBe(8); // EST
    expect(hourIn("America/New_York", new Date("2026-07-17T12:30:00Z"))).toBe(8); // EDT
  });
});
