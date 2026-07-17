import { describe, expect, test } from "bun:test";
import { checkout } from "./api.js";
import { resetIds } from "./utils/ids.js";

describe("checkout totals", () => {
  test("single wireless mouse totals exactly $19.99 + light shipping", () => {
    resetIds();
    const r = checkout("a@b.com", "1 Main St|Springfield|12345", "MS-02 x1");
    // 19.99 must survive the trip through minor units exactly.
    expect(r.order.subtotalCents).toBe(1999);
    expect(r.order.totalCents).toBe(1999 + 499);
    expect(r.receipt).toContain("Total: $24.98");
  });

  test("mixed cart with coupon", () => {
    resetIds();
    // KB-01 89.99*1 + MN-03 249.50*2 = 588.99 → SAVE10 → 530.09 (rounded), 3 items → standard shipping
    const r = checkout("a@b.com", "1 Main St|Springfield|12345", "KB-01 x1, MN-03 x2", "SAVE10");
    expect(r.order.subtotalCents).toBe(53009);
    expect(r.order.totalCents).toBe(53009 + 799);
  });

  test("USB-C hub quantity math is exact", () => {
    resetIds();
    // 34.95 * 3 = 104.85 exactly — truncation bugs make this 104.82
    const r = checkout("a@b.com", "2 Side St|Shelbyville|54321", "HD-04 x3");
    expect(r.order.subtotalCents).toBe(10485);
  });
});
