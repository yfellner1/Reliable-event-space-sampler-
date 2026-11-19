/**
 * The Needs attention list. Needs the local Supabase stack and a build.
 */
import { expect, test } from "@playwright/test";
import { expectSignedIn, openNav } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, booking, ids, makeUser, service } from "../db/helpers";
import { pickBasicPartyMenu } from "./menu-helpers";

test.describe.configure({ mode: "serial" });

const TZ = "America/New_York";
const sunToThu = (offset: number) => {
  let d = addDays(todayIn(TZ), offset);
  while (weekday(d) > 4 || yomTovClosure(d)) d = addDays(d, 1);
  return d;
};
const tag = RUN.slice(0, 4);

test("the secretary sees what needs doing, and it clears once done", async ({ page }) => {
  const editor = await makeUser("editor", undefined, "attn-editor");
  const { venue, slot } = await ids();
  const K = venue("Kalamata event space");
  const OTHER = venue("Other");
  const paid = {
    deposit_paid: true,
    deposit_method: "check" as const,
    deposit_amount_cents: 40000,
  };
  const deposit8DaysAgo = addDays(todayIn(TZ), -8);

  // A: a party next week, deposit in 8 days ago, contract not signed, nothing else.
  const soon = sunToThu(3);
  const a = await service.from("bookings").insert(
    booking(OTHER, slot("evening"), soon, {
      other_venue_name: "Shul hall",
      start_minute: 1080,
      party_style: "buffet",
      client_first_name: "Avi",
      client_last_name: `Late${tag}`,
      ...paid,
      deposit_received_on: deposit8DaysAgo,
      contract_sent_on: deposit8DaysAgo,
    }),
  );
  expect(a.error).toBeNull();
  // B: a hold far away.
  const far = sunToThu(300 + (parseInt(RUN, 16) % 200));
  const bHold = await service.from("bookings").insert(
    booking(K, slot("afternoon"), far, { client_first_name: "Bina", client_last_name: `Hold${tag}` }),
  );
  expect(bHold.error).toBeNull();

  await page.goto("/login");
  await page.getByLabel("Username").fill(editor.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-attn-editor`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page);
  await openNav(page, /Needs attention/);

  const late = page.getByRole("listitem").filter({ hasText: `Avi Late${tag}` }).first();
  await expect(late.getByText("Contract still not signed, 8 days after the deposit.")).toBeVisible();
  await expect(late.getByText(/Still needs the guest count and menu\./)).toBeVisible();
  const hold = page.getByRole("listitem").filter({ hasText: `Bina Hold${tag}` }).first();
  await expect(hold.getByText("Needs deposit. Collect it to confirm the booking.")).toBeVisible();
  await page.screenshot({ path: "test-results/attention.png", fullPage: true });

  // Urgent only hides the routine hold reminder.
  await page.getByRole("link", { name: /Urgent only/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: `Avi Late${tag}` }).first()).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: `Bina Hold${tag}` })).toHaveCount(0);

  // Sort out party A: contract signed, guests, and the menu.
  await late.getByRole("link").click();
  await page.getByLabel("Contract signed").check();
  await page.getByLabel("Men", { exact: true }).fill("30");
  await page.getByLabel("Women", { exact: true }).fill("20");
  await pickBasicPartyMenu(page);
  await page.getByRole("button", { name: "Save booking" }).click();
  await expect(page.getByText("Booking saved.")).toBeVisible();

  await openNav(page, /Needs attention/);
  await expect(
    page.getByRole("listitem").filter({ hasText: `Avi Late${tag}` }).first().getByText(/Everything is in: mark the party finalized\./),
  ).toBeVisible();
});
