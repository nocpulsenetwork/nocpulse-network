/**
 * Cache — in-memory TTL cache for polled device data.
 *
 * Keeps the last good known state for each OLT/ONU so that
 * the API can serve stale-but-fast data while a poll is in flight.
 *
 * Eviction: LRU with configurable max entries (default 10 000).
 *
 * TODO:
 *  - Replace with Redis when horizontal scaling is needed
 *  - Add per-entry TTL tracking (OLT: 90 s, ONU: 150 s, alarm: 45 s)
 *  - Add hit/miss metrics
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // ms epoch
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= this.maxEntries) {
      // Evict the oldest entry (Map preserves insertion order)
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  /** Remove all expired entries. Call periodically to free memory. */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        purged++;
      }
    }
    return purged;
  }
}

// Singleton caches — TTLs align with polling intervals
import type { OltNormalized } from "../types/olt.types";
import type { OnuNormalized } from "../types/onu.types";
import type { AlarmNormalized } from "../types/alarm.types";

export const oltCache    = new TtlCache<OltNormalized>(1_000);   // max 1 000 OLTs
export const onuCache    = new TtlCache<OnuNormalized>(100_000); // max 100 k ONUs
export const alarmCache  = new TtlCache<AlarmNormalized[]>(1_000);
