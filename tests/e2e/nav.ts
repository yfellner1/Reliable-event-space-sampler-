import { expect, type Page } from "@playwright/test";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1024) < 768;

/** Opens the menu on phones (no-op on wider screens, where it's a sidebar). */
export async function openMenu(page: Page) {
  if (isPhone(page)) await page.getByRole("button", { name: /^☰?\s*Menu/ }).click();
}

export async function closeMenu(page: Page) {
  if (isPhone(page)) await page.getByRole("button", { name: "Close menu" }).last().click();
}

/** Opens a page from the main menu (behind the Menu button on phones). */
export async function openNav(page: Page, name: string | RegExp) {
  await openMenu(page);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
}

/** Waits until the signed-in app has loaded. */
export async function expectSignedIn(page: Page) {
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator("main")).toBeVisible();
}

/** Checks the "Name · Role" line shown in the menu. */
export async function expectUserLine(page: Page, text: string) {
  await expectSignedIn(page);
  await openMenu(page);
  await expect(page.getByRole("navigation", { name: "Main" }).getByText(text)).toBeVisible();
  await closeMenu(page);
}
