import { expect, test } from "bun:test";
import { charBudgetForWindow, compactMessagesForApi } from "./compaction.js";
import type { Message } from "../api/client.js";

test("charBudgetForWindow: no window → full 240K default", () => {
  expect(charBudgetForWindow()).toBe(240_000);
  expect(charBudgetForWindow(0)).toBe(240_000);
});

test("charBudgetForWindow: large windows stay capped at 240K", () => {
  expect(charBudgetForWindow(131_000)).toBe(240_000);
  expect(charBudgetForWindow(200_000)).toBe(240_000);
});

test("charBudgetForWindow: small tier windows shrink the budget", () => {
  // nano 16K: (16000-8000) * 4 * 0.85 = 27_200
  expect(charBudgetForWindow(16_000)).toBe(27_200);
  // fast 32K: (32000-8000) * 4 * 0.85 = 81_600
  expect(charBudgetForWindow(32_000)).toBe(81_600);
  // pathological tiny window still leaves a floor
  expect(charBudgetForWindow(1_000)).toBe(13_600);
});

function mkHistory(turns: number, toolChars: number): Message[] {
  const msgs: Message[] = [{ role: "system", content: "sys" }];
  for (let i = 0; i < turns; i++) {
    msgs.push({ role: "user", content: `q${i}` });
    msgs.push({
      role: "assistant", content: `a${i}`,
      tool_calls: [{ id: `c${i}`, type: "function", function: { name: "grep", arguments: "{}" } }],
    } as Message);
    msgs.push({ role: "tool", content: "x".repeat(toolChars), tool_call_id: `c${i}` } as Message);
  }
  return msgs;
}

test("small window compacts harder than default", () => {
  const msgs = mkHistory(20, 3_000);
  const chars = (r: Message[]) =>
    r.reduce((s, m) => s + (typeof m.content === "string" ? m.content.length : 0), 0);
  const wide = compactMessagesForApi(msgs);
  const nano = compactMessagesForApi(msgs, 16_000);
  expect(chars(nano)).toBeLessThan(chars(wide));
  expect(chars(nano)).toBeLessThanOrEqual(charBudgetForWindow(16_000));
});

test("system seed survives tight-budget compaction", () => {
  const msgs = mkHistory(30, 5_000);
  const out = compactMessagesForApi(msgs, 16_000);
  expect(out[0]!.role).toBe("system");
  expect(out[0]!.content).toBe("sys");
});
