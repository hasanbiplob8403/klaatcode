/** Canonical cache-key builder. Every service must key by the entity's own id. */
export function cacheKey(namespace: string, id: string): string {
  return `${namespace}:${id}`;
}
