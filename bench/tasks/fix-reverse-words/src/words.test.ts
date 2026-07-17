import { expect, test } from "bun:test";
import { reverseWords } from "./words.js";

test("two words", () => { expect(reverseWords("hello world")).toBe("world hello"); });
test("single word", () => { expect(reverseWords("solo")).toBe("solo"); });
test("three words", () => { expect(reverseWords("one two three")).toBe("three two one"); });
test("empty string", () => { expect(reverseWords("")).toBe(""); });
