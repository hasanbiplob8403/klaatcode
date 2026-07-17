import { expect, test } from "bun:test";
import { fizzbuzz } from "./fizzbuzz.js";

test("plain number", () => { expect(fizzbuzz(1)).toBe("1"); });
test("fizz", () => { expect(fizzbuzz(3)).toBe("Fizz"); });
test("buzz", () => { expect(fizzbuzz(5)).toBe("Buzz"); });
test("fizzbuzz both", () => { expect(fizzbuzz(15)).toBe("FizzBuzz"); });
test("fizzbuzz 30", () => { expect(fizzbuzz(30)).toBe("FizzBuzz"); });
