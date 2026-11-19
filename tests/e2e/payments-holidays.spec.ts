/**
 * Final payment after the party, and holidays on the calendar.
 * Needs the local Supabase stack and a build.
 */
import { expect, test } from "@playwright/test";
import { expectSignedIn } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, booking, ids, makeUser, service } from "../db/helpers";

test("record the final payment after the party; Needs attention follows", async ({ page }) => {
  const editor = await makeUser("editor", undefined, "pay-editor");
  const { venue, slot } = await ids();
  // A party a few days ago (bookings in the past are inserted directly).
  let date = addDays(todayIn("America/New_York"), -3 - (parseInt(RUN, 16) % 20));
  while (weekday(date) > 4 || yomTovClosure(date)) date = addDays(date, -1);
  const last = `Pay${RUN.slice(0, 5)}`;
  const { data: b, error } = await service
    .from("bookings")
    .insert(
      booking(venue("Other"), slot("afternoon"), date, {
        other_venue_name: "Hall",
        client_last_name: last,
        deposit_paid: true,
        deposit_method: "zelle",
        deposit_amount_cents: 40000,
        deposit_received_on: addDays(date, -30),
        guests_men: 20,
        guests_women: 20,
      }),
    )
    .select("id")
    .single();
  expect(error).toBeNull();

  await page.goto("/login");
  await page.getByLabel("Username").fill(editor.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-pay-editor`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page);

  await page.goto("/attention");
  const item = page.getByRole("listitem").filter({ hasText: last }).first();
  await expect(item.getByText(/Record the final payment when it comes in\./)).toBeVisible();

  await page.goto(`/bookings/${b!.id}`);
  const panel = page.getByRole("region", { name: "Final payment" });
  await expect(panel.getByText("Not received yet", { exact: false })).toBeVisible();
  await panel.getByLabel("Final payment received").check();
  await panel.getByLabel("Paid by").selectOption("check");
  await panel.getByLabel("Amount ($, optional)").fill("2,150");
  await panel.getByRole("button", { name: "Save final payment" }).click();
  await expect(panel.getByText("Final payment saved.")).toBeVisible();
  await page.reload();
  await expect(panel.getByText(/Received .* by check, \$2,150\./)).toBeVisible();
  await expect(page.getByText(/changed final payment|final payment/).first()).toBeVisible();

  await page.goto("/attention");
  await expect(page.getByRole("listitem").filter({ hasText: last })).toHaveCount(0);
});

test("the calendar shows Jewish and federal holidays", async ({ page }) => {
  const editor = await makeUser("editor", undefined, "hol-editor");
  await page.goto("/login");
  await page.getByLabel("Username").fill(editor.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-hol-editor`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page);

  await page.goto("/?m=2027-04&d=2027-04-22");
  await expect(page.getByRole("list", { name: "Holidays" }).getByText("Pesach", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Apr 22 \(Pesach\)/ })).toBeVisible();
  await page.goto("/?m=2026-11&d=2026-11-26");
  await expect(page.getByRole("list", { name: "Holidays" }).getByText("Thanksgiving")).toBeVisible();
  await page.screenshot({ path: "test-results/holidays.png", fullPage: true });
});
