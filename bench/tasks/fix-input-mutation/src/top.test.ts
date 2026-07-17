import { expect, test } from "bun:test";
import { topThree } from "./top.js";

test("returns top three, highest first", () => {
  expect(topThree([4, 9, 1, 7, 5])).toEqual([9, 7, 5]);
});
test("input is not modified", () => {
  const input = [4, 9, 1, 7, 5];
  topThree(input);
  expect(input).toEqual([4, 9, 1, 7, 5]);
});
test("fewer than three items", () => {
  expect(topThree([2, 8])).toEqual([8, 2]);
});
