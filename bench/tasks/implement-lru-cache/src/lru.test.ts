import { expect, test } from "bun:test";
import { LruCache } from "./lru.js";

test("set then get", () => {
  const c = new LruCache<string, number>(2);
  c.set("a", 1);
  expect(c.get("a")).toBe(1);
});
test("evicts least-recently-used", () => {
  const c = new LruCache<string, number>(2);
  c.set("a", 1); c.set("b", 2); c.set("c", 3);
  expect(c.get("a")).toBeUndefined();
  expect(c.get("b")).toBe(2);
  expect(c.get("c")).toBe(3);
});
test("get refreshes recency", () => {
  const c = new LruCache<string, number>(2);
  c.set("a", 1); c.set("b", 2);
  c.get("a");           // a becomes most-recent
  c.set("c", 3);        // evicts b, not a
  expect(c.get("b")).toBeUndefined();
  expect(c.get("a")).toBe(1);
});
test("update does not grow size", () => {
  const c = new LruCache<string, number>(2);
  c.set("a", 1); c.set("a", 9);
  expect(c.size).toBe(1);
  expect(c.get("a")).toBe(9);
});
