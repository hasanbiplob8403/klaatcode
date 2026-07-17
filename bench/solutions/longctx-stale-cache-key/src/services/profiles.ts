import { cacheGet, cacheSet } from "../cache/store";
import { cacheKey } from "../cache/keys";
import { fetchUser } from "../db/users";
import { fetchOrg } from "../db/orgs";
import type { Profile } from "../models/user";

export async function loadProfile(userId: string): Promise<Profile> {
  const user = await fetchUser(userId);
  const key = cacheKey("profile", user.id);
  const cached = cacheGet<Profile>(key);
  if (cached) return cached;
  const org = await fetchOrg(user.orgId);
  const profile: Profile = {
    userId: user.id,
    name: user.name,
    email: user.email,
    orgName: org.name,
  };
  cacheSet(key, profile);
  return profile;
}
