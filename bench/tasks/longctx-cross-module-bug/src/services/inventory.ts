const STOCK: Record<string, number> = { "KB-01": 12, "MS-02": 40, "MN-03": 5, "HD-04": 18, "CB-05": 100 };
export function inStock(sku: string, qty: number): boolean {
  return (STOCK[sku] ?? 0) >= qty;
}
export function reserve(sku: string, qty: number): void {
  if (!inStock(sku, qty)) throw new Error(`insufficient stock for ${sku}`);
  STOCK[sku]! -= qty;
}
