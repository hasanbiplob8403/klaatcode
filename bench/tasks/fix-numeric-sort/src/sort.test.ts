import { expect, test } from "bun:test";
import { sortScores } from "./sort.js";

test("multi-digit values sort numerically", () => {
  expect(sortScores([10, 1, 2])).toEqual([1, 2, 10]);
});
test("hundreds", () => {
  expect(sortScores([100, 25, 3])).toEqual([3, 25, 100]);
});
test("already sorted stays sorted", () => {
  expect(sortScores([1, 2, 3])).toEqual([1, 2, 3]);
});
test("does not modify input", () => {
  const input = [10, 1, 2];
  sortScores(input);
  expect(input).toEqual([10, 1, 2]);
});
