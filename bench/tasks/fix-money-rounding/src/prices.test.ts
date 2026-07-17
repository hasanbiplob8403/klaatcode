import { expect, test } from "bun:test";
import { cartTotal } from "./prices.js";

test("classic float trap", () => { expect(cartTotal([0.1, 0.2])).toBe(0.3); });
test("many small items", () => { expect(cartTotal(Array(10).fill(0.1))).toBe(1); });
test("mixed prices", () => { expect(cartTotal([1.03, 2.44, 0.53])).toBe(4); });
test("empty cart", () => { expect(cartTotal([])).toBe(0); });
test("whole dollars", () => { expect(cartTotal([5, 10])).toBe(15); });
