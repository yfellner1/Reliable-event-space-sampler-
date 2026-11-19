import { describe, expect, it } from "vitest";
import { pricedMenu, type HolidayPricing } from "@/lib/holiday-pricing";
import { estimate, type MenuDef } from "@/lib/menu";

const menu: MenuDef = {
  id: "m", name: "Plated", styles: ["plated"], pricing: "per_person", basePriceCents: 4500,
  saturdayPriceCents: 6000, minGuests: 40, saturdayMinGuests: 50, gratuityPercent: 18, childPricePercent: 50,
  includedNote: null, sections: [],
};
const bris: MenuDef = { ...menu, id: "b", name: "Bris", styles: ["bris"], pricing: "package", basePriceCents: 300000, gratuityPercent: 0 };
const rules: HolidayPricing = {
  gratuityPercent: 27,
  gratuityDays: ["new_year", "memorial", "july4", "labor", "thanksgiving", "christmas"],
  chanukahPrices: { plated: 5000, buffet: 5200 },
};

describe("holiday pricing", () => {
  it("charges 27% gratuity on the chosen federal holidays and their observed days", () => {
    expect(pricedMenu(menu, "2026-11-26", "plated", rules)).toEqual({
      menu: { ...menu, gratuityPercent: 27 },
      notes: ["Thanksgiving: 27% gratuity"],
    });
    expect(pricedMenu(menu, "2027-07-05", "plated", rules).menu.gratuityPercent).toBe(27); // July 4th observed
    expect(pricedMenu(menu, "2026-11-11", "plated", rules).menu.gratuityPercent).toBe(18); // Veterans Day not chosen
    expect(pricedMenu(menu, "2026-11-25", "plated", rules).notes).toEqual([]);
  });

  it("uses Chanukah prices on all eight days, not on Saturday night or for a bris", () => {
    expect(pricedMenu(menu, "2026-12-07", "plated", rules).menu.basePriceCents).toBe(5000);
    expect(pricedMenu(menu, "2026-12-07", "family", rules).menu.basePriceCents).toBe(4500); // no family price set
    expect(pricedMenu(menu, "2026-12-12", "plated", rules, true).menu.basePriceCents).toBe(4500);
    expect(pricedMenu(bris, "2026-12-07", "bris", rules).menu).toBe(bris);
    expect(pricedMenu(menu, "2026-12-04", "plated", rules).notes).toEqual([]); // Erev Chanukah
  });

  it("flows into the estimate", () => {
    const { menu: m, notes } = pricedMenu(menu, "2026-11-26", "plated", rules);
    const e = estimate({
      menu: m, notes, choices: [], men: 20, women: 20, children: 0, saturdayNight: false,
      venueFeeCents: 0, venueName: null, depositPaidCents: 0,
    });
    expect(e.gratuityPercent).toBe(27);
    expect(e.gratuityCents).toBe(Math.round(180000 * 0.27));
    expect(e.notes).toEqual(["Thanksgiving: 27% gratuity"]);
  });
});
