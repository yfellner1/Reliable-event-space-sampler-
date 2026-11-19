import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { loadMenus, loadSetup } from "@/lib/booking-data";
import { longDateYear, todayIn } from "@/lib/dates";
import { buildReport } from "@/lib/report-data";
import { reportPdf } from "@/lib/report-pdf";
import { reportRange } from "@/lib/report-range";
import { createClient } from "@/lib/supabase/server";

/** The report as a PDF. Admins and editors. */
export async function GET(req: NextRequest) {
  const me = await requireRole("admin", "editor");
  const setup = await loadSetup(me);
  const today = todayIn(setup.org.timeZone);
  const { from, to } = reportRange(
    { from: req.nextUrl.searchParams.get("from"), to: req.nextUrl.searchParams.get("to") },
    today,
  );
  const report = await buildReport(await createClient(), setup, await loadMenus(), from, to);
  const pdf = await reportPdf(report, setup.org.name, longDateYear(today).replace(/^\w+, /, ""), setup.org.profile.brandColor);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Report ${from} to ${to}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
