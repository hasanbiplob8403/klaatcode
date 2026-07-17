import { expect, test } from "bun:test";
import { KlaatAIClient } from "./client.js";

test("parseQuotaHeaders reads weighted units + legacy + plan/tier", () => {
  const h = new Headers({
    "X-KlaatAI-Units-Used": "42.5",
    "X-KlaatAI-Units-Limit": "150",
    "X-KlaatAI-Quota-Used": "30",
    "X-KlaatAI-Quota-Limit": "75",
    "X-KlaatAI-Quota-Plan": "pro",
    "X-KlaatAI-Tier": "code",
  });
  const q = KlaatAIClient.parseQuotaHeaders(h);
  expect(q).not.toBeNull();
  expect(q!.unitsUsed).toBe(42.5);
  expect(q!.unitsLimit).toBe(150);
  expect(q!.requestsUsed).toBe(30);
  expect(q!.plan).toBe("pro");
  expect(q!.tier).toBe("code");
});

test("parseQuotaHeaders returns null when no headers present", () => {
  expect(KlaatAIClient.parseQuotaHeaders(new Headers())).toBeNull();
});

test("parseQuotaHeaders tolerates a partial subset", () => {
  const q = KlaatAIClient.parseQuotaHeaders(new Headers({ "X-KlaatAI-Units-Used": "5" }));
  expect(q).not.toBeNull();
  expect(q!.unitsUsed).toBe(5);
  expect(q!.unitsLimit).toBeUndefined();
  expect(q!.plan).toBeUndefined();
});

test("parseQuotaHeaders ignores non-numeric unit values", () => {
  const q = KlaatAIClient.parseQuotaHeaders(new Headers({ "X-KlaatAI-Units-Used": "n/a", "X-KlaatAI-Quota-Plan": "free" }));
  expect(q).not.toBeNull();
  expect(q!.unitsUsed).toBeUndefined();
  expect(q!.plan).toBe("free");
});
