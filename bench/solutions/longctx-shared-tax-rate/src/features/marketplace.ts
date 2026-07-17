// marketplace listing pricing.
import { TAX_RATE } from "../config/tax.js";

export function marketplaceTotal(netCents: number): number {
  return Math.round(netCents * (1 + TAX_RATE));
}
