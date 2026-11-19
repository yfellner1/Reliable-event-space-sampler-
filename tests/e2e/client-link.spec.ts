/**
 * The client's private link: they send the guest count and menu, the
 * secretary applies it. Needs the local Supabase stack and a build.
 */
import { expect, test } from "@playwright/test";
import { expectSignedIn } from "./nav";
import { pickBasicPartyMenu } from "./menu-helpers";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, booking, ids, makeUser, service } from "../db/helpers";

test("the client sends their details from the link; the secretary applies them", async ({ page, browser }) => {
  const editor = await makeUser("editor", undefined, "link-editor");
  const { venue, slot } = await ids();
  let date = addDays(todayIn("America/New_York"), 50 + (parseInt(RUN, 16) % 400));
  while (weekday(date) > 4 || yomTovClosure(date)) date = addDays(date, 1);
  const { data: b, error } = await service
    .from("bookings")
    .insert(
      booking(venue("Other"), slot("evening"), date, {
        start_minute: 1110,
        other_venue_name: "Hall",
        party_style: "family",
        client_first_name: "Dina",
        client_last_name: `Link${RUN.slice(0, 4)}`,
        status: "booked",
        hold_expires_at: null,
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
  await page.getByLabel("Password").fill(`pw-${RUN}-link-editor`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page);
  await page.goto(`/bookings/${b!.id}`);
  const panel = page.getByRole("region", { name: "Client link" });
  await panel.getByRole("button", { name: "Create client link" }).click();
  const link = panel.getByLabel("Client link");
  await expect(link).toHaveValue(/\/c\/[A-Za-z0-9_-]{32}$/);
  const path = new URL(await link.inputValue()).pathname;

  // The client, not signed in.
  const client = await (await browser.newContext()).newPage();
  await client.goto(path);
  await expect(client.getByRole("heading", { name: "Your party, Dina" })).toBeVisible();
  await client.getByLabel("Men", { exact: true }).fill("30");
  await client.getByLabel("Women", { exact: true }).fill("28");
  await client.getByLabel("Children", { exact: true }).fill("4");
  await pickBasicPartyMenu(client);
  await client.getByLabel("Anything else? (allergies, seating, questions)").fill(`Sesame allergy ${RUN}`);
  await client.screenshot({ path: "test-results/client-link.png", fullPage: true });
  await client.getByRole("button", { name: "Send my details" }).click();
  await expect(client.getByText("Thank you! We received your details.")).toBeVisible();

  // A wrong link is a dead end.
  const bad = await client.goto("/c/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  expect(bad?.status()).toBe(404);

  // The secretary reviews and applies.
  await page.goto("/attention");
  await expect(
    page.getByRole("listitem").filter({ hasText: `Link${RUN.slice(0, 4)}` }).first().getByText(/The client sent their guest count and menu/),
  ).toBeVisible();
  await page.goto(`/bookings/${b!.id}`);
  await expect(panel.getByText("The client sent their details", { exact: false })).toBeVisible();
  await expect(panel.getByText(/Guests: 62/)).toBeVisible();
  await panel.getByRole("button", { name: "Apply to the booking" }).click();
  await expect(panel.getByText("Applied to the booking.")).toBeVisible();
  const { data: after } = await service.from("bookings").select("guests_total, notes").eq("id", b!.id).single();
  expect(after!.guests_total).toBe(62);
  expect(after!.notes).toContain(`Sesame allergy ${RUN}`);
  const { count } = await service.from("booking_menu_items").select("id", { count: "exact", head: true }).eq("booking_id", b!.id);
  expect(count).toBeGreaterThan(0);

  // Finalized parties can't be changed from the link.
  await service.from("bookings").update({ final_confirmed: true }).eq("id", b!.id);
  await client.goto(path);
  await expect(client.getByText("Your party details are final.", { exact: false })).toBeVisible();
});
