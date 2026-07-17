import { expect, test } from "bun:test";
import { sumRange } from "./range.js";

test("inclusive small", () => { expect(sumRange(1, 5)).toBe(15); });
test("single value", () => { expect(sumRange(3, 3)).toBe(3); });
test("inclusive larger", () => { expect(sumRange(1, 100)).toBe(5050); });
