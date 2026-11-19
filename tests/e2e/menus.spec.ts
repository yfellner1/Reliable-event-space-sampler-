/**
 * Menu picker, estimate, and the kitchen's view of the menu.
 * Needs the local Supabase stack and a build (npm run build).
 */
import { expect, test, type Page } from "@playwright/test";
import { expectSignedIn, openNav } from "./nav";
import { yomTovClosure } from "../../src/lib/holidays";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { RUN, makeUser } from "../db/helpers";

test.describe.configure({ mode: "serial" });

function partyDate() {
  let d = addDays(todayIn("America/New_York"), 400 + (parseInt(RUN, 16) % 300));
  while (weekday(d) > 4 || yomTovClosure(d)) d = addDays(d, 1);
  return d;
}
const date = partyDate();
let editorUser = "";
let kitchenUser = "";

async function signIn(page: Page, username: string, label: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(`pw-${RUN}-${label}`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page);
}

test.beforeAll(async () => {
  editorUser = (await makeUser("editor", undefined, "menu-e2e-editor")).username;
  kitchenUser = (await makeUser("kitchen", undefined, "menu-e2e-kitchen")).username;
});

test("the secretary builds a plated menu and sees the estimate", async ({ page }) => {
  await signIn(page, editorUser, "menu-e2e-editor");
  await page.goto(`/?d=${date}`);
  await page
    .getByRole("region", { name: "Evening" })
    .getByRole("listitem")
    .filter({ hasText: "Kalamata event space" })
    .getByRole("link", { name: "Book", exact: true })
    .click();

  await page.getByLabel("First name").fill("Chana");
  await page.getByLabel("Last name").fill("Gold");
  await page.getByLabel("Phone", { exact: true }).fill("848-555-0108");
  await page.getByRole("radio", { name: "Plated" }).check();
  await page.getByLabel("Men", { exact: true }).fill("20");
  await page.getByLabel("Women", { exact: true }).fill("15");
  await page.getByLabel("Children").fill("10");

  const menu = page.getByRole("region", { name: /Menu/ });
  await menu.getByLabel("Focaccia").check();
  await menu.getByLabel("Greek salad").check();
  await menu.getByLabel("French onion soup").check();
  await menu.getByLabel("Maple glazed salmon").check();
  await menu.getByLabel("Ravioli").check();
  await menu.getByLabel("Which one?").selectOption("Mushroom");
  await menu.getByLabel("Basmati rice").check();
  await menu.getByLabel("Home fries").check();
  // Sides: choose two. Once two are picked the section folds to show them.
  await expect(menu.getByLabel("Creamy mashed potatoes")).toHaveCount(0);
  await menu.getByRole("button", { name: "Change sides" }).click();
  // A third side lets guests choose between them (its price goes on every guest).
  await menu.getByLabel("Creamy mashed potatoes").check();
  await expect(menu.getByText("Guests choose between these 3.", { exact: false })).toBeVisible();
  await menu.getByLabel("Creamy mashed potatoes").uncheck();
  await menu.getByRole("button", { name: "Done" }).click();
  await menu.getByLabel("Israeli cheesecake").check();

  // 35 adults + 10 children: 40 at $45, 5 children at $22.50.
  const est = page.getByRole("region", { name: "Estimate" });
  await expect(est.getByText("40 guests at $45")).toBeVisible();
  await expect(est.getByText("5 children at $22.50")).toBeVisible();
  // Base 1912.50; add-ons in full for all 45: focaccia 45 + soup 135 + ravioli 270.
  // Food 2362.50, +18% gratuity 425.25 = 2787.75
  await expect(est.getByText("Focaccia")).toBeVisible();
  await expect(est.getByText("$45", { exact: true })).toBeVisible();
  await expect(est.getByText("$2,787.75")).toBeVisible();
  await page.screenshot({ path: "test-results/menu-form.png", fullPage: true });

  await page.getByRole("button", { name: /Save as hold/ }).click();
  await expect(page.getByText("Booking saved.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Chana Gold" }).getByTitle("Menu: done")).toBeVisible();
});

test("party finalized needs every required menu section", async ({ page }) => {
  await signIn(page, editorUser, "menu-e2e-editor");
  await page.goto(`/?d=${date}`);
  await page.getByRole("listitem").filter({ hasText: "Chana Gold" }).getByRole("link", { name: "Open booking" }).click();
  const menu = page.getByRole("region", { name: /Menu/ });
  await expect(menu.getByLabel("Focaccia")).toBeChecked();
  await menu.getByLabel("Home fries").uncheck();
  await page.getByLabel("Deposit paid").check();
  await page.getByLabel("Cash").check();
  await page.getByLabel("Party finalized").check();
  await page.getByRole("button", { name: "Save booking" }).click();
  await expect(page.getByText("Sides: choose 2 (1 chosen).")).toBeVisible();

  await menu.getByLabel("Sweet potato fries").check();
  await page.getByLabel("Menu notes").fill("Two guests are allergic to nuts.");
  await page.getByRole("button", { name: "Save booking" }).click();
  await expect(page.getByText("Booking saved.")).toBeVisible();
});

test("kitchen staff see the menu with no prices", async ({ page }) => {
  await signIn(page, kitchenUser, "menu-e2e-kitchen");
  await page.goto(`/?d=${date}`);
  const party = page.getByRole("region", { name: "Evening" }).getByRole("listitem").first();
  await expect(party.getByText("Focaccia")).toBeVisible();
  await expect(party.getByText("Ravioli (mushroom)")).toBeVisible();
  await expect(party.getByText("Basmati rice, Sweet potato fries")).toBeVisible();
  await expect(party.getByText("Two guests are allergic to nuts.")).toBeVisible();
  await expect(party.getByText("$")).toHaveCount(0);
  await page.screenshot({ path: "test-results/menu-kitchen.png", fullPage: true });
});

test("a bris uses the bris menu and package price", async ({ page }) => {
  await signIn(page, editorUser, "menu-e2e-editor");
  await page.goto(`/?d=${date}`);
  await page
    .getByRole("region", { name: "Morning" })
    .getByRole("listitem")
    .filter({ hasText: "Kalamata event space" })
    .getByRole("link", { name: "Book", exact: true })
    .click();
  await page.getByLabel("Men", { exact: true }).fill("40");
  await page.getByLabel("Women", { exact: true }).fill("40");
  const menu = page.getByRole("region", { name: /Menu/ });
  await expect(menu.getByText("Included: Israeli salad")).toBeVisible();
  await menu.getByLabel("Avocado salad").check();
  await menu.getByLabel("How many platters?").fill("2");
  const est = page.getByRole("region", { name: "Estimate" });
  await expect(est.getByText("Bris package (up to 100 guests)")).toBeVisible();
  await expect(est.getByText("$3,170")).toBeVisible(); // 3,000 + 2 x 85, no gratuity
  await expect(est.getByText(/Gratuity/)).toHaveCount(0);
});

test("an admin changes a price and adds a section and a dish", async ({ page }) => {
  await makeUser("admin", undefined, "menu-e2e-admin");
  await signIn(page, `t-${RUN}-menu-e2e-admin`, "menu-e2e-admin");
  await openNav(page, "Menus");

  const plated = page.getByRole("region", { name: "Plated" });
  await plated.getByText("Bread", { exact: true }).click();
  const garlic = plated.getByRole("listitem").filter({ hasText: "Garlic knots" });
  await garlic.getByText("Garlic knots").click();
  await garlic.getByLabel("Price ($)", { exact: true }).fill("1.50");
  await garlic.getByRole("button", { name: "Save dish" }).click();
  await expect(garlic.getByText("+$1.50 pp")).toBeVisible();
  await garlic.getByLabel("Price ($)", { exact: true }).fill("1");
  await garlic.getByRole("button", { name: "Save dish" }).click();
  await expect(garlic.getByText("+$1 pp")).toBeVisible();

  // An optional section, so other tests' required sections are unchanged.
  const buffet = plated;
  await buffet.getByText("+ Add a section").click();
  const sectionName = `Specials ${RUN}`;
  await buffet.getByLabel("Name", { exact: true }).last().fill(sectionName);
  await buffet.getByLabel("Choose at least").last().fill("0");
  await buffet.getByRole("button", { name: "Add section" }).click();
  await expect(buffet.getByText(`Added “${sectionName}”.`)).toBeVisible();

  await buffet.getByText(sectionName, { exact: true }).click();
  const sec = buffet.locator("details").filter({ hasText: sectionName }).first();
  await sec.getByText("+ Add a dish").click();
  await sec.getByLabel("Name", { exact: true }).last().fill("Chef's special");
  await sec.getByRole("button", { name: "Add dish" }).click();
  await expect(sec.getByText("Added “Chef's special”.")).toBeVisible();
  await page.screenshot({ path: "test-results/admin-menus.png", fullPage: true });
});

test("a buffet includes two salads and two pastas, and charges extra choices and the soup station", async ({ page }) => {
  await signIn(page, editorUser, "menu-e2e-editor");
  await page.goto(`/?d=${date}`);
  await page
    .getByRole("region", { name: "Afternoon" })
    .getByRole("listitem")
    .filter({ hasText: "Kalamata event space" })
    .getByRole("link", { name: "Book", exact: true })
    .click();
  await page.getByRole("radio", { name: "Buffet" }).check();
  await page.getByLabel("Men", { exact: true }).fill("40");
  const menu = page.getByRole("region", { name: /Menu · Buffet/ });
  await expect(menu.getByText("Choose two · more $3 pp each").first()).toBeVisible();
  await expect(menu.getByText("Included: Dessert platters")).toBeVisible();
  await menu.getByLabel("Caesar salad", { exact: true }).check();
  await menu.getByLabel("Greek salad", { exact: true }).check();
  await menu.getByLabel("Quinoa salad", { exact: true }).check(); // one extra
  await menu.getByLabel("Lentil", { exact: true }).check(); // soup station
  const est = page.getByRole("region", { name: "Estimate" });
  await expect(est.getByText("40 guests at $47")).toBeVisible();
  await expect(est.getByText("Salad: 1 extra choice × $3 pp")).toBeVisible();
  await expect(est.getByText("Soup station: 1 × $3 pp")).toBeVisible();
  // 40 x 47 = 1880, + 120 + 120 = 2120, + 18% = 2501.60
  await expect(est.getByText("$2,501.60")).toBeVisible();
  await page.screenshot({ path: "test-results/menu-buffet.png", fullPage: true });
});
