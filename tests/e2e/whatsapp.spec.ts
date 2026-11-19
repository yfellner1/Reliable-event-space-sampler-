/**
 * The WhatsApp group message. Needs the local Supabase stack and a build.
 */
import { expect, test } from "@playwright/test";
import { expectSignedIn } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, booking, ids, makeUser, service } from "../db/helpers";

test("copy the WhatsApp message; nothing asks for it to be sent", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const editor = await makeUser("editor", undefined, "wa-editor");
  const { venue, slot } = await ids();
  let date = addDays(todayIn("America/New_York"), 30 + (parseInt(RUN, 16) % 300));
  while (weekday(date) > 4 || yomTovClosure(date)) date = addDays(date, 1);
  const tag = RUN.slice(0, 4);
  const { data: b, error } = await service
    .from("bookings")
    .insert(
      booking(venue("Other"), slot("afternoon"), date, {
        other_venue_name: "Shul hall",
        venue_address: "12 Main St, Lakewood",
        client_first_name: "Rivka",
        client_last_name: `Post${tag}`,
        party_style: "buffet",
        guests_men: 18,
        guests_women: 20,
        guests_children: 9,
        menu_notes: "Penne alla vodka, Caesar salad",
        deposit_paid: true,
        deposit_method: "zelle",
        deposit_amount_cents: 40000,
        deposit_received_on: todayIn("America/New_York"),
      }),
    )
    .select("id")
    .single();
  expect(error).toBeNull();

  await page.goto("/login");
  await page.getByLabel("Username").fill(editor.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-wa-editor`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page);

  await page.goto(`/bookings/${b!.id}`);
  const panel = page.getByRole("region", { name: "WhatsApp message" });
  await expect(panel.getByRole("link", { name: "Open WhatsApp" })).toHaveCount(0);
  await panel.getByRole("button", { name: "Copy message" }).click();
  await expect(panel.getByText("Copied. Paste it into WhatsApp.")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Venue: Shul hall (other location)\nAddress: 12 Main St, Lakewood");
  expect(copied).toContain("Guests: 47 total (Men 18, Women 20, Children 9)");
  expect(copied).toContain("Deposit: $400 received (zelle)");
  expect(copied).toContain("Menu: Penne alla vodka, Caesar salad");
  await page.screenshot({ path: "test-results/whatsapp.png", fullPage: true });

  // Needs attention never asks for a WhatsApp post.
  await page.goto("/attention");
  const item = page.getByRole("listitem").filter({ hasText: `Rivka Post${tag}` }).first();
  await expect(item.getByText("Deposit is in. Send the contract.")).toBeVisible();
  await expect(item.getByText(/WhatsApp/)).toHaveCount(0);
});
