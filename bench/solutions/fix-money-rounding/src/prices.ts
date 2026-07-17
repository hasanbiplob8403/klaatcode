export function cartTotal(prices: number[]): number {
  const cents = prices.reduce((sum, p) => sum + Math.round(p * 100), 0);
  return cents / 100;
}
