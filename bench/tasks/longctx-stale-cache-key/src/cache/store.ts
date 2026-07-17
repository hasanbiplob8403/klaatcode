const store = new Map<string, { value: unknown; expiresAt: number }>();

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) { store.delete(key); return undefined; }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs = 60_000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheClear(): void { store.clear(); }
