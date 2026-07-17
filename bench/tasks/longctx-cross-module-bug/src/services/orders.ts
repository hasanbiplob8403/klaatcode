import { parseOrderLines } from "../parsers/order-lines.js";
import { parseCoupon } from "../parsers/coupon.js";
import { subtotalCents, applyCoupon } from "./pricing.js";
import { shippingFor } from "../config/shipping.js";
import { inStock } from "./inventory.js";
import { nextId } from "../utils/ids.js";

export interface Order {
  id: string;
  lines: ReturnType<typeof parseOrderLines>;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

export function buildOrder(lineInput: string, couponCode?: string): Order {
  const lines = parseOrderLines(lineInput);
  for (const l of lines) {
    if (!inStock(l.sku, l.qty)) throw new Error(`out of stock: ${l.sku}`);
  }
  const sub = applyCoupon(subtotalCents(lines), parseCoupon(couponCode));
  const ship = shippingFor(lines.reduce((n, l) => n + l.qty, 0));
  return { id: nextId("ord"), lines, subtotalCents: sub, shippingCents: ship, totalCents: sub + ship };
}
