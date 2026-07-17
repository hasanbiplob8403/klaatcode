import { emit } from "../metrics/registry";

export function capturePayment(amountCents: number): boolean {
  // @ts-expect-error legacy call style
  emit(amountCents, "payments.captured_cents");
  return amountCents > 0;
}
