import type { Product } from "../models/product";

const PRODUCTS: Record<string, Product> = {
  p1: { id: "p1", name: "Widget", priceCents: 1999 },
  p2: { id: "p2", name: "Gadget", priceCents: 4999 },
};

export async function fetchProduct(id: string): Promise<Product> {
  const p = PRODUCTS[id];
  if (!p) throw new Error(`no such product: ${id}`);
  return { ...p };
}
