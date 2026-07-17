import { describe, expect, test } from "bun:test";
import { checkoutTotal } from "./features/checkout.js";
import { invoiceTotal } from "./features/invoices.js";
import { quoteTotal } from "./features/quotes.js";
import { subscriptionTotal } from "./features/subscriptions.js";
import { refundTotal } from "./features/refunds.js";
import { giftCardTotal } from "./features/gift-cards.js";
import { marketplaceTotal } from "./features/marketplace.js";
import { wholesaleTotal } from "./features/wholesale.js";
import { TAX_RATE } from "./config/tax.js";

describe("shared tax rate", () => {
  test("authoritative rate is 12%", () => {
    expect(TAX_RATE).toBe(0.12);
  });

  test("checkout uses the shared 12% rate", () => {
    expect(checkoutTotal(10000)).toBe(11200);
    expect(checkoutTotal(2599)).toBe(Math.round(2599 * 1.12));
  });

  test("invoices uses the shared 12% rate", () => {
    expect(invoiceTotal(10000)).toBe(11200);
    expect(invoiceTotal(2599)).toBe(Math.round(2599 * 1.12));
  });

  test("quotes uses the shared 12% rate", () => {
    expect(quoteTotal(10000)).toBe(11200);
    expect(quoteTotal(2599)).toBe(Math.round(2599 * 1.12));
  });

  test("subscriptions uses the shared 12% rate", () => {
    expect(subscriptionTotal(10000)).toBe(11200);
    expect(subscriptionTotal(2599)).toBe(Math.round(2599 * 1.12));
  });

  test("refunds uses the shared 12% rate", () => {
    expect(refundTotal(10000)).toBe(11200);
    expect(refundTotal(2599)).toBe(Math.round(2599 * 1.12));
  });

  test("gift-cards uses the shared 12% rate", () => {
    expect(giftCardTotal(10000)).toBe(11200);
    expect(giftCardTotal(2599)).toBe(Math.round(2599 * 1.12));
  });

  test("marketplace uses the shared 12% rate", () => {
    expect(marketplaceTotal(10000)).toBe(11200);
    expect(marketplaceTotal(2599)).toBe(Math.round(2599 * 1.12));
  });

  test("wholesale uses the shared 12% rate", () => {
    expect(wholesaleTotal(10000)).toBe(11200);
    expect(wholesaleTotal(2599)).toBe(Math.round(2599 * 1.12));
  });
});
