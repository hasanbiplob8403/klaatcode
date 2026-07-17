import { cacheGet, cacheSet } from "../cache/store";
import { cacheKey } from "../cache/keys";

export interface ActivityEvent { userId: string; kind: string; at: number }

export function recordActivity(userId: string, kind: string): void {
  const key = cacheKey("activity", userId);
  const prev = cacheGet<ActivityEvent[]>(key) ?? [];
  cacheSet(key, [...prev, { userId, kind, at: Date.now() }]);
}

export function activityFor(userId: string): ActivityEvent[] {
  return cacheGet<ActivityEvent[]>(cacheKey("activity", userId)) ?? [];
}
