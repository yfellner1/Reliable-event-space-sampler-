import { describe, expect, it } from "vitest";
import {
  isValidUsername,
  normalizeUsername,
  passwordProblem,
  usernameToEmail,
} from "@/lib/usernames";

describe("usernames", () => {
  it("normalizes case and spaces", () => {
    expect(normalizeUsername("  Sarah.K ")).toBe("sarah.k");
  });

  it.each(["sarah", "sarah.k", "front-desk", "k_1", "abc"])("accepts %s", (u) => {
    expect(isValidUsername(u)).toBe(true);
  });

  it.each(["", "ab", "Sarah", ".sarah", "sarah k", "sarah@x", "a".repeat(33), "שרה"])(
    "rejects %j",
    (u) => {
      expect(isValidUsername(u)).toBe(false);
    },
  );

  it("maps a username to its login address", () => {
    expect(usernameToEmail(" Sarah ", "users.example.invalid")).toBe("sarah@users.example.invalid");
  });

  it("refuses to map an invalid username", () => {
    expect(() => usernameToEmail("a b", "x.invalid")).toThrow();
  });
});

describe("passwords", () => {
  it("needs at least 8 characters", () => {
    expect(passwordProblem("short")).toMatch(/8/);
    expect(passwordProblem("long enough")).toBeNull();
  });
  it("caps length at 72", () => {
    expect(passwordProblem("x".repeat(73))).toMatch(/72/);
  });
});
