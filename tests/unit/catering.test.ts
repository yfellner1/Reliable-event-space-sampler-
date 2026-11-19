import { describe, expect, it } from "vitest";
import { estimate, menuFor, waiterCharge, type MenuDef } from "@/lib/menu";
import { occasionChoices, venueFeeFor, type VenueRule } from "@/lib/schedule";

const item = (id: string, priceCents: number, unit: "per_person" | "per_unit" | "per_table" | "flat" = "per_person") => ({
  id, name: id, included: false, priceCents, unit, unitLabel: null, extraUnitPriceCents: null, extraUnitLabel: null,
  choiceCount: null, choiceOptions: null, choiceFromSection: false,
});

const bris: MenuDef = {
  id: "bris", name: "Bris package", styles: ["buffet"], occasions: ["bris"], pricing: "per_person",
  basePriceCents: 1500, saturdayPriceCents: null, minGuests: 75, saturdayMinGuests: null, gratuityPercent: 0,
  childPricePercent: 100, childPriceCents: 1000, minChildren: 10, guestsPerTable: 10, includedNote: null,
  sections: [
    {
      id: "salads", name: "Salads", note: null, groupLabel: null, minChoices: 2, maxChoices: null,
      includedChoices: 2, extraChoicePriceCents: 100,
      items: [item("caesar", 0), item("greek", 0), item("fruity", 0)],
    },
    {
      id: "extras", name: "Extras", note: null, groupLabel: null, minChoices: 0, maxChoices: null,
      items: [item("hardwhite", 300), item("eggsalad", 1500, "per_table"), item("pancakes", 6500, "per_unit")],
    },
  ],
};
const buffet: MenuDef = { ...bris, id: "buffet", name: "Simcha buffet", occasions: null };

const staffing = { rateCents: 12500, min: 2, hoursIncluded: 4, extraHourCents: null };

describe("catering pricing", () => {
  it("bills adults and children apart, each with its own minimum", () => {
    const e = estimate({
      menu: bris, choices: [], men: 30, women: 30, children: 4, saturdayNight: false,
      venueFeeCents: 0, venueName: null, depositPaidCents: 0,
    });
    expect(e.lines[0]).toEqual({ label: "75 adults at $15", cents: 112500 });
    expect(e.lines[1]).toEqual({ label: "10 children at $10", cents: 10000 });
    expect(e.underMinimum).toBe(true);
  });

  it("charges extra choices per person, per-table items by table, and units by count", () => {
    const e = estimate({
      menu: bris,
      choices: [
        { itemId: "caesar", quantity: 0, choices: [] },
        { itemId: "greek", quantity: 0, choices: [] },
        { itemId: "fruity", quantity: 0, choices: [] },
        { itemId: "hardwhite", quantity: 0, choices: [] },
        { itemId: "eggsalad", quantity: 0, choices: [] },
        { itemId: "pancakes", quantity: 2, choices: [] },
      ],
      men: 45, women: 45, children: 20, saturdayNight: false,
      venueFeeCents: 0, venueName: null, depositPaidCents: 0,
    });
    const by = Object.fromEntries(e.lines.map((l) => [l.label, l.cents]));
    expect(by["90 adults at $15"]).toBe(135000);
    expect(by["20 children at $10"]).toBe(20000);
    expect(by["hardwhite"]).toBe(300 * 110); // every billed guest
    expect(by["eggsalad × 9 tables"]).toBe(1500 * 9);
    expect(by["pancakes × 2"]).toBe(13000);
    expect(by["Salads: 1 extra choice × $1.00 pp"] ?? by["Salads: 1 extra choice × $1 pp"]).toBe(100 * 110);
  });

  it("adds waiters, delivery, and sales tax", () => {
    const e = estimate({
      menu: buffet, choices: [], men: 40, women: 35, children: 0, saturdayNight: false,
      venueFeeCents: 5000, venueName: "Delivery & setup", venueFeeLabel: "Delivery fee",
      waiters: 2, durationMinutes: 180, staffing, salesTaxPercent: 6.625, depositPaidCents: 10000,
    });
    expect(e.waiterCents).toBe(25000);
    expect(e.waiterLabel).toBe("2 waiters at $125 (up to 4 hours)");
    expect(e.taxCents).toBe(Math.round((112500 + 25000 + 5000) * 0.06625));
    expect(e.totalCents).toBe(112500 + 25000 + 5000 + e.taxCents);
    expect(e.balanceCents).toBe(e.totalCents - 10000);
  });

  it("charges extra waiter hours when the business sets a price", () => {
    expect(waiterCharge(3, 300, { ...staffing, extraHourCents: 3000 })).toEqual({
      cents: 3 * 12500 + 3 * 3000,
      label: "3 waiters at $125 (up to 4 hours) + 1 extra hour",
    });
    expect(waiterCharge(0, 300, staffing).cents).toBe(0);
  });

  it("picks the menu made for the event type, else the general one", () => {
    expect(menuFor([buffet, bris], "buffet", "bris")?.id).toBe("bris");
    expect(menuFor([bris, buffet], "buffet", "upsherin")?.id).toBe("buffet");
    expect(menuFor([bris, buffet], "buffet", "")?.id).toBe("buffet");
  });

  it("lists the business's event types with Other last", () => {
    expect(occasionChoices(["bris", "other", "melava_malka", "nonsense"])).toEqual(["bris", "melava_malka", "other"]);
  });

  it("uses the typed delivery fee for catering jobs", () => {
    const v: VenueRule = { id: "d", name: "Delivery & setup", code: "D", color: "#1F4D2E", kind: "catering", exclusive: false, extraFeeCents: 2500, slotKeys: null };
    expect(venueFeeFor(v, null)).toBe(2500);
    expect(venueFeeFor(v, 4000)).toBe(4000);
  });
});
