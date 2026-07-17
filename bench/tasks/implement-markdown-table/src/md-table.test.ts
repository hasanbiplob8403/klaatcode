import { expect, test } from "bun:test";
import { markdownTable } from "./md-table.js";

test("pads columns to widest cell", () => {
  expect(markdownTable(["name", "n"], [["ada", "1"], ["turing", "22"]])).toBe([
    "| name   | n  |",
    "| ------ | -- |",
    "| ada    | 1  |",
    "| turing | 22 |",
  ].join("\n"));
});
test("header can be the widest", () => {
  expect(markdownTable(["language", "ok"], [["go", "y"]])).toBe([
    "| language | ok |",
    "| -------- | -- |",
    "| go       | y  |",
  ].join("\n"));
});
test("single column no rows", () => {
  expect(markdownTable(["id"], [])).toBe([
    "| id |",
    "| -- |",
  ].join("\n"));
});
