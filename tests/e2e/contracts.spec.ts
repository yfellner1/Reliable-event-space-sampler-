/**
 * Contract PDF and signed copies. Needs the local Supabase stack and a build.
 */
import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { expectSignedIn } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, booking, ids, makeUser, service } from "../db/helpers";

test("download the contract, mark it sent, and upload the signed copy", async ({ page }) => {
  const editor = await makeUser("editor", undefined, "contract-editor");
  const kitchen = await makeUser("kitchen", undefined, "contract-kitchen");
  const { venue, slot } = await ids();
  let date = addDays(todayIn("America/New_York"), 40 + (parseInt(RUN, 16) % 300));
  while (weekday(date) > 4 || yomTovClosure(date)) date = addDays(date, 1);
  const { data: b, error } = await service
    .from("bookings")
    .insert(
      booking(venue("Other"), slot("evening"), date, {
        other_venue_name: "Shul hall",
        venue_address: "12 Main St, Lakewood",
        start_minute: 1080,
        party_style: "plated",
        client_first_name: "Chana",
        client_last_name: `Contract${RUN.slice(0, 4)}`,
        client_email: "chana@example.com",
        guests_men: 20,
        guests_women: 15,
        guests_children: 10,
        notes: "Bringing their own wine.",
        menu_notes: "Two nut allergies",
        deposit_paid: true,
        deposit_method: "check",
        deposit_amount_cents: 40000,
        deposit_received_on: todayIn("America/New_York"),
      }),
    )
    .select("id")
    .single();
  expect(error).toBeNull();

  await page.goto("/login");
  await page.getByLabel("Username").fill(editor.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-contract-editor`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page);

  // The PDF.
  const pdf = await page.request.get(`/bookings/${b!.id}/contract`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const bytes = await pdf.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  writeFileSync("test-results/contract.pdf", bytes);

  // Mark sent.
  await page.goto(`/bookings/${b!.id}`);
  const panel = page.getByRole("region", { name: "Contract" });
  await panel.getByRole("button", { name: "Mark as sent today" }).click();
  await expect(panel.getByText("Marked as sent today.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Mark as sent today" })).toHaveCount(0);
  await expect(page.getByLabel("Contract sent on")).toHaveValue(todayIn("America/New_York"));

  // Upload the signed copy (the generated PDF stands in for it).
  await panel.getByLabel("Upload the signed contract (PDF or photo)").setInputFiles({
    name: "signed.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  await expect(panel.getByText("Signed copy saved. The contract is marked signed.")).toBeVisible();
  await expect(panel.getByRole("link", { name: "View signed copy" })).toBeVisible();
  await expect(page.getByLabel("Contract signed")).toBeChecked();

  // The signed copy opens through a short-lived link.
  const signed = await page.request.get(`/bookings/${b!.id}/signed-contract`, { maxRedirects: 0 });
  expect(signed.status()).toBe(303);
  expect(signed.headers()["location"]).toMatch(/\/storage\/v1\/object\/sign\/contracts\//);
  await page.screenshot({ path: "test-results/contract-panel.png", fullPage: true });

  // Kitchen staff can't get the contract or the signed copy.
  await page.goto("/logout");
  await page.goto("/login");
  await page.getByLabel("Username").fill(kitchen.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-contract-kitchen`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page);
  for (const path of ["contract", "signed-contract"]) {
    const r = await page.request.get(`/bookings/${b!.id}/${path}`, { maxRedirects: 0 });
    expect(r.headers()["content-type"] ?? "").not.toContain("application/pdf");
    expect(r.headers()["location"] ?? "").not.toContain("/storage/");
  }
});
