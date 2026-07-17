// wholesale order pricing.
import { TAX_RATE } from "../config/tax.js";

export function wholesaleTotal(netCents: number): number {
  return Math.round(netCents * (1 + TAX_RATE));
}
