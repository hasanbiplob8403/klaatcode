// cartTotal(prices): sum of item prices in dollars, exact to the cent.
// Prices always have at most 2 decimal places. This implementation
// accumulates floating-point error.
export function cartTotal(prices: number[]): number {
  return prices.reduce((sum, p) => sum + p, 0);
}
