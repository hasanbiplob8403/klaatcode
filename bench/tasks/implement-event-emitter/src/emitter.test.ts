import { expect, test } from "bun:test";
import { Emitter } from "./emitter.js";

test("on + emit delivers args", () => {
  const e = new Emitter();
  const seen: unknown[] = [];
  e.on("msg", (x) => seen.push(x));
  expect(e.emit("msg", 42)).toBe(1);
  expect(seen).toEqual([42]);
});
test("unsubscribe stops delivery", () => {
  const e = new Emitter();
  let n = 0;
  const off = e.on("t", () => n++);
  e.emit("t");
  off();
  e.emit("t");
  expect(n).toBe(1);
});
test("once fires a single time", () => {
  const e = new Emitter();
  let n = 0;
  e.once("t", () => n++);
  e.emit("t");
  e.emit("t");
  expect(n).toBe(1);
});
test("listeners called in subscription order", () => {
  const e = new Emitter();
  const seen: string[] = [];
  e.on("greet", (name) => seen.push(`hi ${name}`));
  e.on("greet", (name) => seen.push(`yo ${name}`));
  expect(e.emit("greet", "ada")).toBe(2);
  expect(seen).toEqual(["hi ada", "yo ada"]);
});
test("unknown event returns 0", () => {
  expect(new Emitter().emit("nope")).toBe(0);
});
