import { cacheGet, cacheSet } from "../cache/store";
import { cacheKey } from "../cache/keys";
import { fetchUser } from "../db/users";
import { fetchOrg } from "../db/orgs";

const PLAN_PERMS: Record<string, string[]> = {
  free: ["read"],
  pro: ["read", "write"],
  enterprise: ["read", "write", "admin"],
};

export async function permissionsFor(userId: string): Promise<string[]> {
  const key = cacheKey("perms", userId);
  const cached = cacheGet<string[]>(key);
  if (cached) return cached;
  const user = await fetchUser(userId);
  const org = await fetchOrg(user.orgId);
  const perms = PLAN_PERMS[org.plan] ?? ["read"];
  cacheSet(key, perms);
  return perms;
}
