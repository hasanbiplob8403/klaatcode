import { expect, test } from "bun:test";
import { fetchAll } from "./fetch-all.js";

// Smaller ids resolve LAST — order must still follow the input, not timing.
const fake = (id: number) =>
  new Promise<string>((res) => setTimeout(() => res(`item-${id}`), (4 - id) * 5));

test("returns one result per id", async () => {
  const out = await fetchAll([1, 2, 3], fake);
  expect(out.length).toBe(3);
});
test("results are in input order", async () => {
  const out = await fetchAll([1, 2, 3], fake);
  expect(out).toEqual(["item-1", "item-2", "item-3"]);
});
test("empty input", async () => {
  expect(await fetchAll([], fake)).toEqual([]);
});
