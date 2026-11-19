/**
 * Reports for a chosen date range, on screen and as a PDF.
 * Needs the local Supabase stack and a build.
 */
import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectSignedIn } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, weekday } from "../../src/lib/dates";
import { RUN, booking, ids, makeUser, service } from "../db/helpers";

test("an editor sees the report for custom dates and downloads it as a PDF", async ({ page }) => {
  const editor = await makeUser("editor", undefined, "report-editor");
  const { venue, slot } = await ids();
  // A month in the far future that only this run uses.
  const year = 2200 + (parseInt(RUN, 16) % 700);
  const from = `${year}-03-01`;
  const to = `${year}-03-31`;
  let date = `${year}-03-10`;
  while (weekday(date) > 4 || yomTovClosure(date)) date = addDays(date, 1);

  const { error } = await service.from("bookings").insert(
    booking(venue("Kalamata event space"), slot("evening"), date, {
      start_minute: 1110,
      client_last_name: `Rep${RUN.slice(0, 4)}`,
      status: "booked",
      hold_expires_at: null,
      deposit_paid: true,
      deposit_method: "zelle",
      deposit_amount_cents: 40000,
      deposit_received_on: "2026-11-01",
      guests_men: 20,
      guests_women: 20,
    }),
  );
  expect(error).toBeNull();
  const org = (await service.from("organizations").select("id").eq("slug", "kalamata").single()).data!.id;
  const req = await service.from("date_requests").insert([
    { org_id: org, event_date: date, slot_id: slot("evening"), client_name: "Wants It", client_phone: "1", guests: 80, was_full: true },
    { org_id: org, event_date: date, slot_id: slot("evening"), client_name: "Also", client_phone: "2", was_full: true },
    { org_id: org, event_date: date, slot_id: slot("afternoon"), client_name: "Open", client_phone: "3", was_full: false },
  ]);
  expect(req.error).toBeNull();

  await page.goto("/login");
  await page.getByLabel("Username").fill(editor.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-report-editor`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page);

  await page.goto("/reports");
  await page.getByLabel("From").fill(from);
  await page.getByLabel("To").fill(to);
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`from=${from}&to=${to}`));

  const summary = page.getByRole("region", { name: "Summary" });
  // 40 guests at $45 = $1,800 + 18% gratuity = $2,124; deposit $400; $1,724 to collect.
  await expect(summary.getByText("$2,124")).toBeVisible();
  await expect(summary.getByText("$1,724")).toBeVisible();
  const demand = page.getByRole("region", { name: "Demand for taken dates" });
  await expect(demand.getByText("Asked for a date that was already booked")).toBeVisible();
  await expect(demand.getByText("3 requests in all", { exact: false })).toBeVisible();
  await page.screenshot({ path: "test-results/reports.png", fullPage: true });

  const pdf = await page.request.get(`/reports/pdf?from=${from}&to=${to}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const body = await pdf.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  writeFileSync("test-results/report.pdf", body);
});
