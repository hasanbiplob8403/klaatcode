import { expect, test } from "bun:test";
import { mergeIntervals } from "./intervals.js";

test("empty", () => { expect(mergeIntervals([])).toEqual([]); });
test("overlapping", () => {
  expect(mergeIntervals([[1, 3], [2, 6], [8, 10]])).toEqual([[1, 6], [8, 10]]);
});
test("touching intervals merge", () => {
  expect(mergeIntervals([[1, 2], [2, 3]])).toEqual([[1, 3]]);
});
test("unsorted input", () => {
  expect(mergeIntervals([[5, 7], [1, 2]])).toEqual([[1, 2], [5, 7]]);
});
test("input not modified", () => {
  const input: [number, number][] = [[5, 7], [1, 2]];
  mergeIntervals(input);
  expect(input).toEqual([[5, 7], [1, 2]]);
});
test("contained interval absorbed", () => {
  expect(mergeIntervals([[1, 10], [2, 3]])).toEqual([[1, 10]]);
});
