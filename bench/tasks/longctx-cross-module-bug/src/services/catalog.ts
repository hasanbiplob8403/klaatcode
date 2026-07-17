import { CATALOG, type CatalogItem } from "../config/catalog.js";
export function findItem(sku: string): CatalogItem {
  const item = CATALOG.find(i => i.sku === sku);
  if (!item) throw new Error(`unknown sku ${sku}`);
  return item;
}
