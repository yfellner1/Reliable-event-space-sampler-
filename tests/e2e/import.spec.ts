/**
 * Importing parties from a Google Calendar export. Needs the local Supabase
 * stack and a build.
 */
import { expect, test } from "@playwright/test";
import { openNav } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, makeUser, service } from "../db/helpers";

test("an admin imports calendar parties; card numbers are dropped and nothing imports twice", async ({ page }) => {
  const admin = await makeUser("admin", undefined, "import-admin-e2e");
  let date = addDays(todayIn("America/New_York"), 500 + (parseInt(RUN, 16) % 2000));
  while (weekday(date) > 4 || yomTovClosure(date)) date = addDays(date, 1);
  const next = addDays(date, 1); // 7:30 PM New York is 00:30 UTC the next day (standard or daylight time aside)
  const utc = (d: string, hhmm: string) => `${d.replace(/-/g, "")}T${hhmm}00Z`;
  // 23:30 UTC is 6:30 or 7:30 PM in New York; either is an evening party.
  const ics = [
    "BEGIN:VCALENDAR",
    ...[1, 2].map((i) =>
      [
        "BEGIN:VEVENT",
        `DTSTART:${utc(date, "2330")}`,
        `DTEND:${utc(next, "0230")}`,
        `UID:e2e-${RUN}-${i}@google.com`,
        "CREATED:20261020T150000Z",
        "STATUS:CONFIRMED",
        `SUMMARY:Imp${RUN}x${i} SB : 732555010${i}`,
        `DESCRIPTION:$400\\nCC 4111 1111 1111 1111\\n08/29\\n123\\nGuest count : 20 men + 20 women\\nBread : House rolls`,
        "END:VEVENT",
      ].join("\r\n"),
    ),
    "END:VCALENDAR",
  ].join("\r\n");

  await page.goto("/login");
  await page.getByLabel("Username").fill(admin.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-import-admin-e2e`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await openNav(page, "Import");

  await page.getByLabel("Import parties from").fill(date);
  await page.getByLabel("Calendar file (.zip or .ics)").setInputFiles({
    name: "reservations.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(ics),
  });
  const list = page.getByRole("list", { name: "Parties to import" });
  await expect(list.locator(":scope > li")).toHaveCount(2);
  await expect(list.getByText(`Imp${RUN}x1`).first()).toBeVisible();
  await expect(list.getByText("Same evening as", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("4111")).toHaveCount(0);
  await page.screenshot({ path: "test-results/import.png", fullPage: true });

  await page.getByRole("button", { name: "Import 2 parties" }).click();
  await expect(page.getByRole("status")).toContainText("Imported 2 parties.");

  const { data } = await service
    .from("bookings")
    .select("id, client_last_name, notes, menu_notes, status, guests_total")
    .like("import_ref", `gcal:e2e-${RUN}-%`)
    .order("import_ref");
  expect(data).toHaveLength(2);
  expect(data![0]).toMatchObject({ client_last_name: `Imp${RUN}x1`, status: "booked", guests_total: 40, menu_notes: "Bread : House rolls" });
  expect(JSON.stringify(data)).not.toMatch(/4111|08\/29/);

  // The imported booking opens and saves (no first name needed).
  await page.goto(`/bookings/${data![1].id}`);
  await expect(page.getByText(`Imp${RUN}x2`).first()).toBeVisible();
  await page.getByLabel("Children").fill("2");
  await page.getByRole("button", { name: "Save booking" }).click();
  await expect(page.getByText("Booking saved.")).toBeVisible();

  // Importing again skips them.
  await page.goto("/admin/import");
  await page.getByLabel("Import parties from").fill(date);
  await page.getByLabel("Calendar file (.zip or .ics)").setInputFiles({
    name: "reservations.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(ics),
  });
  await page.getByRole("button", { name: "Import 2 parties" }).click();
  await expect(page.getByRole("status")).toContainText("2 were already in the app.");
});
