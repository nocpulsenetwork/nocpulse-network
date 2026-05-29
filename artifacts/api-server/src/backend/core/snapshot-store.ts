/**
 * Snapshot Store — lightweight in-memory snapshot storage.
 *
 * Different from TtlCache: snapshots never auto-expire.
 * Each entry carries metadata the frontend needs:
 *   - lastUpdated  — ISO 8601 timestamp of the last write
 *   - source       — where the data came from
 *   - stale        — true when the snapshot pre-dates the last poll request
 *
 * Lifecycle:
 *   1. Polling engine writes a snapshot after a successful poll → source: "manual-polling", stale: false
 *   2. If no poll has run yet, cache routes return mock fallback   → source: "mock", stale: true
 *
 * Rule: the frontend must never call OLT devices directly.
 * It reads from /api/cache/* and trusts the stale flag.
 */

import type { UniversalOLT, UniversalONU } from "../types/universal.types";
import type { DetectedAlarm } from "../services/alarm-detector";

// ─── Types ─────────────────────────────────────────────────────────────────

export type SnapshotSource = "manual-polling" | "mock";

export interface Snapshot<T> {
  data: T;
  lastUpdated: string;  // ISO 8601
  source: SnapshotSource;
  stale: boolean;
}

// ─── Store class ───────────────────────────────────────────────────────────

export class SnapshotStore<T> {
  private readonly store = new Map<string, Snapshot<T>>();

  /**
   * Write or overwrite a snapshot entry.
   * Sets stale: false and records the current timestamp.
   */
  write(key: string, data: T, source: SnapshotSource): void {
    this.store.set(key, {
      data,
      lastUpdated: new Date().toISOString(),
      source,
      stale: false,
    });
  }

  /** Read a snapshot entry. Returns undefined if the key has never been written. */
  read(key: string): Snapshot<T> | undefined {
    return this.store.get(key);
  }

  /** Mark a single entry as stale (e.g. after a new poll was requested). */
  markStale(key: string): void {
    const entry = this.store.get(key);
    if (entry) entry.stale = true;
  }

  /** Mark every entry as stale. */
  markAllStale(): void {
    for (const entry of this.store.values()) {
      entry.stale = true;
    }
  }

  keys(): string[] {
    return [...this.store.keys()];
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

// ─── Singleton stores ──────────────────────────────────────────────────────

/** Full list of OLTs — key: "all" */
export const oltListStore = new SnapshotStore<UniversalOLT[]>();

/** Single OLT detail — key: oltId */
export const oltDetailStore = new SnapshotStore<UniversalOLT>();

/** Full list of ONUs — key: "all" or oltId for per-OLT slices */
export const onuListStore = new SnapshotStore<UniversalONU[]>();

/** Detected alarm list — key: "all" */
export const alarmListStore = new SnapshotStore<DetectedAlarm[]>();
