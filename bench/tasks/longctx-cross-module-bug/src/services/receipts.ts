import { formatUsd } from "../utils/currency.js";
import type { Order } from "./orders.js";
export function receiptText(o: Order): string {
  return [
    `Order ${o.id}`,
    ...o.lines.map(l => `  ${l.sku} x${l.qty}`),
    `Subtotal: ${formatUsd(o.subtotalCents)}`,
    `Shipping: ${formatUsd(o.shippingCents)}`,
    `Total: ${formatUsd(o.totalCents)}`,
  ].join("\n");
}
