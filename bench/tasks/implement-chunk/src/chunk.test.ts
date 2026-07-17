import { expect, test } from "bun:test";
import { chunk } from "./chunk.js";

test("uneven split", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});
test("exact split", () => {
  expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
});
test("size larger than array", () => {
  expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
});
test("empty array", () => { expect(chunk([], 3)).toEqual([]); });
test("size zero throws RangeError", () => {
  expect(() => chunk([1], 0)).toThrow(RangeError);
});
test("non-integer size throws RangeError", () => {
  expect(() => chunk([1], 1.5)).toThrow(RangeError);
});
test("input not modified", () => {
  const input = [1, 2, 3];
  chunk(input, 2);
  expect(input).toEqual([1, 2, 3]);
});
