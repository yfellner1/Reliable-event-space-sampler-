import type { Page } from "@playwright/test";

/** Picks the included choices on the Family style or Buffet menu. */
export async function pickBasicPartyMenu(page: Page) {
  const menu = page.getByRole("region", { name: /Menu/ });
  for (const dish of [
    "House rolls",
    "Caesar salad",
    "Greek salad",
    "Panko crusted flounder",
    "Penne alla vodka",
    "Baked ziti",
    "Basmati rice",
  ]) {
    await menu.getByLabel(dish, { exact: true }).check();
  }
}
