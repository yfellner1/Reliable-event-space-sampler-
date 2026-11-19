import { describe, expect, it } from "vitest";
import { estimate, menuProblems, menuSummary, ruleLabel, type MenuDef, type MenuItemDef } from "@/lib/menu";

const item = (id: string, name: string, over: Partial<MenuItemDef> = {}): MenuItemDef => ({
  id, name, included: false, priceCents: 0, unit: "per_person", unitLabel: null, extraUnitPriceCents: null,
  extraUnitLabel: null, choiceCount: null, choiceOptions: null, choiceFromSection: false, ...over,
});

const plated: MenuDef = {
  id: "p", name: "Plated", styles: ["plated"], pricing: "per_person", basePriceCents: 4500, saturdayPriceCents: 6000,
  minGuests: 40, saturdayMinGuests: 50, gratuityPercent: 18, childPricePercent: 50, includedNote: null,
  sections: [
    { id: "bread", name: "Bread", note: null, groupLabel: null, minChoices: 1, maxChoices: 1,
      items: [item("rolls", "House rolls"), item("focaccia", "Focaccia", { priceCents: 100 })] },
    { id: "sides", name: "Sides", note: "Served with fish", groupLabel: null, minChoices: 2, maxChoices: 2,
      items: [item("rice", "Basmati rice"), item("fries", "Home fries"), item("broc", "Blackened broccoli", { priceCents: 500 })] },
    { id: "pasta", name: "Pasta", note: null, groupLabel: null, minChoices: 1, maxChoices: 1,
      items: [item("rav", "Ravioli", { priceCents: 600, choiceCount: 1, choiceOptions: ["Cheese", "Mushroom"] })] },
    { id: "apps", name: "Appetizers", note: "Optional", groupLabel: null, minChoices: 0, maxChoices: null,
      items: [
        item("sushi", "Sushi platters", { priceCents: 25000, unit: "flat", extraUnitPriceCents: 3500, extraUnitLabel: "additional platter" }),
        item("pizza", "Pizza", { priceCents: 400, choiceCount: 2 }),
      ] },
  ],
};

const bris: MenuDef = {
  ...plated, id: "b", name: "Bris", styles: ["bris"], pricing: "package", basePriceCents: 300000, saturdayPriceCents: null,
  minGuests: 100, saturdayMinGuests: null, gratuityPercent: 0, childPricePercent: 100,
  sections: [
    { id: "hot", name: "Hot buffet", note: null, groupLabel: null, minChoices: 3, maxChoices: 3,
      items: [item("eggs", "Scrambled eggs"), item("shak", "Shakshuka", { priceCents: 200 })] },
    { id: "add", name: "Add-ons", note: null, groupLabel: null, minChoices: 0, maxChoices: null,
      items: [item("avo", "Avocado salad", { priceCents: 8500, unit: "per_unit", unitLabel: "platter" })] },
  ],
};

const base = { choices: [], men: 0, women: 0, children: 0, saturdayNight: false, venueFeeCents: 0, venueName: null, depositPaidCents: 0 };

describe("estimate, per person", () => {
  it("bills the minimum when the count is under it", () => {
    const e = estimate({ ...base, menu: plated, men: 10, women: 10 });
    expect(e.foodCents).toBe(40 * 4500);
    expect(e.underMinimum).toBe(true);
    expect(e.gratuityCents).toBe(Math.round(40 * 4500 * 0.18));
  });

  it("charges children full price up to the minimum, half after it", () => {
    // 35 adults + 10 children: 40 full (35 adults + 5 children), 5 children at half.
    const e = estimate({ ...base, menu: plated, men: 20, women: 15, children: 10 });
    expect(e.foodCents).toBe(40 * 4500 + 5 * 2250);
    expect(e.lines.map((l) => l.label)).toEqual(["40 guests at $45", "5 children at $22.50"]);
  });

  it("charges every adult in full when adults alone pass the minimum", () => {
    const e = estimate({ ...base, menu: plated, men: 30, women: 20, children: 4 });
    expect(e.foodCents).toBe(50 * 4500 + 4 * 2250);
  });

  it("uses the Saturday night price and minimum", () => {
    const e = estimate({ ...base, menu: plated, men: 20, women: 20, saturdayNight: true });
    expect(e.foodCents).toBe(50 * 6000);
    expect(e.minimum).toBe(50);
  });

  it("adds per-person upgrades in full for everyone billed, children included", () => {
    const e = estimate({
      ...base, menu: plated, men: 20, women: 20, children: 2,
      choices: [{ itemId: "focaccia", quantity: 0, choices: [] }],
    });
    // Base: 40 x 45 + 2 x 22.50 = 1845. Focaccia: 42 x 1 = 42.
    expect(e.foodCents).toBe(184500 + 4200);
  });

  it("adds flat items and their extra units", () => {
    const e = estimate({
      ...base, menu: plated, men: 40, choices: [{ itemId: "sushi", quantity: 3, choices: [] }],
    });
    expect(e.foodCents).toBe(40 * 4500 + 25000 + 3 * 3500);
    expect(e.lines.at(-1)!.label).toBe("Sushi platters + 3 additional platters");
  });

  it("adds the venue fee after gratuity, and takes off the deposit", () => {
    const e = estimate({ ...base, menu: plated, men: 40, venueFeeCents: 50000, depositPaidCents: 40000 });
    expect(e.totalCents).toBe(180000 + 32400 + 50000);
    expect(e.balanceCents).toBe(e.totalCents - 40000);
  });

  it("uses the price saved with the booking over today's price", () => {
    const e = estimate({
      ...base, menu: plated, men: 40,
      choices: [{ itemId: "focaccia", quantity: 0, choices: [], priceCents: 150, unit: "per_person" }],
    });
    expect(e.foodCents).toBe(40 * 4500 + 40 * 150);
  });
});

describe("estimate, fish and pasta upgrades", () => {
  it("charges each upgrade in full for every guest", () => {
    const menu = {
      ...plated,
      sections: [
        { id: "fish", name: "Fish", note: null, groupLabel: null, minChoices: 1, maxChoices: 1,
          items: [item("bass", "Chilean sea bass", { priceCents: 1800 })] },
        { id: "pasta", name: "Pasta", note: null, groupLabel: null, minChoices: 1, maxChoices: 1,
          items: [item("pist", "Pistachio fettuccine", { priceCents: 200 })] },
      ],
    };
    const e = estimate({
      ...base, menu, men: 30, women: 20,
      choices: [{ itemId: "bass", quantity: 0, choices: [] }, { itemId: "pist", quantity: 0, choices: [] }],
    });
    expect(e.foodCents).toBe(50 * 4500 + 50 * 2000);
  });
});

describe("estimate, additional choices", () => {
  const family: MenuDef = {
    ...plated, id: "f", name: "Family style", styles: ["family"],
    sections: [
      { id: "salad", name: "Salad", note: null, groupLabel: null, minChoices: 2, maxChoices: null,
        includedChoices: 2, extraChoicePriceCents: 300,
        items: [item("caesar", "Caesar"), item("greek", "Greek"), item("quinoa", "Quinoa"), item("halloumi", "Halloumi", { priceCents: 500 })] },
      { id: "soup", name: "Soup station", note: "Optional", groupLabel: null, minChoices: 0, maxChoices: null,
        includedChoices: 0, extraChoicePriceCents: 300,
        items: [item("veg", "Vegetable soup"), item("onion", "French onion soup", { priceCents: 300 })] },
    ],
  };
  const pick = (...ids: string[]) => ids.map((itemId) => ({ itemId, quantity: 0, choices: [] }));

  it("includes the first choices, and charges each extra choice per person", () => {
    const two = estimate({ ...base, menu: family, men: 40, choices: pick("caesar", "greek") });
    expect(two.foodCents).toBe(40 * 4500);
    const four = estimate({ ...base, menu: family, men: 40, choices: pick("caesar", "greek", "quinoa", "halloumi") });
    // 2 extra choices x $3 x 40, plus halloumi's own +$5 x 40
    expect(four.foodCents).toBe(40 * 4500 + 2 * 300 * 40 + 500 * 40);
    expect(four.lines.map((l) => l.label)).toContain("Salad: 2 extra choices × $3 pp");
  });

  it("charges every soup at the station, plus a soup's own upgrade", () => {
    const e = estimate({ ...base, menu: family, men: 40, choices: pick("veg", "onion") });
    expect(e.foodCents).toBe(40 * 4500 + 2 * 300 * 40 + 300 * 40);
    expect(e.lines.map((l) => l.label)).toContain("Soup station: 2 × $3 pp");
  });

  it("describes the rule", () => {
    expect(family.sections.map(ruleLabel)).toEqual(["Choose two · more $3 pp each", "Optional · $3 pp each"]);
  });

  it("lets a section with additional choices take more than the included number", () => {
    expect(menuProblems(family, pick("caesar", "greek", "quinoa"), true)).toEqual([]);
    expect(menuProblems(family, pick("caesar"), true)).toEqual(["Salad: choose 2 (1 chosen)."]);
  });
});

describe("estimate, bris package", () => {
  it("is $3,000 flat with no gratuity, add-ons per person on 100", () => {
    const e = estimate({
      ...base, menu: bris, men: 30, women: 30, children: 20,
      choices: [
        { itemId: "shak", quantity: 0, choices: [] },
        { itemId: "avo", quantity: 2, choices: [] },
      ],
    });
    expect(e.foodCents).toBe(300000 + 100 * 200 + 2 * 8500);
    expect(e.gratuityCents).toBe(0);
    expect(e.billedGuests).toBe(100);
  });
});

describe("menu rules", () => {
  it("lets a half-planned menu be saved", () => {
    expect(menuProblems(plated, [{ itemId: "rolls", quantity: 0, choices: [] }], false)).toEqual([]);
  });
  it("needs every required section before the party is final", () => {
    const p = menuProblems(plated, [{ itemId: "rolls", quantity: 0, choices: [] }], true);
    expect(p).toContain("Sides: choose 2 (0 chosen).");
    expect(p).toContain("Pasta: choose one.");
  });
  it("lets guests choose between several dishes, charging each for every guest", () => {
    const two = [
      { itemId: "rolls", quantity: 0, choices: [] },
      { itemId: "focaccia", quantity: 0, choices: [] },
    ];
    expect(menuProblems(plated, two, true).filter((p) => p.startsWith("Bread"))).toEqual([]);
    // Focaccia is +$1 pp: charged for all 50 guests.
    const e = estimate({ ...base, menu: plated, choices: two, men: 25, women: 25 });
    expect(e.lines).toContainEqual({ label: "Focaccia", cents: 5000 });
  });
  it("keeps the limits on a package menu", () => {
    const pkg: MenuDef = { ...plated, pricing: "package" };
    const p = menuProblems(pkg, [
      { itemId: "rolls", quantity: 0, choices: [] },
      { itemId: "focaccia", quantity: 0, choices: [] },
    ], false);
    expect(p).toEqual(["Bread: choose only one."]);
  });
  it("needs the sub-choices, all different", () => {
    expect(menuProblems(plated, [{ itemId: "pizza", quantity: 0, choices: ["Margherita"] }], true)).toContain(
      "Pizza: pick 2 options.",
    );
    expect(menuProblems(plated, [{ itemId: "pizza", quantity: 0, choices: ["Plain", "Plain"] }], false)).toContain(
      "Pizza: pick 2 different options.",
    );
  });
  it("describes section rules", () => {
    expect(plated.sections.map(ruleLabel)).toEqual([
      "Choose one", "Choose two · Served with fish", "Choose one", "Optional",
    ]);
  });
});

describe("menu summary", () => {
  it("lists the chosen dishes in menu order, without prices", () => {
    const s = menuSummary(plated, [
      { itemId: "rav", quantity: 0, choices: ["Mushroom"] },
      { itemId: "focaccia", quantity: 0, choices: [] },
      { itemId: "sushi", quantity: 1, choices: [] },
    ]);
    expect(s).toEqual([
      { section: "Bread", items: ["Focaccia"] },
      { section: "Pasta", items: ["Ravioli (mushroom)"] },
      { section: "Appetizers", items: ["Sushi platters + 1 additional platter"] },
    ]);
  });
});
