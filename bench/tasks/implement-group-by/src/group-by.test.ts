import { expect, test } from "bun:test";
import { groupBy } from "./group-by.js";

test("group words by length", () => {
  expect(groupBy(["a", "bb", "cc", "d"], (w) => String(w.length))).toEqual({
    "1": ["a", "d"],
    "2": ["bb", "cc"],
  });
});
test("empty input", () => { expect(groupBy([], () => "x")).toEqual({}); });
test("single group preserves order", () => {
  expect(groupBy([3, 1, 2], () => "all")).toEqual({ all: [3, 1, 2] });
});
test("objects by field", () => {
  const rows = [
    { city: "pune", n: 1 },
    { city: "goa", n: 2 },
    { city: "pune", n: 3 },
  ];
  expect(groupBy(rows, (r) => r.city)).toEqual({
    pune: [{ city: "pune", n: 1 }, { city: "pune", n: 3 }],
    goa: [{ city: "goa", n: 2 }],
  });
});
