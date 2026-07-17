import { emit } from "../metrics/registry";

export function createOrder(totalCents: number): { totalCents: number } {
  // @ts-expect-error legacy call style
  emit(1, "orders.created");
  // @ts-expect-error legacy call style
  emit(totalCents, "orders.total_cents");
  return { totalCents };
}
