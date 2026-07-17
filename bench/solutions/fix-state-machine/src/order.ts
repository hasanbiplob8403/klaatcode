export type OrderState = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

const TRANSITIONS: Record<OrderState, OrderState[]> = {
  pending: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transition(from: OrderState, to: OrderState): OrderState {
  if (!canTransition(from, to)) throw new Error(`Invalid transition ${from} -> ${to}`);
  return to;
}
