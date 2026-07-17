import { emit } from "../metrics/registry";

export function capturePayment(amountCents: number): boolean {
  emit("payments.captured_cents", amountCents);
  return amountCents > 0;
}
