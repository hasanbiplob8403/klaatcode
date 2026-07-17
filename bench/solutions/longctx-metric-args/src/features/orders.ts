import { emit } from "../metrics/registry";

export function createOrder(totalCents: number): { totalCents: number } {
  emit("orders.created", 1);
  emit("orders.total_cents", totalCents);
  return { totalCents };
}
