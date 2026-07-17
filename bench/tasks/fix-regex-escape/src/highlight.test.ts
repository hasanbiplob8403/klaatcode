import { expect, test } from "bun:test";
import { highlight } from "./highlight.js";

test("plain term", () => {
  expect(highlight("say hello twice hello", "hello")).toBe("say [hello] twice [hello]");
});
test("term with plus signs", () => {
  expect(highlight("i like c++ a lot", "c++")).toBe("i like [c++] a lot");
});
test("dot must match literally", () => {
  expect(highlight("file.txt and fileAtxt", "file.txt")).toBe("[file.txt] and fileAtxt");
});
test("no match returns input", () => {
  expect(highlight("nothing here", "zzz")).toBe("nothing here");
});
