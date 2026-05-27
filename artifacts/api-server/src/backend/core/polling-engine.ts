/**
 * PollingEngine — orchestrates periodic device polling across all registered OLTs.
 *
 * Polling intervals (configurable via env vars, defaults below):
 *
 *   OLT system info   →  30–60 s  (POLL_OLT_INTERVAL_MS,   default 45 000)
 *   ONU status/optics →  60–120 s (POLL_ONU_INTERVAL_MS,   default 90 000)
 *   Alarm check       →  10–30 s  (POLL_ALARM_INTERVAL_MS, default 20 000)
 *
 * Design:
 *   - Each OLT gets its own staggered polling schedule to avoid SNMP bursts.
 *   - Stagger offset = (oltIndex / totalOlts) * intervalMs
 *   - Failed polls are retried with exponential back-off (max 3 retries).
 *   - Results are written to the shared TtlCache and emitted via EventEmitter
 *     so WebSocket handlers (future) can push live updates to the UI.
 *
 * TODO:
 *   - Implement OLT poll loop (pollOlt + normalizeOlt + oltCache.set)
 *   - Implement ONU poll loop (pollOnu + normalizeOnu + onuCache.set)
 *   - Implement alarm poll loop (pollAlarms + normalizeAlarms + alarmCache.set)
 *   - Implement stagger logic
 *   - Implement retry with exponential back-off
 *   - Emit "olt:updated", "onu:updated", "alarm:raised", "alarm:cleared" events
 *   - Add graceful shutdown (clearInterval + drain in-flight requests)
 */

import { EventEmitter } from "events";
import type { OltPollRequest } from "../types/olt.types";

const POLL_OLT_INTERVAL_MS   = Number(process.env["POLL_OLT_INTERVAL_MS"])   || 45_000;
const POLL_ONU_INTERVAL_MS   = Number(process.env["POLL_ONU_INTERVAL_MS"])   || 90_000;
const POLL_ALARM_INTERVAL_MS = Number(process.env["POLL_ALARM_INTERVAL_MS"]) || 20_000;

export class PollingEngine extends EventEmitter {
  private oltTimers   = new Map<string, ReturnType<typeof setInterval>>();
  private onuTimers   = new Map<string, ReturnType<typeof setInterval>>();
  private alarmTimers = new Map<string, ReturnType<typeof setInterval>>();
  private running = false;

  /**
   * Register an OLT for polling.
   * Starts three independent timers: OLT info, ONU sweep, alarm check.
   * Stagger is applied based on registration order to spread SNMP load.
   */
  registerOlt(request: OltPollRequest, staggerMs = 0): void {
    if (this.oltTimers.has(request.oltId)) return; // already registered

    // TODO: replace setTimeout + setInterval with actual poll calls
    setTimeout(() => {
      this.oltTimers.set(
        request.oltId,
        setInterval(() => {
          void this._pollOlt(request);
        }, POLL_OLT_INTERVAL_MS)
      );

      this.onuTimers.set(
        request.oltId,
        setInterval(() => {
          void this._pollOnus(request);
        }, POLL_ONU_INTERVAL_MS)
      );

      this.alarmTimers.set(
        request.oltId,
        setInterval(() => {
          void this._pollAlarms(request);
        }, POLL_ALARM_INTERVAL_MS)
      );
    }, staggerMs);
  }

  /** Remove an OLT from all poll schedules. */
  deregisterOlt(oltId: string): void {
    for (const timersMap of [this.oltTimers, this.onuTimers, this.alarmTimers]) {
      const timer = timersMap.get(oltId);
      if (timer) clearInterval(timer);
      timersMap.delete(oltId);
    }
  }

  start(): void {
    this.running = true;
    // TODO: load OLT list from DB and call registerOlt for each
  }

  stop(): void {
    this.running = false;
    for (const oltId of this.oltTimers.keys()) {
      this.deregisterOlt(oltId);
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  // ── Private poll methods (to be implemented) ─────────────────────────────

  private async _pollOlt(_request: OltPollRequest): Promise<void> {
    // TODO:
    //   1. adapterRegistry.get(request.vendor).pollOlt(request)
    //   2. normalizeOlt(result)
    //   3. oltCache.set(request.oltId, normalized, POLL_OLT_INTERVAL_MS * 2)
    //   4. this.emit("olt:updated", normalized)
  }

  private async _pollOnus(_request: OltPollRequest): Promise<void> {
    // TODO:
    //   1. Get ONU list from oltCache or DB
    //   2. For each ONU: adapterRegistry.get(vendor).pollOnu(onuRequest)
    //   3. normalizeOnu + onuCache.set
    //   4. this.emit("onu:updated", normalized)
  }

  private async _pollAlarms(_request: OltPollRequest): Promise<void> {
    // TODO:
    //   1. adapterRegistry.get(request.vendor).pollAlarms(request)
    //   2. normalizeAlarms(results)
    //   3. Diff against alarmCache to detect raise/clear transitions
    //   4. alarmCache.set + emit "alarm:raised" / "alarm:cleared"
  }
}

/** Singleton engine — import across services. */
export const pollingEngine = new PollingEngine();
