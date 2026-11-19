/**
 * Sign-in and account management, end to end in a phone-sized browser.
 * Needs the local Supabase stack (npm run db:start) and a build (npm run build).
 */
import { expect, test, type Page } from "@playwright/test";
import { closeMenu, expectUserLine, openMenu, openNav } from "./nav";
import { RUN, makeUser } from "../db/helpers";

const kitchenUser = `kitchen-${RUN}`;
const kitchenPass = "kitchen-pass-1";

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe.configure({ mode: "serial" });

let adminUsername = "";
let adminPassword = "";

test.beforeAll(async () => {
  const admin = await makeUser("admin", undefined, "e2e-admin");
  adminUsername = admin.username;
  adminPassword = `pw-${RUN}-e2e-admin`;
});

test("signed-out visitors land on the login page", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fusers/);
  await expect(page.getByRole("heading", { name: "Party bookings" })).toBeVisible();
});

test("a wrong password is refused", async ({ page }) => {
  await signIn(page, adminUsername, "not-the-password");
  await expect(page.locator(".box-err")).toContainText("don't match");
});

test("an admin adds a kitchen staff account", async ({ page }) => {
  await signIn(page, adminUsername, adminPassword);
  await expectUserLine(page, "Test e2e-admin · Admin");
  await openNav(page, "Users");

  const add = page.locator("section").filter({ has: page.getByRole("heading", { name: "Add a user" }) });
  await add.getByLabel("Name", { exact: true }).fill("Kitchen Tester");
  await add.getByLabel("Username").fill(kitchenUser);
  await add.getByLabel("Role").selectOption("kitchen");
  await add.getByLabel("Password").fill(kitchenPass);
  await add.getByRole("button", { name: "Add user" }).click();
  await expect(add.locator(".box-ok")).toContainText(`Added Kitchen Tester`);
  await expect(page.getByText(kitchenUser, { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/admin-users.png", fullPage: true });
});

test("kitchen staff see no prices and cannot open the Users page", async ({ page }) => {
  await signIn(page, kitchenUser, kitchenPass);
  await expectUserLine(page, "Kitchen Tester · Kitchen staff");
  await page.getByRole("button", { name: /Menu/ }).click();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Calendar" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Users" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: /Needs attention/ })).toHaveCount(0);
  await closeMenu(page);
  await expect(page.getByText("Novel")).toBeVisible();
  await expect(page.getByText("$500")).toHaveCount(0);
  await page.screenshot({ path: "test-results/kitchen-home.png", fullPage: true });

  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/$/);
});

test("kitchen staff change their own password", async ({ page }) => {
  await signIn(page, kitchenUser, kitchenPass);
  await openNav(page, "My account");
  await page.getByLabel("Current password").fill(kitchenPass);
  await page.getByLabel("New password", { exact: true }).fill("kitchen-pass-2");
  await page.getByLabel("New password again").fill("kitchen-pass-2");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.locator(".box-ok")).toContainText("Password changed");

  await openMenu(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("You're signed out.")).toBeVisible();
  await signIn(page, kitchenUser, "kitchen-pass-2");
  await expectUserLine(page, "Kitchen Tester · Kitchen staff");
});

test("a switched-off account can no longer sign in", async ({ page, browser }) => {
  // Kitchen user is signed in on another device.
  const other = await browser.newContext();
  const kitchenPage = await other.newPage();
  await signIn(kitchenPage, kitchenUser, "kitchen-pass-2");
  await expectUserLine(kitchenPage, "Kitchen Tester · Kitchen staff");

  // Admin switches the account off.
  await signIn(page, adminUsername, adminPassword);
  await expectUserLine(page, "Test e2e-admin · Admin");
  await page.goto("/admin/users");
  const row = page.getByRole("listitem").filter({ hasText: kitchenUser });
  await row.getByText("Kitchen Tester").click();
  await row.getByLabel("Can sign in").uncheck();
  await row.getByRole("button", { name: "Save changes" }).click();
  await expect(row.locator(".box-ok")).toContainText("Saved");

  // The open session is thrown out on the next page load.
  await kitchenPage.reload();
  await expect(kitchenPage).toHaveURL(/\/login\?reason=inactive/);
  await expect(kitchenPage.getByText("This account is switched off")).toBeVisible();
  await other.close();

  // And a fresh sign-in is refused.
  const fresh = await browser.newPage();
  await signIn(fresh, kitchenUser, "kitchen-pass-2");
  await expect(fresh.locator(".box-err")).toContainText("don't match");
});
