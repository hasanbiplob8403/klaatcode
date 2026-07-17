import { expect, test } from "bun:test";
import { evaluate } from "./calc.js";

test("precedence", () => { expect(evaluate("2+3*4")).toBe(14); });
test("parentheses", () => { expect(evaluate("(2+3)*4")).toBe(20); });
test("division", () => { expect(evaluate("10/4")).toBe(2.5); });
test("spaces and nesting", () => { expect(evaluate("1 + 2 * (3 - 1)")).toBe(5); });
test("left associative subtraction", () => { expect(evaluate("7-2-3")).toBe(2); });
test("decimals", () => { expect(evaluate("3.5*2")).toBe(7); });
test("single number", () => { expect(evaluate("42")).toBe(42); });
test("malformed operator throws", () => { expect(() => evaluate("2+*3")).toThrow(); });
test("unbalanced paren throws", () => { expect(() => evaluate("(1+2")).toThrow(); });
test("trailing garbage throws", () => { expect(() => evaluate("1+2)")).toThrow(); });
