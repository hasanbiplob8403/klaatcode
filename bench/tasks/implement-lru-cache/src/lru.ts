// LruCache: fixed-capacity key/value cache with least-recently-used eviction.
// - get(key): return the value or undefined; a hit makes the key most-recent.
// - set(key, value): insert or update (becomes most-recent); when the cache
//   grows past capacity, evict the least-recently-used key.
// - size: current number of entries.
// TODO: not implemented yet.
export class LruCache<K, V> {
  constructor(public readonly capacity: number) {}
  get size(): number { return 0; }
  get(_key: K): V | undefined { return undefined; }
  set(_key: K, _value: V): void {}
}
