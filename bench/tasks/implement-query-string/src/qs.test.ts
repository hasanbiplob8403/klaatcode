import { expect, test } from "bun:test";
import { parseQuery } from "./qs.js";

test("empty input", () => { expect(parseQuery("")).toEqual({}); });
test("simple pairs", () => { expect(parseQuery("a=1&b=2")).toEqual({ a: "1", b: "2" }); });
test("repeated key becomes array", () => {
  expect(parseQuery("t=x&t=y&t=z")).toEqual({ t: ["x", "y", "z"] });
});
test("percent decoding", () => {
  expect(parseQuery("q=caf%C3%A9&path=%2Fhome")).toEqual({ q: "café", path: "/home" });
});
test("plus decodes to space", () => {
  expect(parseQuery("q=hello+world")).toEqual({ q: "hello world" });
});
test("flag without equals", () => {
  expect(parseQuery("debug&x=1")).toEqual({ debug: "", x: "1" });
});
