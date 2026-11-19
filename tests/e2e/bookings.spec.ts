/**
 * Calendar and booking form, end to end in a phone-sized browser.
 * Needs the local Supabase stack and a build (npm run build).
 */
import { expect, test, type Page } from "@playwright/test";
import { expectSignedIn } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, makeUser } from "../db/helpers";
import { pickBasicPartyMenu } from "./menu-helpers";

test.describe.configure({ mode: "serial" });

const TZ = "America/New_York";

/** A Sunday-to-Thursday date some weeks out, different on each run. */
function partyDate(offset: number) {
  let d = addDays(todayIn(TZ), 20 + (parseInt(RUN, 16) % 300) + offset);
  while (weekday(d) > 4 || yomTovClosure(d)) d = addDays(d, 1);
  return d;
}

let editorUser = "";
let kitchenUser = "";
const date = partyDate(0);

async function signIn(page: Page, username: string, label: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(`pw-${RUN}-${label}`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page);
}

test.beforeAll(async () => {
  editorUser = (await makeUser("editor", undefined, "cal-editor")).username;
  kitchenUser = (await makeUser("kitchen", undefined, "cal-kitchen")).username;
});

test("the secretary books a party from the calendar", async ({ page }) => {
  await signIn(page, editorUser, "cal-editor");
  await page.goto(`/?d=${date}`);
  const afternoon = page.getByRole("region", { name: "Afternoon" });
  const kalamata = afternoon.getByRole("listitem").filter({ hasText: "Kalamata event space" });
  await kalamata.getByRole("link", { name: "Book", exact: true }).click();

  await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible();
  await page.getByLabel("First name").fill("Miriam");
  await page.getByLabel("Last name").fill("Katz");
  await page.getByLabel("Phone", { exact: true }).fill("732-555-0142");
  await page.getByLabel("Buffet").check();
  await page.getByLabel("Men", { exact: true }).fill("18");
  await page.getByLabel("Women", { exact: true }).fill("20");
  await page.getByLabel("Children").fill("9");
  await expect(page.getByText("47 guests in total")).toBeVisible();
  await page.getByLabel("Type of party").selectOption({ label: "Sheva Brachos" });
  await page.getByLabel("Head table needed").check();
  await page.getByLabel("Mechitza (divider) needed").check();
  await page.screenshot({ path: "test-results/booking-form.png", fullPage: true });
  await page.getByRole("button", { name: /Save as hold/ }).click();

  await expect(page.getByText("Booking saved.")).toBeVisible();
  await expect(afternoon.getByText("Miriam Katz")).toBeVisible();
  await expect(afternoon.getByText(/Sheva Brachos/).first()).toBeVisible();
  await expect(afternoon.getByText("Head table, Mechitza").first()).toBeVisible();
  await expect(afternoon.getByText("◐ Needs deposit")).toBeVisible();
  await page.screenshot({ path: "test-results/calendar-editor.png", fullPage: true });
});

test("when the Kalamata space is taken in the evening, the form offers Novel", async ({ page }) => {
  const { service, booking, ids } = await import("../db/helpers");
  const { venue, slot } = await ids();
  await service
    .from("bookings")
    .insert(booking(venue("Kalamata event space"), slot("evening"), date, { start_minute: 1080, client_first_name: "Eli", client_last_name: "Weiss" }));

  await signIn(page, editorUser, "cal-editor");
  await page.goto(`/bookings/new?date=${date}&slot=${slot("evening")}&venue=${venue("Kalamata event space")}`);
  await expect(page.getByText("Kalamata event space is already on hold for this slot.")).toBeVisible();
  await page.getByRole("button", { name: "Use Novel (+$500)" }).click();
  await page.getByLabel("First name").fill("David");
  await page.getByLabel("Last name").fill("Rosen");
  await page.getByLabel("Phone", { exact: true }).fill("732-555-0177");
  await page.getByRole("button", { name: /Save as hold/ }).click();
  await expect(page.getByText("Booking saved.")).toBeVisible();
  await expect(page.getByText("David Rosen")).toBeVisible();
});

test("Novel is not offered for afternoon parties", async ({ page }) => {
  await signIn(page, editorUser, "cal-editor");
  await page.goto(`/?d=${date}`);
  const afternoon = page.getByRole("region", { name: "Afternoon" });
  await expect(afternoon.getByText("Novel")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Evening" }).getByText("Novel").first()).toBeVisible();
});

test("recording the deposit, contract, and final count in one save", async ({ page }) => {
  await signIn(page, editorUser, "cal-editor");
  await page.goto(`/?d=${date}`);
  await page
    .getByRole("listitem")
    .filter({ hasText: "Miriam Katz" })
    .getByRole("link", { name: "Open booking" })
    .click();
  await page.getByLabel("Deposit paid").check();
  await page.getByLabel("Zelle").check();
  await page.getByLabel("Contract signed").check();
  await page.getByLabel("Party finalized").check();
  await page.getByRole("button", { name: "Save booking" }).click();
  await expect(page.getByText("Bread: choose one.")).toBeVisible();
  await pickBasicPartyMenu(page);
  await page.getByRole("button", { name: "Save booking" }).click();
  await expect(page.getByText("Booking saved.")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: "Miriam Katz" });
  await expect(row.getByTitle("Deposit: done")).toBeVisible();
  await expect(row.getByTitle("Contract: done")).toBeVisible();
  await expect(row.getByTitle("Finalized: done")).toBeVisible();
});

test("a finalized party shows a clean summary, and unticking unlocks editing", async ({ page }) => {
  await signIn(page, editorUser, "cal-editor");
  await page.goto(`/?d=${date}`);
  await page
    .getByRole("listitem")
    .filter({ hasText: "Miriam Katz" })
    .getByRole("link", { name: "Open booking" })
    .click();
  const summary = page.getByRole("region", { name: "Party finalized" });
  await expect(summary.getByText("47", { exact: true })).toBeVisible();
  await expect(summary.getByText("Men", { exact: true })).toBeVisible();
  await expect(summary.getByText("Bread", { exact: true })).toBeVisible();
  const totals = summary.getByRole("region", { name: "Party total" });
  await expect(totals.getByRole("row", { name: /Party total \$[\d,]+/ })).toBeVisible();
  await expect(totals.getByText("From the finalized guest count and menu.", { exact: false })).toBeVisible();
  // No edit form, no cancel button.
  await expect(page.getByRole("button", { name: "Save booking" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel this booking…" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/finalized.png", fullPage: true });

  await summary.getByLabel("Party finalized").uncheck();
  await expect(page.getByRole("button", { name: "Save booking" })).toBeVisible();
  await expect(page.getByLabel("Party finalized")).not.toBeChecked();
  // Tick it again from the form.
  await page.getByLabel("Party finalized").check();
  await page.getByRole("button", { name: "Save booking" }).click();
  await expect(page.getByText("Booking saved.")).toBeVisible();
});

test("the form explains what's missing", async ({ page }) => {
  await signIn(page, editorUser, "cal-editor");
  await page.goto(`/bookings/new?date=${date}`);
  await page.getByRole("button", { name: /Save as hold/ }).click();
  await expect(page.getByText("Add the client’s last name.")).toBeVisible();
  await expect(page.getByText("Add the client’s phone number.")).toBeVisible();
});

test("the time of day only offers what runs that day", async ({ page }) => {
  await signIn(page, editorUser, "cal-editor");
  let friday = addDays(todayIn(TZ), 30);
  while (weekday(friday) !== 5 || yomTovClosure(friday)) friday = addDays(friday, 1);
  let winterSaturday = `${Number(todayIn(TZ).slice(0, 4)) + 1}-01-01`;
  while (weekday(winterSaturday) !== 6) winterSaturday = addDays(winterSaturday, 1);
  const options = () => page.getByLabel("Time of day").locator("option").allTextContents();

  await page.goto(`/bookings/new?date=${friday}`);
  expect(await options()).toEqual(["Morning"]);
  await page.getByLabel("Date", { exact: true }).fill(winterSaturday);
  await expect.poll(options).toEqual(["Evening"]);
  await page.getByLabel("Date", { exact: true }).fill(date);
  await expect.poll(options).toEqual(["Morning", "Afternoon", "Evening"]);
});

test("kitchen staff see booked parties without names, and can leave a note", async ({ page }) => {
  await signIn(page, kitchenUser, "cal-kitchen");
  await page.goto(`/?d=${date}`);
  await expect(page.getByText("47 guests (men 18, women 20, children 9)")).toBeVisible();
  await expect(page.getByText("Miriam Katz")).toHaveCount(0);
  await expect(page.getByText("732-555-0142")).toHaveCount(0);
  // David Rosen's party is only a hold, so the kitchen doesn't see it.
  await expect(page.getByText("David Rosen")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Book", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "test-results/calendar-kitchen.png", fullPage: true });

  await page.getByRole("button", { name: "Leave a note" }).click();
  await page.getByLabel("Note for the secretary").fill("Is the Caesar salad dairy-free?");
  await page.getByRole("button", { name: "Send note" }).click();
  await expect(page.getByText("Note sent to the secretary.")).toBeVisible();
});

test("the secretary sees the kitchen note and the booking history", async ({ page }) => {
  await signIn(page, editorUser, "cal-editor");
  await page.goto(`/?d=${date}`);
  await page
    .getByRole("listitem")
    .filter({ hasText: "Miriam Katz" })
    .getByRole("link", { name: "Open booking" })
    .click();
  await expect(page.getByText("Is the Caesar salad dairy-free?")).toBeVisible();
  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(page.getByText("Read", { exact: true })).toBeVisible();
  await expect(page.getByText("Placed a hold")).toBeVisible();
  await expect(page.getByText(/Booked; changed deposit, contract signed, party finalized/)).toBeVisible();
  await expect(page.getByText("Changed menu")).toBeVisible();
  await page.screenshot({ path: "test-results/booking-page.png", fullPage: true });
});

test("cancelling frees the slot and keeps the record", async ({ page }) => {
  await signIn(page, editorUser, "cal-editor");
  await page.goto(`/?d=${date}`);
  await page
    .getByRole("listitem")
    .filter({ hasText: "David Rosen" })
    .getByRole("link", { name: "Open booking" })
    .click();
  await page.getByRole("button", { name: "Cancel this booking…" }).click();
  await page.getByLabel("Reason (optional)").fill("Changed their mind");
  await page.getByRole("button", { name: "Yes, cancel the booking" }).click();
  await expect(page.getByText("Booking cancelled. The slot is open again.")).toBeVisible();
  await expect(page.getByText("David Rosen")).toHaveCount(0);
});
