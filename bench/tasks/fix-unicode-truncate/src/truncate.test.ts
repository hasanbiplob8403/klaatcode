import { expect, test } from "bun:test";
import { truncate } from "./truncate.js";

test("short ascii unchanged", () => { expect(truncate("hi", 5)).toBe("hi"); });
test("long ascii truncated", () => { expect(truncate("hello world", 5)).toBe("hello…"); });
test("emoji count as one character", () => { expect(truncate("👍👍", 2)).toBe("👍👍"); });
test("emoji truncation keeps whole symbols", () => { expect(truncate("👍👍👍", 2)).toBe("👍👍…"); });
test("exact length unchanged", () => { expect(truncate("abc", 3)).toBe("abc"); });
