/**
 * PollingEngine — skeleton for future safe realtime device monitoring.
 *
 * Current mode: "mock-safe"
 *   startPolling() and stopPolling() are safe no-ops.
 *   No intervals are created. No device connections are made. CPU cost: zero.
 *
 * ─── Architecture rules (read before adding real polling) ────────────────────
 *
 *   1. FRONTEND MUST READ FROM CACHE — NEVER POLL DEVICES DIRECTLY.
 *      All browser clients read /api/olts, /api/onus, /api/alarms.
 *      Those endpoints serve from TtlCache. The PollingEngine is the sole
 *      writer to that cache. This pattern means 1 000 browser tabs generate
 *      the same SNMP load as 1 tab — zero extra device traffic.
 *
 *   2. REAL SNMP RUNS THROUGH THE ADAPTER QUEUE ONLY.
 *      When live polling is enabled, VendorAdapter.pollOlt() calls are
 *      enqueued per-OLT (max concurrency: 1 per OLT). This prevents
 *      thundering-herd timeouts when many OLTs are slow simultaneously.
 *      Never call adapter methods directly from route handlers.
 *
 *   3. NO AUTO-START.
 *      The engine does NOT start on import. Call pollingEngine.start()
 *      explicitly from the app bootstrap after all adapters are registered
 *      and the DB connection is confirmed healthy.
 *
 *   4. GRACEFUL SHUTDOWN.
 *      Call pollingEngine.stop() in the SIGTERM handler before process.exit()
 *      so in-flight SNMP requests have time to complete or time out cleanly.
 *
 * ─── Polling interval constants ──────────────────────────────────────────────
 *
 *   OLT status check    → every 60 s    (OLT_STATUS_INTERVAL)
 *   ONU status check    → every 120 s   (ONU_STATUS_INTERVAL)
 *   Alarm table check   → every 30 s    (ALARM_CHECK_INTERVAL)
 *
 *   Stagger: each OLT's first poll is offset by (index / total) × interval
 *   so all OLTs don't fire simultaneously on startup.
 *
 *   Back-off: on consecutive failures, interval doubles (max 5 min).
 *   After 3 consecutive failures the OLT status is set to "unreachable"
 *   and its polling is suspended until manually re-enabled.
 *
 * ─── Cache TTL constants ─────────────────────────────────────────────────────
 *
 *   OLT cache TTL    → 60 s    (OLT_CACHE_TTL)   — 1× poll interval
 *   ONU cache TTL    → 120 s   (ONU_CACHE_TTL)   — 1× poll interval
 *   Alarm cache TTL  → 30 s    (ALARM_CACHE_TTL) — 1× poll interval
 *
 *   TTL = 1× interval so a missed poll causes cache expiry and a fresh poll
 *   is triggered on the next API read (cache-miss path in services).
 *
 * ─── TODO when enabling live polling ─────────────────────────────────────────
 *   - Add net-snmp or snmp-native dependency
 *   - Implement _pollOlt()   → adapterRegistry.get(vendor).getOltInfo()
 *   - Implement _pollOnus()  → adapterRegistry.get(vendor).getOnuList()
 *   - Implement _pollAlarms()→ adapterRegistry.get(vendor).pollAlarms()
 *   - Load OLT list from DB in start(), call registerOlt() for each
 *   - Emit "olt:updated", "onu:updated", "alarm:raised", "alarm:cleared"
 *     for WebSocket push to connected browser clients
 */

import { EventEmitter } from "events";

// ─── Interval constants (ms) ───────────────────────────────────────────────

/** How often to refresh OLT system info (CPU, mem, temp, port counts). */
export const OLT_STATUS_INTERVAL  = 60_000;   //  60 s

/** How often to refresh ONU status and optical measurements. */
export const ONU_STATUS_INTERVAL  = 120_000;  // 120 s

/** How often to check the OLT alarm / event table. */
export const ALARM_CHECK_INTERVAL = 30_000;   //  30 s

// ─── Cache TTL constants (ms) ─────────────────────────────────────────────

/**
 * OLT data lives in cache for this long before being considered stale.
 * Equals one polling interval so a missed poll causes a fresh read on
 * the next cache miss rather than serving indefinitely stale data.
 */
export const OLT_CACHE_TTL   = OLT_STATUS_INTERVAL;   // 60 000 ms

/**
 * ONU data cache TTL. Matches ONU polling interval.
 * ONUs are polled less frequently to limit SNMP load on large deployments.
 */
export const ONU_CACHE_TTL   = ONU_STATUS_INTERVAL;   // 120 000 ms

/**
 * Alarm data cache TTL. Matches alarm polling interval.
 * Short TTL ensures alarm clears propagate within one check cycle.
 */
export const ALARM_CACHE_TTL = ALARM_CHECK_INTERVAL;  //  30 000 ms

// ─── Polling mode ─────────────────────────────────────────────────────────

export type PollingMode = "mock-safe" | "live";

const POLLING_MODE: PollingMode = "mock-safe";

// ─── Status shape ─────────────────────────────────────────────────────────

export interface PollingStatus {
  /** Whether the engine is currently running (timers active). */
  running: boolean;

  /** Current operational mode. */
  mode: PollingMode;

  /** Number of OLTs currently registered for polling. */
  registeredOlts: number;

  /** Interval constants in use (ms). */
  intervals: {
    oltStatusMs: number;
    onuStatusMs: number;
    alarmCheckMs: number;
  };

  /** Cache TTLs in use (ms). */
  cacheTtls: {
    oltMs: number;
    onuMs: number;
    alarmMs: number;
  };

  /** ISO 8601 timestamp of when polling was last started, or null. */
  startedAt: string | null;

  /** ISO 8601 timestamp of when polling was last stopped, or null. */
  stoppedAt: string | null;

  /** Human-readable note explaining the current mode. */
  note: string;
}

// ─── Engine ───────────────────────────────────────────────────────────────

export class PollingEngine extends EventEmitter {
  private _running  = false;
  private _startedAt: string | null = null;
  private _stoppedAt: string | null = null;

  // Timer handles — populated when live polling is enabled
  private _oltTimers   = new Map<string, ReturnType<typeof setInterval>>();
  private _onuTimers   = new Map<string, ReturnType<typeof setInterval>>();
  private _alarmTimers = new Map<string, ReturnType<typeof setInterval>>();

  /**
   * Start the polling engine.
   *
   * In "mock-safe" mode this is a safe no-op — no timers are created,
   * no device connections are made, and no SNMP traffic is generated.
   *
   * In "live" mode (future): loads the OLT list from DB, registers each
   * OLT with staggered start times, and activates all polling loops.
   */
  start(): void {
    if (this._running) return;

    if (POLLING_MODE === "mock-safe") {
      // Intentional no-op — see module comment for rationale.
      // Set running=true so status reflects the intent, but no timers fire.
      this._running  = true;
      this._startedAt = new Date().toISOString();
      return;
    }

    // TODO (live mode):
    //   1. Confirm DB connection healthy
    //   2. Load all OltPollRequests from DB
    //   3. For each OLT, call registerOlt(request, staggerOffset)
    //   4. Set this._running = true
    this._running  = true;
    this._startedAt = new Date().toISOString();
  }

  /**
   * Stop the polling engine and clear all active timers.
   *
   * In "mock-safe" mode this is a safe no-op.
   * In "live" mode: clears all OLT/ONU/alarm timers and waits for
   * any in-flight adapter calls to drain before returning.
   */
  stop(): void {
    if (!this._running) return;

    // Clear all active timers (no-op in mock-safe since none were created)
    for (const timer of this._oltTimers.values())   clearInterval(timer);
    for (const timer of this._onuTimers.values())   clearInterval(timer);
    for (const timer of this._alarmTimers.values()) clearInterval(timer);

    this._oltTimers.clear();
    this._onuTimers.clear();
    this._alarmTimers.clear();

    this._running   = false;
    this._stoppedAt = new Date().toISOString();
  }

  /**
   * Returns a snapshot of the current engine state.
   * Safe to call at any time with no side effects.
   */
  getPollingStatus(): PollingStatus {
    return {
      running: this._running,
      mode: POLLING_MODE,
      registeredOlts: this._oltTimers.size,
      intervals: {
        oltStatusMs:  OLT_STATUS_INTERVAL,
        onuStatusMs:  ONU_STATUS_INTERVAL,
        alarmCheckMs: ALARM_CHECK_INTERVAL,
      },
      cacheTtls: {
        oltMs:   OLT_CACHE_TTL,
        onuMs:   ONU_CACHE_TTL,
        alarmMs: ALARM_CACHE_TTL,
      },
      startedAt:  this._startedAt,
      stoppedAt:  this._stoppedAt,
      note: POLLING_MODE === "mock-safe"
        ? "Mock-safe mode: no timers active, no device connections, zero CPU overhead. Real SNMP polling will run through the adapter queue when mode is set to 'live'."
        : "Live mode: polling is active. All device calls run through the adapter queue.",
    };
  }

  isRunning(): boolean {
    return this._running;
  }

  /**
   * Remove a single OLT from all poll schedules and clear its timers.
   * Safe to call in mock-safe mode (no timers exist, map deletes are no-ops).
   */
  deregisterOlt(oltId: string): void {
    const timers = [this._oltTimers, this._onuTimers, this._alarmTimers];
    for (const map of timers) {
      const t = map.get(oltId);
      if (t) clearInterval(t);
      map.delete(oltId);
    }
  }

  // ── Private polling methods (to be implemented for live mode) ─────────────

  /** @internal */
  private async _pollOlt(_oltId: string): Promise<void> {
    // TODO (live mode):
    //   1. adapterRegistry.get(vendor).getOltInfo()
    //   2. normalizeOlt(result)
    //   3. oltCache.set(oltId, normalized, OLT_CACHE_TTL)
    //   4. this.emit("olt:updated", normalized)
  }

  /** @internal */
  private async _pollOnus(_oltId: string): Promise<void> {
    // TODO (live mode):
    //   1. adapterRegistry.get(vendor).getOnuList()
    //   2. For each ONU: normalizeOnu + onuCache.set(onuId, ..., ONU_CACHE_TTL)
    //   3. this.emit("onu:updated", normalized)
  }

  /** @internal */
  private async _pollAlarms(_oltId: string): Promise<void> {
    // TODO (live mode):
    //   1. adapterRegistry.get(vendor).pollAlarms()
    //   2. normalizeAlarms(results)
    //   3. Diff against alarmCache to detect raise/clear transitions
    //   4. alarmCache.set(oltId, active, ALARM_CACHE_TTL)
    //   5. this.emit("alarm:raised" | "alarm:cleared", alarm)
  }
}

/** Singleton engine — import across services and route files. */
export const pollingEngine = new PollingEngine();
