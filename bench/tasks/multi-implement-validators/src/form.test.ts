import { expect, test } from "bun:test";
import { validateForm } from "./form.js";

test("valid form has no errors", () => {
  expect(validateForm({ name: "Ada", email: "ada@example.com", age: 36 })).toEqual([]);
});
test("whitespace-only name rejected", () => {
  expect(validateForm({ name: "   ", email: "ada@example.com", age: 36 }))
    .toContain("name: required");
});
test("email without @ rejected", () => {
  expect(validateForm({ name: "Ada", email: "missing-at.example", age: 36 }))
    .toContain("email: invalid");
});
test("email domain without dot rejected", () => {
  expect(validateForm({ name: "Ada", email: "ada@nodot", age: 36 }))
    .toContain("email: invalid");
});
test("age 150 is valid", () => {
  expect(validateForm({ name: "Ada", email: "ada@example.com", age: 150 })).toEqual([]);
});
test("negative age rejected", () => {
  expect(validateForm({ name: "Ada", email: "ada@example.com", age: -1 }))
    .toContain("age: must be an integer 0-150");
});
test("fractional age rejected", () => {
  expect(validateForm({ name: "Ada", email: "ada@example.com", age: 3.5 }))
    .toContain("age: must be an integer 0-150");
});
