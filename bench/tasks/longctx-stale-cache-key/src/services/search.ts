import { cacheGet, cacheSet } from "../cache/store";
import { cacheKey } from "../cache/keys";

export function recentSearches(userId: string): string[] {
  return cacheGet<string[]>(cacheKey("searches", userId)) ?? [];
}

export function recordSearch(userId: string, query: string): void {
  const key = cacheKey("searches", userId);
  const prev = cacheGet<string[]>(key) ?? [];
  cacheSet(key, [query, ...prev].slice(0, 10));
}
