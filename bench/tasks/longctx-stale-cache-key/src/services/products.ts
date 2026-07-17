import { cacheGet, cacheSet } from "../cache/store";
import { cacheKey } from "../cache/keys";
import { fetchProduct } from "../db/products";
import type { Product } from "../models/product";

export async function loadProduct(productId: string): Promise<Product> {
  const key = cacheKey("product", productId);
  const cached = cacheGet<Product>(key);
  if (cached) return cached;
  const product = await fetchProduct(productId);
  cacheSet(key, product);
  return product;
}
