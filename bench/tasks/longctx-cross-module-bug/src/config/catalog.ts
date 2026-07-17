export interface CatalogItem { sku: string; name: string; priceUsd: number }
export const CATALOG: CatalogItem[] = [
  { sku: "KB-01", name: "Mechanical Keyboard", priceUsd: 89.99 },
  { sku: "MS-02", name: "Wireless Mouse",      priceUsd: 19.99 },
  { sku: "MN-03", name: "27in Monitor",        priceUsd: 249.5 },
  { sku: "HD-04", name: "USB-C Hub",           priceUsd: 34.95 },
  { sku: "CB-05", name: "Braided Cable",       priceUsd: 9.99 },
];
