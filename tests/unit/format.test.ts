import { describe, expect, it } from "vitest";
import { clock, money } from "@/lib/format";

describe("clock", () => {
  it.each([
    [0, "12:00 AM"],
    [420, "7:00 AM"],
    [750, "12:30 PM"],
    [1350, "10:30 PM"],
  ])("%i minutes is %s", (m, s) => {
    expect(clock(m)).toBe(s);
  });
});

describe("money", () => {
  it("drops cents for whole dollars", () => {
    expect(money(50000)).toBe("$500");
  });
  it("keeps cents otherwise", () => {
    expect(money(1250)).toBe("$12.50");
  });
});
