/**
 * PollingEngine — safe manual polling controller for real OLT monitoring.
 *
 * ─── Architecture rules ───────────────────────────────────────────────────────
 *
 *   1. FRONTEND MUST READ FROM CACHE — NEVER POLL DEVICES DIRECTLY.
 *      All browser clients read /api/olts, /api/onus, /api/alarms.
 *      Those endpoints serve from TtlCache. The PollingEngine is the sole
 *      writer to that cache. This pattern means 1 000 browser tabs generate
 *      the same SNMP load as 1 tab — zero extra device traffic.
 *
 *   2. REAL SNMP RUNS THROUGH THE POLLING ENGINE ONLY.
 *      Per-OLT timers call RealSnmpClient. Each timer creates a fresh SNMP
 *      session, reads, then closes. No persistent sessions between ticks.
 *      Never call RealSnmpClient directly from route handlers for polling.
 *
 *   3. NO AUTO-START.
 *      The engine does NOT start on import. Call pollingEngine.startOltPolling()
 *      explicitly with connection credentials. No polling fires on boot.
 *
 *   4. MANUAL ONLY.
 *      startOltPolling() is the only entry point. It requires explicit credentials
 *      per OLT. No polling begins until a POST /api/polling/start is received.
 *
 *   5. GRACEFUL SHUTDOWN.
 *      pollingEngine.stop() clears all OLT sessions and timers.
 *      Call it in the SIGTERM handler before process.exit().
 *
 *   6. SAFETY LIMITS.
 *      MAX_CONCURRENT_OLTS = 1 initially. Increase only after validating
 *      SNMP load on network infrastructure. No polling faster than 30 s.
 *
 *   7. READ-ONLY ONLY.
 *      All SNMP calls use GET / GETBULK only.
 *      No SET, no write commands, no device configuration changes.
 *
 * ─── Polling interval constants ───────────────────────────────────────────────
 *
 *   OLT status check → every  60 s   (OLT_STATUS_INTERVAL)
 *   ONU list check   → every 120 s   (ONU_STATUS_INTERVAL)
 *   Alarm check      → every  30 s   (ALARM_CHECK_INTERVAL)
 *
 *   Back-off: on 3 consecutive failures the OLT session is suspended and
 *   an "olt:unreachable" event is emitted. Resume by calling startOltPolling().
 *
 * ─── Cache TTL constants ──────────────────────────────────────────────────────
 *
 *   OLT cache TTL   → 60 s    (OLT_CACHE_TTL)
 *   ONU cache TTL   → 120 s   (ONU_CACHE_TTL)
 *   Alarm cache TTL → 30 s    (ALARM_CACHE_TTL)
 */

import { EventEmitter } from "events";
import { logger }        from "../../lib/logger";
import { RealSnmpClient } from "../snmp/real-snmp-client";

// ─── Interval constants (ms) ────────────────────────────────────────────────

/** How often to refresh OLT system info (connectivity, vendor, uptime). */
export const OLT_STATUS_INTERVAL  = 60_000;   //  60 s

/** How often to refresh ONU status list (online/offline counts, serial). */
export const ONU_STATUS_INTERVAL  = 120_000;  // 120 s

/** How often to check the OLT alarm/reachability state. */
export const ALARM_CHECK_INTERVAL = 30_000;   //  30 s

// ─── Cache TTL constants (ms) ───────────────────────────────────────────────

/** OLT data lives in cache for this long before being considered stale. */
export const OLT_CACHE_TTL   = OLT_STATUS_INTERVAL;

/** ONU data cache TTL. Matches ONU polling interval. */
export const ONU_CACHE_TTL   = ONU_STATUS_INTERVAL;

/** Alarm data cache TTL. Matches alarm polling interval. */
export const ALARM_CACHE_TTL = ALARM_CHECK_INTERVAL;

// ─── Safety limits ──────────────────────────────────────────────────────────

/**
 * Maximum number of OLTs that may be actively polled simultaneously.
 * Start at 1 and increase only after confirming SNMP load is acceptable
 * on both the network and the OLT management plane.
 */
const MAX_CONCURRENT_OLTS = 1;

/**
 * Minimum allowed polling interval (ms).
 * Enforced in code to prevent accidental sub-30 s polling.
 */
const MIN_INTERVAL_MS = 30_000;

/**
 * Consecutive SNMP failures before a session is auto-suspended.
 * After suspension, the OLT must be re-registered via startOltPolling().
 */
const MAX_CONSECUTIVE_FAILURES = 3;

// ─── Polling mode ───────────────────────────────────────────────────────────

export type PollingMode = "mock-safe" | "live";

// ─── Public request / status types ─────────────────────────────────────────

/**
 * Connection credentials required to start polling a single OLT.
 * All fields are stored only in memory for the lifetime of the session.
 */
export interface OltManualPollRequest {
  /** Unique OLT identifier — used as the session key. */
  oltId: string;

  /** OLT management IP address (IPv4 or IPv6). */
  ip: string;

  /**
   * SNMP community string.
   * Defaults to "public" if not supplied (not recommended for production).
   */
  community?: string;

  /**
   * Vendor name in SNMP MIB format: "Huawei" | "ZTE" | "BDCOM" | "VSOL" | "CDATA".
   * Used to select the correct MIB table for ONU reads.
   */
  vendor: string;

  /** SNMP UDP port. Defaults to 161. */
  port?: number;
}

/** Status of a single polling task (one interval loop). */
export interface OltTaskStatus {
  /** Polling interval for this task (ms). */
  intervalMs: number;

  /** ISO timestamp of the last successful or attempted run, or null if never run. */
  lastRunAt: string | null;

  /** ISO timestamp when the next run is expected. */
  nextRunAt: string;

  /** Total number of completed runs (success + failure). */
  runCount: number;

  /** Error message from the most recent failed run, or null if last run succeeded. */
  lastError: string | null;

  /** Number of consecutive failed runs. Resets to 0 on any success. */
  consecutiveFailures: number;
}

/** Full polling status for a single OLT session. */
export interface OltPollingStatus {
  /** OLT identifier. */
  oltId: string;

  /** Whether timers are actively running for this OLT. */
  running: boolean;

  /** ISO timestamp when polling was started, or null. */
  startedAt: string | null;

  /** Connection endpoint being polled (no community string for security). */
  endpoint: string;

  /** Tasks running for this OLT. */
  tasks: {
    oltStatus: OltTaskStatus;
    onuList:   OltTaskStatus;
    alarms:    OltTaskStatus;
  };

  /** Human-readable summary of current session state. */
  message: string;
}

/** Global engine status (all sessions summary). */
export interface PollingStatus {
  /** Whether the engine has been started (may have zero active sessions). */
  running: boolean;

  /** Current operational mode. */
  mode: PollingMode;

  /** Number of OLTs currently registered for polling. */
  registeredOlts: number;

  /** Maximum concurrent OLTs allowed by the safety limit. */
  maxConcurrentOlts: number;

  /** Interval constants in use (ms). */
  intervals: {
    oltStatusMs:  number;
    onuStatusMs:  number;
    alarmCheckMs: number;
  };

  /** Cache TTLs in use (ms). */
  cacheTtls: {
    oltMs:   number;
    onuMs:   number;
    alarmMs: number;
  };

  /** ISO timestamp when the engine was last started, or null. */
  startedAt: string | null;

  /** ISO timestamp when the engine was last stopped, or null. */
  stoppedAt: string | null;

  /** Summary of all active OLT sessions. */
  oltSessions: OltPollingStatus[];

  /** Human-readable note explaining the current mode / state. */
  note: string;
}

// ─── Internal session types ─────────────────────────────────────────────────

interface TaskStats {
  intervalMs:          number;
  lastRunAt:           Date | null;
  nextRunAt:           Date;
  runCount:            number;
  lastError:           string | null;
  consecutiveFailures: number;
}

interface OltSession {
  config:    Required<OltManualPollRequest>;  // all fields resolved to concrete values
  startedAt: Date;
  tasks: {
    oltStatus: TaskStats;
    onuList:   TaskStats;
    alarms:    TaskStats;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function taskStatsToStatus(s: TaskStats): OltTaskStatus {
  return {
    intervalMs:          s.intervalMs,
    lastRunAt:           s.lastRunAt?.toISOString() ?? null,
    nextRunAt:           s.nextRunAt.toISOString(),
    runCount:            s.runCount,
    lastError:           s.lastError,
    consecutiveFailures: s.consecutiveFailures,
  };
}

function sessionToStatus(session: OltSession, running: boolean): OltPollingStatus {
  const { config, startedAt, tasks } = session;
  const failures = tasks.oltStatus.consecutiveFailures;
  const message =
    !running                   ? "Polling suspended — too many consecutive failures. Restart to resume." :
    failures > 0               ? `Warning: ${failures} consecutive OLT status failure(s).` :
    tasks.oltStatus.runCount === 0 ? "Polling active — first tick pending." :
                                 "Polling active.";
  return {
    oltId:     config.oltId,
    running,
    startedAt: startedAt.toISOString(),
    endpoint:  `${config.ip}:${config.port}`,
    tasks: {
      oltStatus: taskStatsToStatus(tasks.oltStatus),
      onuList:   taskStatsToStatus(tasks.onuList),
      alarms:    taskStatsToStatus(tasks.alarms),
    },
    message,
  };
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class PollingEngine extends EventEmitter {
  private _running   = false;
  private _startedAt: string | null = null;
  private _stoppedAt: string | null = null;

  // Per-OLT timer handles (keyed by oltId)
  private _oltTimers   = new Map<string, ReturnType<typeof setInterval>>();
  private _onuTimers   = new Map<string, ReturnType<typeof setInterval>>();
  private _alarmTimers = new Map<string, ReturnType<typeof setInterval>>();

  // Per-OLT session state (run stats + connection config)
  private _sessions    = new Map<string, OltSession>();

  // ── Global engine start / stop (backward compatible) ──────────────────────

  /**
   * Mark the engine as "started".
   * In manual-poll mode this does not create any timers — use startOltPolling()
   * to begin polling a specific OLT.
   * Safe to call multiple times (idempotent).
   */
  start(): void {
    if (this._running) return;
    this._running  = true;
    this._startedAt = new Date().toISOString();
    logger.info({ registeredOlts: this._sessions.size }, "polling-engine:start");
  }

  /**
   * Stop the engine and clear ALL active OLT sessions.
   * Timers are cleared synchronously. In-flight SNMP requests may still be
   * outstanding for up to `timeoutMs` — call this from the SIGTERM handler
   * before process.exit() to allow them to drain.
   */
  stop(): void {
    if (!this._running) return;

    // Stop all active sessions
    for (const oltId of [...this._sessions.keys()]) {
      this._stopSessionTimers(oltId);
    }
    this._sessions.clear();

    this._running   = false;
    this._stoppedAt = new Date().toISOString();
    logger.info("polling-engine:stop — all sessions cleared");
  }

  isRunning(): boolean {
    return this._running;
  }

  // ── Per-OLT manual polling control ────────────────────────────────────────

  /**
   * Start polling a single OLT.
   *
   * Creates three setInterval loops (OLT status, ONU list, alarms) with the
   * safe intervals defined in the interval constants above. The first tick of
   * each loop fires after the full interval — no immediate SNMP call on start.
   *
   * Safety checks:
   *   • Rejects if `ip`, `vendor`, or `oltId` are missing.
   *   • Rejects if MAX_CONCURRENT_OLTS sessions are already active.
   *   • Rejects if this oltId is already polling (call stopOltPolling first).
   *   • All SNMP calls are read-only GETs — no SET, no write commands.
   *
   * @param request  Connection config for the OLT to poll.
   * @returns  { success, message } — success:false means no timers were created.
   */
  startOltPolling(request: OltManualPollRequest): { success: boolean; message: string } {
    const { oltId, ip, vendor } = request;

    if (!oltId?.trim()) return { success: false, message: "oltId is required." };
    if (!ip?.trim())    return { success: false, message: "ip (management IP) is required." };
    if (!vendor?.trim()) return { success: false, message: "vendor is required (e.g. Huawei, ZTE)." };

    if (this._sessions.has(oltId)) {
      return {
        success: false,
        message: `OLT ${oltId} is already being polled. Call stopOltPolling first.`,
      };
    }

    if (this._sessions.size >= MAX_CONCURRENT_OLTS) {
      const active = [...this._sessions.keys()].join(", ");
      return {
        success: false,
        message: `Safety limit: max ${MAX_CONCURRENT_OLTS} concurrent polling session(s) allowed. ` +
                 `Currently polling: ${active}. Stop that session first, or the limit will be increased in a future release.`,
      };
    }

    // Resolve optional fields to concrete values
    const config: Required<OltManualPollRequest> = {
      oltId,
      ip:        ip.trim(),
      community: (request.community ?? "public").trim(),
      vendor:    vendor.trim(),
      port:      request.port ?? 161,
    };

    const now = new Date();
    const session: OltSession = {
      config,
      startedAt: now,
      tasks: {
        oltStatus: {
          intervalMs:          OLT_STATUS_INTERVAL,
          lastRunAt:           null,
          nextRunAt:           new Date(now.getTime() + OLT_STATUS_INTERVAL),
          runCount:            0,
          lastError:           null,
          consecutiveFailures: 0,
        },
        onuList: {
          intervalMs:          ONU_STATUS_INTERVAL,
          lastRunAt:           null,
          nextRunAt:           new Date(now.getTime() + ONU_STATUS_INTERVAL),
          runCount:            0,
          lastError:           null,
          consecutiveFailures: 0,
        },
        alarms: {
          intervalMs:          ALARM_CHECK_INTERVAL,
          lastRunAt:           null,
          nextRunAt:           new Date(now.getTime() + ALARM_CHECK_INTERVAL),
          runCount:            0,
          lastError:           null,
          consecutiveFailures: 0,
        },
      },
    };

    this._sessions.set(oltId, session);

    // Create interval timers — all fire after their full interval (no immediate run)
    // Intervals are guarded by MIN_INTERVAL_MS at the constant level.
    this._oltTimers.set(oltId,
      setInterval(() => { void this._pollOlt(oltId); }, Math.max(OLT_STATUS_INTERVAL, MIN_INTERVAL_MS)),
    );
    this._onuTimers.set(oltId,
      setInterval(() => { void this._pollOnus(oltId); }, Math.max(ONU_STATUS_INTERVAL, MIN_INTERVAL_MS)),
    );
    this._alarmTimers.set(oltId,
      setInterval(() => { void this._pollAlarms(oltId); }, Math.max(ALARM_CHECK_INTERVAL, MIN_INTERVAL_MS)),
    );

    // Mark engine as running if it wasn't already
    if (!this._running) this.start();

    logger.info({ oltId, ip: config.ip, vendor: config.vendor, port: config.port }, "polling:session:start");
    return { success: true, message: `Polling started for OLT ${oltId} (${config.ip}, ${config.vendor}).` };
  }

  /**
   * Stop polling a specific OLT and remove its session.
   * Safe to call even if the OLT is not currently polling (returns success:false).
   */
  stopOltPolling(oltId: string): { success: boolean; message: string } {
    if (!this._sessions.has(oltId)) {
      return { success: false, message: `No active polling session for OLT ${oltId}.` };
    }

    this._stopSessionTimers(oltId);
    this._sessions.delete(oltId);

    logger.info({ oltId }, "polling:session:stop");
    return { success: true, message: `Polling stopped for OLT ${oltId}.` };
  }

  /**
   * Get the polling status for a specific OLT.
   * Returns null if the OLT is not currently registered.
   */
  getOltPollingStatus(oltId: string): OltPollingStatus | null {
    const session = this._sessions.get(oltId);
    if (!session) return null;
    return sessionToStatus(session, true);
  }

  /** Get polling status for all currently registered OLTs. */
  getAllOltStatuses(): OltPollingStatus[] {
    return [...this._sessions.values()].map(s => sessionToStatus(s, true));
  }

  /**
   * Returns a snapshot of the global engine state.
   * Safe to call at any time — no side effects.
   */
  getPollingStatus(): PollingStatus {
    const activeCount = this._sessions.size;
    return {
      running:           this._running,
      mode:              activeCount > 0 ? "live" : "mock-safe",
      registeredOlts:    activeCount,
      maxConcurrentOlts: MAX_CONCURRENT_OLTS,
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
      startedAt:   this._startedAt,
      stoppedAt:   this._stoppedAt,
      oltSessions: this.getAllOltStatuses(),
      note: activeCount === 0
        ? "No active polling sessions. POST /api/polling/start with {oltId, ip, vendor, community} to begin."
        : `${activeCount} OLT session(s) active. All polls are read-only SNMP GETs.`,
    };
  }

  /**
   * Remove a single OLT from all poll schedules and clear its timers.
   * Does not remove from `_sessions` — call stopOltPolling() for a full removal.
   */
  deregisterOlt(oltId: string): void {
    this._stopSessionTimers(oltId);
    this._sessions.delete(oltId);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Clear all timers for one OLT. Safe to call even if no timers exist. */
  private _stopSessionTimers(oltId: string): void {
    const olt   = this._oltTimers.get(oltId);
    const onu   = this._onuTimers.get(oltId);
    const alarm = this._alarmTimers.get(oltId);
    if (olt)   clearInterval(olt);
    if (onu)   clearInterval(onu);
    if (alarm) clearInterval(alarm);
    this._oltTimers.delete(oltId);
    this._onuTimers.delete(oltId);
    this._alarmTimers.delete(oltId);
  }

  // ── Private polling methods ─────────────────────────────────────────────────

  /**
   * OLT status poll — runs every OLT_STATUS_INTERVAL (60 s).
   *
   * Calls testConnection() which performs 2–3 SNMP GETs (sysDescr, sysUpTime,
   * vendor-specific model OID). Read-only. Times out after 5 s.
   *
   * On 3 consecutive failures: suspends the session and emits "olt:unreachable".
   *
   * @internal
   */
  private async _pollOlt(oltId: string): Promise<void> {
    const session = this._sessions.get(oltId);
    if (!session) return;

    const stats = session.tasks.oltStatus;
    const now   = new Date();
    stats.lastRunAt = now;
    stats.runCount++;
    stats.nextRunAt = new Date(now.getTime() + OLT_STATUS_INTERVAL);

    const { ip, community, port, vendor } = session.config;
    const client = new RealSnmpClient({ host: ip, community, port, timeoutMs: 5_000, retries: 1 });

    try {
      await client.testConnection();
      stats.lastError           = null;
      stats.consecutiveFailures = 0;
      logger.info({ oltId, vendor, ip }, "polling:oltStatus:ok");
      this.emit("olt:updated", { oltId, vendor, ip, polledAt: now.toISOString() });
    } catch (err) {
      stats.lastError = err instanceof Error ? err.message : String(err);
      stats.consecutiveFailures++;
      logger.warn(
        { oltId, consecutiveFailures: stats.consecutiveFailures, err: stats.lastError },
        "polling:oltStatus:failed",
      );

      if (stats.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        logger.error(
          { oltId, ip },
          `polling:oltStatus:suspended — ${MAX_CONSECUTIVE_FAILURES} consecutive failures`,
        );
        this._stopSessionTimers(oltId);
        this.emit("olt:unreachable", { oltId, ip, vendor });
      }
    }
  }

  /**
   * ONU list poll — runs every ONU_STATUS_INTERVAL (120 s).
   *
   * Calls readOnuTable() with GETBULK (max 50 ONUs per run).
   * Read-only. Times out after 8 s to allow for larger tables.
   *
   * @internal
   */
  private async _pollOnus(oltId: string): Promise<void> {
    const session = this._sessions.get(oltId);
    if (!session) return;

    const stats = session.tasks.onuList;
    const now   = new Date();
    stats.lastRunAt = now;
    stats.runCount++;
    stats.nextRunAt = new Date(now.getTime() + ONU_STATUS_INTERVAL);

    const { ip, community, port, vendor } = session.config;
    const client = new RealSnmpClient({ host: ip, community, port, timeoutMs: 8_000, retries: 1 });

    try {
      const result = await client.readOnuTable(vendor, 50);
      stats.lastError           = null;
      stats.consecutiveFailures = 0;
      logger.info({ oltId, onuCount: result.onus.length, vendor }, "polling:onuList:ok");
      this.emit("onu:updated", { oltId, onus: result.onus, polledAt: now.toISOString() });
    } catch (err) {
      stats.lastError = err instanceof Error ? err.message : String(err);
      stats.consecutiveFailures++;
      logger.warn({ oltId, err: stats.lastError }, "polling:onuList:failed");
    }
  }

  /**
   * Alarm check poll — runs every ALARM_CHECK_INTERVAL (30 s).
   *
   * Lightweight connectivity probe: calls testConnection() with a 3 s timeout
   * to detect OLT reachability changes quickly. Read-only.
   *
   * Future: diff ONU online/offline counts against previous snapshot to detect
   * ONU loss events and emit "alarm:raised" / "alarm:cleared".
   *
   * @internal
   */
  private async _pollAlarms(oltId: string): Promise<void> {
    const session = this._sessions.get(oltId);
    if (!session) return;

    const stats = session.tasks.alarms;
    const now   = new Date();
    stats.lastRunAt = now;
    stats.runCount++;
    stats.nextRunAt = new Date(now.getTime() + ALARM_CHECK_INTERVAL);

    const { ip, community, port, vendor } = session.config;
    // Short timeout + no retries — alarm check must be fast (every 30 s)
    const client = new RealSnmpClient({ host: ip, community, port, timeoutMs: 3_000, retries: 0 });

    try {
      await client.testConnection();
      stats.lastError           = null;
      stats.consecutiveFailures = 0;
      logger.info({ oltId, vendor }, "polling:alarms:ok");
      this.emit("alarms:checked", { oltId, polledAt: now.toISOString() });
    } catch (err) {
      stats.lastError = err instanceof Error ? err.message : String(err);
      stats.consecutiveFailures++;
      logger.warn({ oltId, err: stats.lastError }, "polling:alarms:failed");
    }
  }
}

/** Singleton engine — import this across services and route files. */
export const pollingEngine = new PollingEngine();
