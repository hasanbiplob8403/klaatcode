import { cacheGet, cacheSet } from "../cache/store";
import { cacheKey } from "../cache/keys";

export function avatarUrl(userId: string): string {
  const key = cacheKey("avatar", userId);
  const cached = cacheGet<string>(key);
  if (cached) return cached;
  const url = `https://cdn.example.com/avatars/${userId}.png`;
  cacheSet(key, url, 24 * 60 * 60_000);
  return url;
}
