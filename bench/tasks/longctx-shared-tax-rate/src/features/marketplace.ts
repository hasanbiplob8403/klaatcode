// marketplace listing pricing.
const TAX_RATE = 0.18; // stale local copy — predates the 2026 rate change

export function marketplaceTotal(netCents: number): number {
  return Math.round(netCents * (1 + TAX_RATE));
}
