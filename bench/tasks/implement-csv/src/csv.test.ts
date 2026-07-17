import { expect, test } from "bun:test";
import { parseCsv } from "./csv.js";

test("empty input", () => { expect(parseCsv("")).toEqual([]); });
test("single row", () => {
  expect(parseCsv("name,age\nAda,36")).toEqual([{ name: "Ada", age: "36" }]);
});
test("multiple rows + trimming", () => {
  expect(parseCsv("a, b\n1, 2\n3, 4")).toEqual([
    { a: "1", b: "2" },
    { a: "3", b: "4" },
  ]);
});
