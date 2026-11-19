import { describe, expect, it } from "vitest";
import { whatsappMessage, whatsappShareUrl, type WhatsAppInput } from "@/lib/whatsapp";

const base: WhatsAppInput = {
  date: "2026-11-22",
  slotLabel: "Afternoon",
  startMinute: 780,
  durationMinutes: 180,
  venueName: "Main hall",
  address: null,
  clientName: "Miriam Katz",
  phone: "732-555-0100",
  style: "buffet",
  men: 18,
  women: 20,
  children: 9,
  menu: [],
  menuNotes: "Penne alla vodka, eggplant parmesan, Caesar salad",
  status: "booked",
  depositPaid: true,
  depositCents: 40000,
  depositMethod: "check",
  contractSentOn: "2026-11-10",
  contractSignedOn: "2026-11-12",
  finalConfirmed: true,
  notes: "Bringing their own wine.",
};

describe("WhatsApp message", () => {
  it("matches the format the group uses", () => {
    expect(whatsappMessage(base)).toBe(
      [
        "*Party: Sunday, November 22*",
        "Venue: Main hall",
        "Time: 1:00 PM to 4:00 PM (Afternoon)",
        "Client: Miriam Katz, 732-555-0100",
        "Style: Buffet",
        "Guests: 47 total (Men 18, Women 20, Children 9)",
        "Menu: Penne alla vodka, eggplant parmesan, Caesar salad",
        "Deposit: $400 received (check)",
        "Contract: signed",
        "Status: Party finalized",
        "Notes: Bringing their own wine.",
      ].join("\n"),
    );
  });

  it("lists a chosen menu section by section, then the menu notes", () => {
    const msg = whatsappMessage({
      ...base,
      menu: [
        { section: "Bread", items: ["Focaccia"] },
        { section: "Sides", items: ["Basmati rice", "Home fries"] },
      ],
      menuNotes: "Two nut allergies",
    });
    expect(msg).toContain("Menu:\n• Bread: Focaccia\n• Sides: Basmati rice, Home fries\nMenu notes: Two nut allergies");
  });

  it("says what is still missing", () => {
    const msg = whatsappMessage({
      ...base,
      men: 0, women: 0, children: 0, menuNotes: null, status: "hold", depositPaid: false,
      depositCents: null, depositMethod: null, contractSentOn: null, contractSignedOn: null,
      finalConfirmed: false, notes: null,
    });
    expect(msg).toContain("Guests: not confirmed yet");
    expect(msg).toContain("Menu: not confirmed yet");
    expect(msg).toContain("Deposit: not received");
    expect(msg).toContain("Contract: not sent yet");
    expect(msg).toContain("Status: Needs deposit (not confirmed)");
    expect(msg).not.toContain("Notes:");
  });

  it("includes the address for outside catering", () => {
    expect(whatsappMessage({ ...base, venueName: "Outside catering", address: "12 Main St, Lakewood" })).toContain(
      "Venue: Outside catering\nAddress: 12 Main St, Lakewood",
    );
  });

  it("marks a cancelled party clearly", () => {
    const msg = whatsappMessage({ ...base, status: "cancelled" });
    expect(msg.split("\n")[0]).toBe("*CANCELLED: Party Sunday, November 22*");
    expect(msg).toContain("Status: CANCELLED");
  });

  it("makes a WhatsApp link with the message filled in", () => {
    expect(whatsappShareUrl("*Party*\nLine 2")).toBe("https://wa.me/?text=*Party*%0ALine%202");
  });
});
