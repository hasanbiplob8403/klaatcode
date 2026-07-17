import { expect, test } from "bun:test";
import { getByPointer } from "./pointer.js";

test("empty pointer returns whole doc", () => {
  expect(getByPointer({ a: 1 }, "")).toEqual({ a: 1 });
});
test("nested object and array", () => {
  expect(getByPointer({ a: { b: [10, 20] } }, "/a/b/1")).toBe(20);
});
test("tilde-1 decodes to slash", () => {
  expect(getByPointer({ "a/b": 1 }, "/a~1b")).toBe(1);
});
test("tilde-0 decodes to tilde", () => {
  expect(getByPointer({ "m~n": 2 }, "/m~0n")).toBe(2);
});
test("missing path is undefined", () => {
  expect(getByPointer({ a: 1 }, "/nope/x")).toBeUndefined();
});
test("array root", () => {
  expect(getByPointer(["x", "y"], "/1")).toBe("y");
});
test("through primitives is undefined", () => {
  expect(getByPointer({ a: 5 }, "/a/b")).toBeUndefined();
});
