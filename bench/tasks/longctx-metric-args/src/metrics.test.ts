import { test, expect, beforeEach } from "bun:test";
import { resetMetrics, totalFor, snapshot } from "./metrics/registry";
import { createOrder } from "./features/orders";
import { capturePayment } from "./features/payments";
import { adjustStock } from "./features/inventory";
import { postReview } from "./features/reviews";
import { recordLogin } from "./features/logins";
import { registerUser } from "./features/signups";
import { shipParcel } from "./features/shipping";
import { issueRefund } from "./features/refunds";

beforeEach(() => resetMetrics());

test("order metrics use the name-first emit signature", () => {
  createOrder(2500);
  createOrder(1500);
  expect(totalFor("orders.created")).toBe(2);
  expect(totalFor("orders.total_cents")).toBe(4000);
});

test("payment, inventory, review and login metrics are named strings", () => {
  capturePayment(999);
  adjustStock(-3);
  postReview(4);
  recordLogin("u1");
  expect(totalFor("payments.captured_cents")).toBe(999);
  expect(totalFor("inventory.adjusted")).toBe(-3);
  expect(totalFor("reviews.posted")).toBe(1);
  expect(totalFor("reviews.stars")).toBe(4);
  expect(totalFor("logins.count")).toBe(1);
});

test("every emitted metric has a string name and numeric value", () => {
  createOrder(100);
  capturePayment(200);
  adjustStock(5);
  postReview(5);
  recordLogin("u2");
  registerUser("x@example.com");
  shipParcel(2);
  issueRefund(300);
  for (const e of snapshot()) {
    expect(typeof e.name).toBe("string");
    expect(typeof e.value).toBe("number");
  }
});
