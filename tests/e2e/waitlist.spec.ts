/**
 * Waitlist for taken dates. Needs the local Supabase stack and a build.
 */
import { expect, test } from "@playwright/test";
import { expectSignedIn } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, booking, ids, makeUser, service } from "../db/helpers";

test("someone wants a taken date; when it opens up, the app says so", async ({ page }) => {
  const editor = await makeUser("editor", undefined, "wait-editor");
  const { venue, slot } = await ids();
  let date = addDays(todayIn("America/New_York"), 500 + (parseInt(RUN, 16) % 900));
  while (weekday(date) > 4 || yomTovClosure(date)) date = addDays(date, 1);
  const { data: taken, error } = await service
    .from("bookings")
    .insert(
      booking(venue("Kalamata event space"), slot("evening"), date, {
        start_minute: 1110,
        status: "booked",
        hold_expires_at: null,
        deposit_paid: true,
        deposit_method: "cash",
        deposit_amount_cents: 40000,
        deposit_received_on: todayIn("America/New_York"),
      }),
    )
    .select("id")
    .single();
  expect(error).toBeNull();

  await page.goto("/login");
  await page.getByLabel("Username").fill(editor.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-wait-editor`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page);

  // From the calendar day, add someone to the waitlist.
  await page.goto(`/?d=${date}`);
  await page.getByRole("link", { name: /Someone else wants this evening\? Add to the waitlist/ }).click();
  const add = page.getByRole("region", { name: "Add someone" });
  await expect(add.getByLabel("Date they wanted")).toHaveValue(date);
  await add.getByLabel("Venue").selectOption({ label: "Kalamata event space" });
  await add.getByLabel("Name").fill(`Leah Wait${RUN.slice(0, 4)}`);
  await add.getByLabel("Phone", { exact: true }).fill("732-555-0111");
  await add.getByLabel("Guests (about)").fill("60");
  await add.getByRole("button", { name: "Add to the waitlist" }).click();
  await expect(add.getByText("Added to the waitlist.", { exact: false })).toBeVisible();

  const waiting = page.getByRole("list", { name: "Waiting" });
  const card = waiting.getByRole("listitem").filter({ hasText: `Leah Wait${RUN.slice(0, 4)}` });
  await expect(card.getByText("Date was taken")).toBeVisible();
  await expect(card.getByText("This date opened up", { exact: false })).toHaveCount(0);

  const { data: row } = await service
    .from("date_requests")
    .select("was_full, guests")
    .eq("client_name", `Leah Wait${RUN.slice(0, 4)}`)
    .single();
  expect(row).toEqual({ was_full: true, guests: 60 });

  // The party cancels: the date opens up.
  await service.from("bookings").update({ status: "cancelled" }).eq("id", taken!.id);
  await page.reload();
  await expect(card.getByText("This date opened up. Call them!")).toBeVisible();
  await page.goto("/attention");
  await expect(page.getByText(/A date opened up: \d+ (person is|people are) on the waitlist/)).toBeVisible();

  await page.goto("/waitlist");
  await card.getByRole("link", { name: "Book them" }).click();
  await expect(page.getByLabel("Last name")).toHaveValue(`Wait${RUN.slice(0, 4)}`);
  await expect(page.getByLabel("First name")).toHaveValue("Leah");

  // Marking them booked takes them off the waiting list.
  await page.goto("/waitlist");
  await card.getByLabel("Status").selectOption("booked");
  await expect(waiting.getByRole("listitem").filter({ hasText: `Leah Wait${RUN.slice(0, 4)}` })).toHaveCount(0);
});
