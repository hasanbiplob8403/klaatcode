// refund amount pricing.
import { TAX_RATE } from "../config/tax.js";

export function refundTotal(netCents: number): number {
  return Math.round(netCents * (1 + TAX_RATE));
}
