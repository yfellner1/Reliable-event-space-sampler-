import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { loadSetup } from "@/lib/booking-data";
import { todayIn } from "@/lib/dates";
import { ImportCalendar } from "./import-calendar";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  const me = await requireRole("admin");
  const setup = await loadSetup(me);
  const today = todayIn(setup.org.timeZone);
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Import from Google Calendar</h1>
      <div className="panel grid gap-2 text-sm">
        <p className="m-0">
          In Google Calendar, open <strong>Settings → Import &amp; export → Export</strong>. Google downloads a .zip
          file. Choose it below (or the .ics file inside it).
        </p>
        <p className="m-0 text-muted">
          The file is read on this device. Card numbers in the calendar notes are removed and never saved. Nothing is
          saved until you press Import, and parties that were already imported are skipped.
        </p>
      </div>
      <ImportCalendar setup={setup} defaultFrom={`${today.slice(0, 8)}01`} today={today} />
    </div>
  );
}
