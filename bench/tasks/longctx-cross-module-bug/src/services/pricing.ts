import { toMinorUnits } from "../utils/currency.js";
import { findItem } from "./catalog.js";
import type { OrderLine } from "../parsers/order-lines.js";
import type { Coupon } from "../parsers/coupon.js";

/** Sum of line prices in minor units (cents). */
export function subtotalCents(lines: OrderLine[]): number {
  return lines.reduce((acc, l) => acc + toMinorUnits(findItem(l.sku).priceUsd) * l.qty, 0);
}

export function applyCoupon(cents: number, coupon: Coupon | null): number {
  if (!coupon) return cents;
  return Math.round(cents * (100 - coupon.percentOff) / 100);
}
