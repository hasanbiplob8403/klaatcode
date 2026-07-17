import { cacheGet, cacheSet } from "../cache/store";
import { cacheKey } from "../cache/keys";

export interface NotificationPrefs { email: boolean; push: boolean }

const DEFAULTS: NotificationPrefs = { email: true, push: false };

export function prefsFor(userId: string): NotificationPrefs {
  const key = cacheKey("notif-prefs", userId);
  const cached = cacheGet<NotificationPrefs>(key);
  if (cached) return cached;
  cacheSet(key, DEFAULTS);
  return DEFAULTS;
}
