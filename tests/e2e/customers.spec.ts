/**
 * Customers: saved from bookings, searchable, and reusable on a new booking.
 * Needs the local Supabase stack and a build.
 */
import { expect, test } from "@playwright/test";
import { openNav } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, booking, ids, makeUser, service } from "../db/helpers";

test("find a past customer, book them again, and fill the form from a search", async ({ page }) => {
  const editor = await makeUser("editor", undefined, "cust-editor");
  const { venue, slot } = await ids();
  let date = addDays(todayIn("America/New_York"), 40 + (parseInt(RUN, 16) % 300));
  while (weekday(date) > 4 || yomTovClosure(date)) date = addDays(date, 1);
  const last = `Cust${RUN.slice(0, 5)}`;
  const phone = `732-555-${String(parseInt(RUN.slice(0, 4), 16) % 10000).padStart(4, "0")}`;
  const { error } = await service.from("bookings").insert(
    booking(venue("Other"), slot("afternoon"), date, {
      other_venue_name: "Hall",
      client_first_name: "Rivka",
      client_last_name: last,
      client_phone: phone,
      client_email: `rivka.${RUN}@example.com`,
    }),
  );
  expect(error).toBeNull();

  await page.goto("/login");
  await page.getByLabel("Username").fill(editor.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-cust-editor`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await openNav(page, "Customers");

  // Search by phone, typed without dashes.
  await page.getByLabel("Search by name, phone, or email").fill(phone.replace(/-/g, ""));
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const card = page.getByRole("list", { name: "Customer list" }).getByRole("listitem").filter({ hasText: last });
  await expect(card).toHaveCount(1);
  await expect(card.getByText(`rivka.${RUN}@example.com`)).toBeVisible();
  await page.screenshot({ path: "test-results/customers.png", fullPage: true });

  // Book again: the client fields come filled in.
  await card.getByRole("link", { name: "Book again" }).click();
  await expect(page.getByLabel("Last name")).toHaveValue(last);
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue(phone);
  await expect(page.getByLabel("Email (for the contract)")).toHaveValue(`rivka.${RUN}@example.com`);

  // On a blank new booking, search and pick.
  await page.goto("/bookings/new");
  await page.getByLabel("Returning customer? Search by name, phone, or email").fill(last);
  await page.getByRole("list", { name: "Matching customers" }).getByRole("button", { name: new RegExp(last) }).click();
  await expect(page.getByText(`Filled in Rivka ${last}’s details.`)).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveValue("Rivka");
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue(phone);
});
