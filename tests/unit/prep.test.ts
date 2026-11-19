import { describe, expect, it } from "vitest";
import { prepTotals } from "@/lib/prep";

describe("prep sheet", () => {
  it("adds up dishes across parties, in menu order", () => {
    const totals = prepTotals([
      {
        id: "a",
        guests: { total: 40 },
        menu: [
          { section: "Salad", items: ["Caesar"] },
          { section: "Fish", items: ["Maple glazed salmon"] },
        ],
      },
      {
        id: "b",
        guests: { total: 60 },
        menu: [
          { section: "Salad", items: ["Amazon", "Caesar"] },
          { section: "Fish", items: ["Maple glazed salmon"] },
        ],
      },
      { id: "c", guests: { total: 30 }, menu: [] },
    ]);
    expect(totals).toEqual([
      { section: "Salad", dish: "Caesar", parties: 2, guests: 100 },
      { section: "Salad", dish: "Amazon", parties: 1, guests: 60 },
      { section: "Fish", dish: "Maple glazed salmon", parties: 2, guests: 100 },
    ]);
  });
});
