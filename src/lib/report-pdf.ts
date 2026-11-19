import "server-only";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { longDateYear, shortDate } from "./dates";
import { money } from "./format";
import { MUTED, PAGE, Writer, clean, drawMark, hexColor } from "./pdf-writer";
import type { Report } from "./report-data";
import { STYLE_LABELS } from "./schedule";

const dollars = (c: number) => money(c);

/** The printable business report. */
export async function reportPdf(r: Report, orgName: string, preparedOn: string, brandColor?: string): Promise<Uint8Array> {
  const brand = hexColor(brandColor);
  const doc = await PDFDocument.create();
  const range = `${longDateYear(r.from)} to ${longDateYear(r.to)}`;
  doc.setTitle(clean(`${orgName} report, ${range}`));
  doc.setAuthor(clean(orgName));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold, `${orgName} report, ${range}`, brand);

  drawMark(w.page, bold, orgName, brand, PAGE.w - 54 - 40, w.y - 40, 40);
  w.page.drawText(clean(`${orgName} - Party report`), { x: 54, y: w.y - 20, size: 18, font: bold, color: brand });
  w.y -= 30;
  w.text(range, { size: 11, color: MUTED });
  w.text(`Prepared ${preparedOn}. Party totals come from each party's menu and guest count.`, { size: 8.5, color: MUTED, gap: 4 });

  const t = r.totals;
  w.heading("Summary");
  w.table([
    { label: "Booked parties", value: String(t.parties) },
    { label: "Guests", value: String(t.guests) },
    { label: "Party totals (revenue)", value: dollars(t.revenueCents), bold: true },
    ...(t.withoutTotal ? [{ label: `Parties with no total yet (no menu or guest count)`, value: String(t.withoutTotal) }] : []),
    { label: "Deposits received", value: dollars(t.depositsCents), rule: true },
    { label: `Final payments recorded (${t.finalPaidCount} ${t.finalPaidCount === 1 ? "party" : "parties"})`, value: dollars(t.finalPaymentsCents) },
    { label: "Balance still to collect", value: dollars(t.dueCents), bold: true },
    { label: "Cancelled parties", value: String(t.cancelled), rule: true },
    { label: "Holds not yet booked", value: String(t.holds) },
  ]);

  const d = r.demand;
  w.heading("Demand for taken dates");
  w.table([
    { label: "People who asked for a date that was already booked", value: String(d.takenRequests), bold: true },
    { label: "Taken dates and times they asked for", value: String(d.takenDates) },
    { label: "Guests they planned (where given)", value: String(d.guests) },
    { label: "All waitlist requests (including dates still open)", value: String(d.requests) },
    { label: "Booked later from the waitlist", value: String(d.bookedLater) },
  ]);
  if (d.byMonth.length) {
    w.columns(
      ["Month", "Asked", "Date was taken"],
      d.byMonth.map((m) => [m.label, String(m.requests), String(m.taken)]),
      [0.5, 0.25, 0.25],
      ["left", "right", "right"],
    );
  }
  if (d.bySlot.length) {
    w.columns(
      ["Time of day", "Asked", "Date was taken"],
      d.bySlot.map((m) => [m.label, String(m.requests), String(m.taken)]),
      [0.5, 0.25, 0.25],
      ["left", "right", "right"],
    );
  }

  const groupTable = (title: string, rows: Report["byMonth"]) => {
    if (!rows.length) return;
    w.heading(title);
    w.columns(
      ["", "Parties", "Guests", "Revenue"],
      [
        ...rows.map((g) => [g.label, String(g.parties), String(g.guests), dollars(g.revenueCents)]),
        ["Total", String(t.parties), String(t.guests), dollars(t.revenueCents)],
      ],
      [0.4, 0.15, 0.15, 0.3],
      ["left", "right", "right", "right"],
      { boldLast: true },
    );
  };
  groupTable("By month", r.byMonth);
  groupTable("By venue", r.byVenue);
  groupTable("By style", r.byStyle);
  groupTable("By type of party", r.byOccasion);

  if (r.parties.length) {
    w.heading("Parties");
    w.columns(
      ["Date", "Client", "Venue", "Style", "Guests", "Total", "Deposit", "Final paid", "Due"],
      r.parties.map((p) => [
        shortDate(p.date),
        p.client,
        p.venue,
        STYLE_LABELS[p.style],
        String(p.guests || "-"),
        p.totalCents === null ? "-" : dollars(p.totalCents),
        p.depositCents ? dollars(p.depositCents) : "-",
        p.finalPaid ? dollars(p.finalPaidCents) : "-",
        p.dueCents ? dollars(p.dueCents) : "-",
      ]),
      [0.11, 0.17, 0.14, 0.09, 0.07, 0.11, 0.1, 0.11, 0.1],
      ["left", "left", "left", "left", "right", "right", "right", "right", "right"],
      { size: 7.5 },
    );
  }

  w.finish();
  return doc.save();
}
