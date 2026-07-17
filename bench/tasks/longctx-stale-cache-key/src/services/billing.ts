import { cacheGet, cacheSet } from "../cache/store";
import { cacheKey } from "../cache/keys";
import { fetchOrg } from "../db/orgs";

const PLAN_PRICE_CENTS: Record<string, number> = { free: 0, pro: 2900, enterprise: 9900 };

export async function monthlyPriceCents(orgId: string): Promise<number> {
  const key = cacheKey("billing", orgId);
  const cached = cacheGet<number>(key);
  if (cached !== undefined) return cached;
  const org = await fetchOrg(orgId);
  const price = PLAN_PRICE_CENTS[org.plan] ?? 0;
  cacheSet(key, price);
  return price;
}
