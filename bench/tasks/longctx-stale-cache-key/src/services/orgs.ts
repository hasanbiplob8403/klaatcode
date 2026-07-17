import { cacheGet, cacheSet } from "../cache/store";
import { cacheKey } from "../cache/keys";
import { fetchOrg } from "../db/orgs";
import type { Org } from "../models/org";

export async function loadOrg(orgId: string): Promise<Org> {
  const key = cacheKey("org", orgId);
  const cached = cacheGet<Org>(key);
  if (cached) return cached;
  const org = await fetchOrg(orgId);
  cacheSet(key, org);
  return org;
}
