import { expect, test } from "bun:test";
import { toRoman } from "./roman.js";

test("units", () => { expect(toRoman(1)).toBe("I"); expect(toRoman(3)).toBe("III"); });
test("subtractive four", () => { expect(toRoman(4)).toBe("IV"); });
test("nine", () => { expect(toRoman(9)).toBe("IX"); });
test("fourteen", () => { expect(toRoman(14)).toBe("XIV"); });
test("forty", () => { expect(toRoman(40)).toBe("XL"); });
test("ninety", () => { expect(toRoman(90)).toBe("XC"); });
test("nineteen ninety-four", () => { expect(toRoman(1994)).toBe("MCMXCIV"); });
test("max", () => { expect(toRoman(3999)).toBe("MMMCMXCIX"); });
test("this year", () => { expect(toRoman(2026)).toBe("MMXXVI"); });
