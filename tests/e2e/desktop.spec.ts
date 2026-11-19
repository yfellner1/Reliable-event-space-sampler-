/** The left sidebar on a desktop-sized screen. */
import { expect, test } from "@playwright/test";
import { RUN, makeUser } from "../db/helpers";

test("the menu is a left sidebar on wider screens", async ({ page }) => {
  const admin = await makeUser("admin", undefined, "desktop-admin");
  await page.goto("/login");
  await page.getByLabel("Username").fill(admin.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-desktop-admin`);
  await page.getByRole("button", { name: "Sign in" }).click();

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Calendar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Menu/ })).toBeHidden();
  const box = await nav.boundingBox();
  const main = await page.locator("main").boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(main!.x); // sidebar sits to the left of the page
  await expect(nav.getByText("Test desktop-admin · Admin")).toBeVisible();
  await nav.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "test-results/desktop-sidebar.png" });
});
