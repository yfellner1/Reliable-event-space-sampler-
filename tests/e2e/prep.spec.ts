/**
 * The kitchen prep sheet. Needs the local Supabase stack and a build.
 */
import { expect, test } from "@playwright/test";
import { expectSignedIn } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, booking, ids, makeUser, service } from "../db/helpers";

test("the prep sheet lists the day's parties; kitchen staff see no names or booking notes", async ({ page }) => {
  const kitchen = await makeUser("kitchen", undefined, "prep-kitchen");
  const editor = await makeUser("editor", undefined, "prep-editor");
  const { venue, slot } = await ids();
  let date = addDays(todayIn("America/New_York"), 60 + (parseInt(RUN, 16) % 400));
  while (weekday(date) > 4 || yomTovClosure(date)) date = addDays(date, 1);
  const last = `Prep${RUN.slice(0, 5)}`;
  const { error } = await service.from("bookings").insert(
    booking(venue("Other"), slot("evening"), date, {
      start_minute: 1110,
      other_venue_name: "Hall",
      client_last_name: last,
      status: "booked",
      hold_expires_at: null,
      deposit_paid: true,
      deposit_method: "cash",
      deposit_amount_cents: 40000,
      deposit_received_on: todayIn("America/New_York"),
      guests_men: 25,
      guests_women: 25,
      guests_children: 5,
      menu_notes: `Salmon ${RUN}`,
      notes: `Nut allergy ${RUN}`,
    }),
  );
  expect(error).toBeNull();

  const signIn = async (username: string, label: string) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(`pw-${RUN}-${label}`);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expectSignedIn(page);
  };

  await signIn(kitchen.username, "prep-kitchen");
  await page.goto(`/prep?from=${date}&days=1`);
  await expect(page.getByText("55 guests: men 25, women 25, children 5")).toBeVisible();
  await expect(page.getByText(`Salmon ${RUN}`)).toBeVisible();
  await expect(page.getByText(last)).toHaveCount(0);
  await expect(page.getByText(`Nut allergy ${RUN}`)).toHaveCount(0);

  await page.context().clearCookies();
  await signIn(editor.username, "prep-editor");
  await page.goto(`/prep?from=${date}&days=7`);
  await expect(page.getByText(`Nut allergy ${RUN}`)).toBeVisible();
  await expect(page.getByText(last, { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/prep.png", fullPage: true });
});
