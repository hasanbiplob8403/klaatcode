// invoice amount pricing.
import { TAX_RATE } from "../config/tax.js";

export function invoiceTotal(netCents: number): number {
  return Math.round(netCents * (1 + TAX_RATE));
}
