/**
 * Admin settings: general, venues, and times of day. Needs the local
 * Supabase stack and a build. Restores what it changes.
 */
import { expect, test } from "@playwright/test";
import { openNav } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, booking, ids, makeUser, service } from "../db/helpers";

test("an admin changes settings and the rest of the app follows", async ({ page }) => {
  const admin = await makeUser("admin", undefined, "settings-admin");
  await page.goto("/login");
  await page.getByLabel("Username").fill(admin.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-settings-admin`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await openNav(page, "Settings");

  // General: the urgent-after hours show up on the booking form.
  const general = page.getByRole("region", { name: "General" });
  await general.getByLabel("Unpaid holds turn urgent after (hours)").fill("72");
  await general.getByRole("button", { name: "Save" }).click();
  await expect(general.getByText("Saved.")).toBeVisible();
  await page.goto("/bookings/new");
  await expect(page.getByText("After 72 hours it turns urgent in Needs attention.")).toBeVisible();
  await page.goto("/admin/settings");
  await general.getByLabel("Unpaid holds turn urgent after (hours)").fill("48");
  await general.getByRole("button", { name: "Save" }).click();
  await expect(general.getByText("Saved.")).toBeVisible();

  // Venues: change Novel's fee and see it on the Venues & times page.
  const venues = page.getByRole("region", { name: "Venues" });
  const novel = venues.getByRole("listitem").filter({ hasText: "Novel" });
  await novel.locator("summary").click();
  await novel.getByLabel("Extra fee for this venue ($)").fill("550");
  await novel.getByRole("button", { name: "Save venue" }).click();
  await expect(novel.getByText("Saved.")).toBeVisible();
  await page.goto("/info");
  await expect(page.getByText("+$550")).toBeVisible();
  await page.goto("/admin/settings");
  await novel.locator("summary").click();
  await novel.getByLabel("Extra fee for this venue ($)").fill("500");
  await novel.getByRole("button", { name: "Save venue" }).click();
  await expect(novel.getByText("Saved.")).toBeVisible();

  // Venues with upcoming parties can't be switched off.
  const { venue, slot } = await ids();
  let d = addDays(todayIn("America/New_York"), 600 + (parseInt(RUN, 16) % 300));
  while (weekday(d) > 4 || yomTovClosure(d)) d = addDays(d, 1);
  const party = await service.from("bookings").insert(booking(venue("Kalamata event space"), slot("afternoon"), d));
  expect(party.error).toBeNull();
  const kalamata = venues.getByRole("listitem").filter({ hasText: "Kalamata event space" });
  await kalamata.locator("summary").click();
  await kalamata.getByLabel("Offered for new bookings").uncheck();
  await kalamata.getByRole("button", { name: "Save venue" }).click();
  await expect(kalamata.getByText(/upcoming part(y is|ies are) booked here/)).toBeVisible();

  // Add a venue.
  const name = `Garden ${RUN.slice(0, 4)}`;
  await venues.getByText("+ Add a venue").click();
  const add = venues.locator("details").filter({ hasText: "+ Add a venue" });
  await add.getByLabel("Name", { exact: true }).fill(name);
  await add.getByLabel("Letter").fill(RUN.slice(0, 2).toUpperCase());
  await add.getByRole("button", { name: "Add venue" }).click();
  await expect(add.getByText(`Added ${name}.`)).toBeVisible();
  await expect(venues.locator("summary", { hasText: name })).toBeVisible();

  // Times of day: change the evening window and see it on the Venues & times page.
  const times = page.getByRole("region", { name: "Times of day" });
  const evening = times.getByRole("listitem").filter({ hasText: "Evening" });
  await evening.locator("summary").click();
  await evening.getByLabel("Latest start").fill("19:00");
  await evening.getByRole("button", { name: "Save time of day" }).click();
  await expect(evening.getByText("Saved.")).toBeVisible();
  await page.screenshot({ path: "test-results/settings.png", fullPage: true });
  await page.goto("/info");
  await expect(page.getByText("Starts 5:30 PM to 7:00 PM, done by 10:30 PM")).toBeVisible();
  await page.goto("/admin/settings");
  await evening.locator("summary").click();
  await evening.getByLabel("Latest start").fill("19:30");
  await evening.getByRole("button", { name: "Save time of day" }).click();
  await expect(evening.getByText("Saved.")).toBeVisible();

  // A bad window is refused.
  await evening.getByLabel("Latest start").fill("17:00");
  await evening.getByRole("button", { name: "Save time of day" }).click();
  await expect(evening.getByText("The latest start can't be before the earliest.")).toBeVisible();
});
