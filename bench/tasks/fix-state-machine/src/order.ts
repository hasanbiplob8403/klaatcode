// Order lifecycle state machine.
// Valid transitions (the ONLY valid ones):
//   pending   → paid | cancelled
//   paid      → shipped | cancelled
//   shipped   → delivered
//   delivered and cancelled are terminal (no transitions out).
// This transition table has bugs — fix it to match the rules above.
export type OrderState = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

const TRANSITIONS: Record<OrderState, OrderState[]> = {
  pending: ["paid", "cancelled"],
  paid: ["shipped"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: ["pending"],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transition(from: OrderState, to: OrderState): OrderState {
  if (!canTransition(from, to)) throw new Error(`Invalid transition ${from} -> ${to}`);
  return to;
}
