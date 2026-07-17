import { expect, test } from "bun:test";
import { canTransition, transition } from "./order.js";

test("pending can be paid", () => { expect(canTransition("pending", "paid")).toBe(true); });
test("pending can be cancelled", () => { expect(canTransition("pending", "cancelled")).toBe(true); });
test("paid can be cancelled", () => { expect(canTransition("paid", "cancelled")).toBe(true); });
test("paid can be shipped", () => { expect(canTransition("paid", "shipped")).toBe(true); });
test("shipped cannot be cancelled", () => { expect(canTransition("shipped", "cancelled")).toBe(false); });
test("cancelled is terminal", () => { expect(canTransition("cancelled", "pending")).toBe(false); });
test("delivered is terminal", () => { expect(canTransition("delivered", "pending")).toBe(false); });
test("shipped can be delivered", () => { expect(transition("shipped", "delivered")).toBe("delivered"); });
test("invalid transition throws", () => {
  expect(() => transition("delivered", "pending")).toThrow();
});
