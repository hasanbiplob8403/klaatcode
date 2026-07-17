/** Flat shipping in minor units by weight class. */
export const SHIPPING_CENTS: Record<string, number> = {
  light: 499, standard: 799, heavy: 1499,
};
export function shippingFor(itemCount: number): number {
  return itemCount >= 3 ? SHIPPING_CENTS["standard"]! : SHIPPING_CENTS["light"]!;
}
