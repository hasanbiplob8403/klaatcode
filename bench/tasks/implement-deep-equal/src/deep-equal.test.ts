import { expect, test } from "bun:test";
import { deepEqual } from "./deep-equal.js";

test("primitives", () => {
  expect(deepEqual(1, 1)).toBe(true);
  expect(deepEqual("a", "b")).toBe(false);
  expect(deepEqual(true, true)).toBe(true);
});
test("NaN equals NaN", () => { expect(deepEqual(NaN, NaN)).toBe(true); });
test("null vs object", () => {
  expect(deepEqual(null, {})).toBe(false);
  expect(deepEqual(null, null)).toBe(true);
});
test("nested structures", () => {
  expect(deepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBe(true);
  expect(deepEqual({ a: { b: [1, 2] } }, { a: { b: [2, 1] } })).toBe(false);
});
test("extra key fails", () => { expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false); });
test("array vs object", () => { expect(deepEqual([], {})).toBe(false); });
test("arrays of different length", () => { expect(deepEqual([1, 2], [1, 2, 3])).toBe(false); });
