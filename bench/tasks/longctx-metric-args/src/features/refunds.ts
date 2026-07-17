import { emit } from "../metrics/registry";

export function issueRefund(amountCents: number): number {
  emit("refunds.issued", 1);
  emit("refunds.amount_cents", amountCents);
  return amountCents;
}
