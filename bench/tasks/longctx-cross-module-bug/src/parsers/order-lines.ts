import { assertPositive } from "../utils/validation.js";
import { MAX_QUANTITY_PER_ITEM } from "../config/limits.js";

export interface OrderLine { sku: string; qty: number }

/** Parse "SKU xQTY, SKU xQTY" order shorthand. */
export function parseOrderLines(input: string): OrderLine[] {
  return input.split(",").map(part => {
    const m = /^\s*([A-Z]{2}-\d{2})\s*x(\d+)\s*$/.exec(part);
    if (!m) throw new Error(`bad order line: "${part.trim()}"`);
    const qty = Number(m[2]);
    assertPositive(qty, "qty");
    if (qty > MAX_QUANTITY_PER_ITEM) throw new Error(`qty ${qty} over limit`);
    return { sku: m[1]!, qty };
  });
}
