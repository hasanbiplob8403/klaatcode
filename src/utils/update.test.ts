import { describe, expect, test } from "bun:test";
import { compareSemver } from "./update.js";

describe("compareSemver", () => {
  test("orders plain versions", () => {
    expect(compareSemver("2.0.0", "2.1.0")).toBe(-1);
    expect(compareSemver("2.1.0", "2.0.9")).toBe(1);
    expect(compareSemver("2.1.0", "2.1.0")).toBe(0);
    expect(compareSemver("2.0.10", "2.0.9")).toBe(1); // numeric, not lexical
    expect(compareSemver("10.0.0", "9.9.9")).toBe(1);
  });

  test("handles v prefix and whitespace", () => {
    expect(compareSemver("v2.0.0", "2.0.0")).toBe(0);
    expect(compareSemver(" 2.0.0 ", "v2.0.1")).toBe(-1);
  });

  test("release beats prerelease of same triple", () => {
    expect(compareSemver("2.1.0-beta.1", "2.1.0")).toBe(-1);
    expect(compareSemver("2.1.0", "2.1.0-rc.1")).toBe(1);
    expect(compareSemver("2.1.0-alpha", "2.1.0-beta")).toBe(-1);
  });

  test("garbage input treated as 0.0.0", () => {
    expect(compareSemver("nonsense", "0.0.1")).toBe(-1);
    expect(compareSemver("nonsense", "0.0.0")).toBe(0);
  });
});
