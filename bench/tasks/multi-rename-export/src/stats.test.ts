import { expect, test } from "bun:test";
import { summarize } from "./stats.js";

test("even-length series", () => {
  expect(summarize([1, 2, 3, 4])).toEqual({ average: 2.5, median: 2.5 });
});
test("odd-length series", () => {
  expect(summarize([7, 1, 3])).toEqual({ average: 11 / 3, median: 3 });
});
test("single value", () => {
  expect(summarize([5])).toEqual({ average: 5, median: 5 });
});
