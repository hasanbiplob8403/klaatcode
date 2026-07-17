import { describe, expect, test } from "bun:test";
import { fuzzyScore } from "./dialog.js";

describe("fuzzyScore", () => {
  test("rejects non-subsequence", () => {
    expect(fuzzyScore("xyz", "src/main.tsx")).toBe(-1);
    expect(fuzzyScore("replz", "screens/repl.ts")).toBe(-1);
  });

  test("matches subsequence and exact substring", () => {
    expect(fuzzyScore("repl", "screens/repl.ts")).toBeGreaterThan(0);
    expect(fuzzyScore("srepl", "screens/repl.ts")).toBeGreaterThan(0);
  });

  test("segment-start match beats scattered match", () => {
    const tight = fuzzyScore("repl", "screens/repl.ts");
    const scattered = fuzzyScore("repl", "rate-explain-plugin.ts");
    expect(tight).toBeGreaterThan(scattered);
  });

  test("shorter target wins on equal match", () => {
    expect(fuzzyScore("main", "main.tsx")).toBeGreaterThan(fuzzyScore("main", "some/deep/dir/main.tsx"));
  });

  test("case-insensitive; empty query matches all", () => {
    expect(fuzzyScore("README", "readme.md")).toBeGreaterThan(0);
    expect(fuzzyScore("", "anything")).toBe(0);
  });
});
