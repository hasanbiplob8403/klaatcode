// sales quote pricing.
import { TAX_RATE } from "../config/tax.js";

export function quoteTotal(netCents: number): number {
  return Math.round(netCents * (1 + TAX_RATE));
}
