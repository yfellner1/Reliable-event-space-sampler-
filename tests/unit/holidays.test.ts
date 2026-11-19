import { describe, expect, it } from "vitest";
import { holidaysOn, shortHoliday } from "@/lib/holidays";

const names = (d: string) => holidaysOn(d).map((h) => h.name);

describe("holidays", () => {
  it("knows the Jewish holidays from the Hebrew calendar", () => {
    expect(names("2026-09-12")).toEqual(["Rosh Hashanah"]);
    expect(names("2026-09-21")).toEqual(["Yom Kippur"]);
    expect(names("2026-12-04")).toEqual(["Erev Chanukah (1st candle tonight)"]);
    expect(names("2026-12-12")).toEqual(["Chanukah (8th day)"]);
    expect(names("2027-03-23")).toEqual(["Purim"]);
    expect(names("2027-04-21")).toEqual(["Erev Pesach"]);
    expect(names("2027-04-22")).toEqual(["Pesach"]);
    expect(names("2027-06-11")).toEqual(["Shavuot"]);
  });

  it("moves fasts that fall on Shabbat to Sunday", () => {
    expect(names("2025-08-02")).toEqual(["Erev Tisha B'Av"]); // 9 Av on Shabbat
    expect(names("2025-08-03")).toEqual(["Tisha B'Av"]);
  });

  it("knows the federal holidays, with the observed weekday", () => {
    expect(names("2026-11-26")).toEqual(["Thanksgiving"]);
    expect(names("2027-01-18")).toEqual(["Martin Luther King Jr. Day"]);
    expect(names("2027-05-31")).toEqual(["Memorial Day"]);
    expect(names("2027-06-18")).toEqual(["Juneteenth (observed)"]);
    expect(names("2027-10-11")).toEqual(["Columbus Day", "Yom Kippur"]);
    expect(holidaysOn("2027-10-11").map((h) => h.kind)).toEqual(["us", "jewish"]);
    expect(names("2026-11-18")).toEqual([]);
  });

  it("shortens names for the calendar squares", () => {
    expect(shortHoliday("Chanukah (3rd day)")).toBe("Chanu\u00ADkah 3rd");
    expect(shortHoliday("Thanksgiving")).toBe("Thanks\u00ADgiving");
    expect(shortHoliday("Pesach (Chol Hamoed)")).toBe("Pesach CH");
  });
});

import { yomTovClosure } from "@/lib/holidays";
describe("yom tov closures", () => {
  it("closes the chosen days, and Erev evenings", () => {
    expect(yomTovClosure("2026-09-11")).toEqual({ reason: "Erev Rosh Hashanah", eveningOnly: true });
    expect(yomTovClosure("2026-09-13")).toEqual({ reason: "Rosh Hashanah", eveningOnly: false });
    expect(yomTovClosure("2026-09-21")).toEqual({ reason: "Yom Kippur", eveningOnly: false });
    expect(yomTovClosure("2026-09-27")).toEqual({ reason: "Sukkot", eveningOnly: false });
    expect(yomTovClosure("2026-09-28")).toBeNull(); // Chol Hamoed stays open
    expect(yomTovClosure("2027-04-29")).toEqual({ reason: "Pesach", eveningOnly: false });
    expect(yomTovClosure("2027-06-12")).toEqual({ reason: "Shavuot", eveningOnly: false });
    expect(yomTovClosure("2026-12-05")).toBeNull(); // Chanukah stays open
  });
});
