import "server-only";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { MUTED, PAGE, Writer, clean, drawMark, hexColor } from "./pdf-writer";
import { money } from "./format";
import type { Estimate, MenuLine } from "./menu";
import type { BusinessProfile } from "./booking-data";

export type ContractData = {
  orgName: string;
  profile: BusinessProfile;
  waiters: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  eventDate: string; // "Sunday, November 22, 2026"
  startTime: string;
  endTime: string;
  slotLabel: string;
  venue: string;
  address: string | null;
  style: string;
  occasion: string;
  setup: string;
  men: number;
  women: number;
  children: number;
  menuName: string | null;
  menu: MenuLine[];
  menuNotes: string | null;
  notes: string | null;
  estimate: Estimate | null;
  gratuityPercent: number;
  terms: string;
  preparedOn: string; // "November 17, 2026"
};

export async function contractPdf(c: ContractData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(`${c.orgName} private event contract - ${c.firstName} ${c.lastName}`));
  doc.setAuthor(clean(c.orgName));
  doc.setCreationDate(new Date());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = hexColor(c.profile.brandColor);
  const w = new Writer(doc, font, bold, `${c.orgName} event contract, ${c.firstName} ${c.lastName}, ${c.eventDate}`, brand);

  // Business mark, name, and contact details, then the title
  const markSize = 48;
  drawMark(w.page, bold, c.orgName, brand, (PAGE.w - markSize) / 2, w.y - markSize, markSize);
  w.y -= markSize + 12;
  const centered = (text: string, size: number, f = font, color = MUTED) => {
    const t = clean(text);
    w.page.drawText(t, { x: (PAGE.w - f.widthOfTextAtSize(t, size)) / 2, y: w.y - size, size, font: f, color });
    w.y -= size + 6;
  };
  centered(c.orgName.toUpperCase(), 22, bold, brand);
  if (c.profile.tagline) centered(c.profile.tagline, 10.5);
  const contact = [c.profile.address, c.profile.phone, c.profile.email, c.profile.website].filter(Boolean).join("  |  ");
  if (contact) centered(contact, 8.5);
  w.y -= 4;
  centered("Event Catering Contract", 12);
  w.y -= 4;
  w.text(`Prepared ${c.preparedOn}`, { size: 8.5, color: MUTED });

  w.heading("Client and event");
  w.fields([
    ["First name", c.firstName],
    ["Last name", c.lastName],
    ["Phone", c.phone],
    ["Email", c.email ?? ""],
    ["Event date", c.eventDate],
    ["Time of day", c.slotLabel],
    ["Start time", c.startTime],
    ["End time", c.endTime],
    ...(c.venue ? ([["Location", c.venue]] as [string, string][]) : []),
    ["Party style", c.style],
    ...(c.occasion ? ([["Type of party", c.occasion]] as [string, string][]) : []),
    ...(c.setup ? ([["Setup", c.setup]] as [string, string][]) : []),
    ...(c.address ? ([["Address", c.address]] as [string, string][]) : []),
  ]);

  w.heading("Guest count");
  const total = c.men + c.women + c.children;
  w.fields([
    ["Men", total ? String(c.men) : ""],
    ["Women", total ? String(c.women) : ""],
    ["Children", total ? String(c.children) : ""],
    ["Total guests", total ? String(total) : ""],
    ...(c.waiters ? ([["Waiters", String(c.waiters)]] as [string, string][]) : []),
  ]);
  if (!total) w.text("To be confirmed at least three (3) days before the event.", { size: 9, color: MUTED });

  w.heading(c.menuName ? `Menu (${c.menuName})` : "Menu");
  if (c.menu.length) {
    for (const l of c.menu) {
      w.text(`${l.section}: ${l.items.join(", ")}`, { size: 10 });
    }
  } else if (!c.menuNotes) {
    w.text("To be selected at least seven (7) days before the event.", { size: 10, color: MUTED });
  }
  if (c.menuNotes) w.text(`Menu notes: ${c.menuNotes}`, { size: 10, gap: 2 });
  if (c.notes) w.text(`Notes and upgrades: ${c.notes}`, { size: 10 });

  if (c.estimate) {
    const e = c.estimate;
    w.heading("Estimate");
    w.table([
      ...e.lines.map((l) => ({ label: l.label, value: money(l.cents) })),
      ...(c.gratuityPercent ? [{ label: `Waitstaff gratuity ${c.gratuityPercent}%`, value: money(e.gratuityCents) }] : []),
      ...(e.waiterCents ? [{ label: e.waiterLabel, value: money(e.waiterCents) }] : []),
      ...(e.venueFeeCents ? [{ label: e.venueFeeLabel, value: money(e.venueFeeCents) }] : []),
      ...(e.taxCents ? [{ label: `Sales tax ${e.taxPercent}%`, value: money(e.taxCents) }] : []),
      { label: "Estimated total", value: money(e.totalCents), bold: true, rule: true },
      ...(e.depositCents
        ? [
            { label: "Deposit received", value: `-${money(e.depositCents)}` },
            { label: "Balance due", value: money(e.balanceCents), bold: true },
          ]
        : []),
    ]);
    w.text(
      e.underMinimum
        ? `The guest count is under the ${e.minimum}-guest minimum, so the estimate bills for ${e.minimum}. The final bill follows the guaranteed guest count and the menu.`
        : "The final bill follows the guaranteed guest count and the menu.",
      { size: 8.5, color: MUTED },
    );
  }

  w.heading("Terms");
  for (const block of c.terms.split(/\n\s*\n/)) {
    const [first, ...rest] = block.trim().split("\n");
    if (!first) continue;
    if (rest.length && first === first.toUpperCase()) {
      w.text(first, { size: 9.5, bold: true });
      w.text(rest.join(" "), { size: 9.5, gap: 6 });
    } else {
      w.text(block.trim(), { size: 9.5, gap: 6 });
    }
  }

  w.heading("Agreement");
  w.text("By signing below, the Client agrees to the details and terms of this contract.", { size: 9.5 });
  w.signature(`Client signature (${c.firstName} ${c.lastName})`);
  w.signature(`For ${c.orgName}`);

  w.finish();
  return doc.save();
}
