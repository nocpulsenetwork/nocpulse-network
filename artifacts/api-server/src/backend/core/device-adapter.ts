/**
 * DeviceAdapter — universal adapter interface for multi-vendor OLT/ONU management.
 *
 * Every vendor adapter MUST implement this interface. The contract is intentionally
 * protocol-agnostic: the same interface works over SNMP, SSH CLI, NETCONF, or HTTP REST.
 *
 * ─── Cache Strategy ──────────────────────────────────────────────────────────────
 *
 *   All adapter method results are cached in the TtlCache layer (cache.ts) BEFORE
 *   being returned to callers. The API routes always read from cache first and only
 *   call the adapter on a cache miss or a force-refresh request.
 *
 *   Cache TTLs (align with polling intervals):
 *     OLT info       →  90 s  (2× poll interval, serves stale on poll failure)
 *     ONU list       → 180 s
 *     ONU detail     → 180 s
 *     Alarms         →  45 s  (shorter — alarm freshness matters more)
 *
 * ─── Polling Strategy ────────────────────────────────────────────────────────────
 *
 *   The PollingEngine (polling-engine.ts) drives periodic adapter calls:
 *     - OLT system info    → every 45 s   (POLL_OLT_INTERVAL_MS)
 *     - ONU status/optics  → every 90 s   (POLL_ONU_INTERVAL_MS)
 *     - Alarm check        → every 20 s   (POLL_ALARM_INTERVAL_MS)
 *
 *   Stagger: each OLT's poll start is offset by (index / total) × interval so
 *   all OLTs don't hit the network simultaneously on startup.
 *
 *   Back-off: on consecutive poll failures the interval doubles (max 5 min).
 *   After 3 consecutive failures the OLT status is set to "unreachable".
 *
 * ─── Queue Safety ────────────────────────────────────────────────────────────────
 *
 *   Each adapter instance maintains a per-OLT request queue (max depth: 1).
 *   If a new poll fires before the previous one completes, it is DROPPED (not queued)
 *   to prevent pile-ups when a device is slow or unreachable.
 *
 *   For write operations (rebootOnu, disableOnu):
 *     - Writes are serialized through a single-concurrency async queue per OLT.
 *     - A write blocks further polls on that OLT until it completes or times out (30 s).
 *     - Simultaneous writes to the same ONU are rejected with a 409 Conflict response.
 *
 * ─── CPU-Safe Design ─────────────────────────────────────────────────────────────
 *
 *   1. All I/O is async (Promise-based) — the Node.js event loop is never blocked.
 *   2. SNMP walks are chunked (max 100 OIDs per GetBulk request) to avoid large
 *      response parsing spikes on the main thread.
 *   3. Heavy parsing (MIB decoding, table diffing) is done incrementally using
 *      async generators where possible, yielding control between chunks.
 *   4. The polling engine uses setInterval with jitter rather than recursive
 *      setTimeout chains, so a slow device doesn't delay other OLTs.
 *   5. Alarm diffing (old vs new snapshot) is O(n) using a Map keyed by alarm ID.
 */

import type { UniversalOLT, UniversalONU, UniversalAlarm, Vendor } from "../types/universal.types";

// ─── Connection config ──────────────────────────────────────────────────────

export interface AdapterConnectionConfig {
  /** OLT management IP address. */
  host: string;

  /** SNMP/SSH port (default: 161 for SNMP, 22 for SSH). */
  port?: number;

  /** SNMP community string (v1/v2c). */
  community?: string;

  /** SNMP v3 / SSH username. */
  username?: string;

  /** SNMP v3 auth passphrase or SSH password. */
  authKey?: string;

  /** SNMP v3 privacy passphrase. */
  privKey?: string;

  /** Connection timeout in milliseconds (default: 5 000). */
  timeoutMs?: number;

  /** Number of SNMP retries before giving up (default: 2). */
  retries?: number;
}

// ─── Capability flags ───────────────────────────────────────────────────────

export interface AdapterCapabilities {
  /** Can retrieve OLT system info (model, firmware, CPU, temp). */
  oltInfo: boolean;
  /** Can discover and list registered ONUs. */
  onuDiscovery: boolean;
  /** Can retrieve per-ONU optical power measurements. */
  opticalPower: boolean;
  /** Can retrieve per-port traffic counters. */
  trafficStats: boolean;
  /** Can poll the device's alarm / event table. */
  alarmPolling: boolean;
  /** Can send a reboot command to an ONU. */
  onuReboot: boolean;
  /** Can admin-disable / re-enable an ONU port. */
  onuDisable: boolean;
}

// ─── Adapter interface ──────────────────────────────────────────────────────

export interface DeviceAdapter {
  /** Vendor identifier — must match a key in the adapter registry. */
  readonly vendor: Vendor;

  /** Returns the static capability flags for this adapter implementation. */
  capabilities(): AdapterCapabilities;

  /**
   * Establish (or verify) a connection to the target device.
   *
   * For SNMP adapters this performs a test Get on sysDescr (OID 1.3.6.1.2.1.1.1.0).
   * For SSH/CLI adapters this opens the session and logs in.
   *
   * Throws on authentication failure, timeout, or host-unreachable.
   * Must be called once before any other method; implementations may cache
   * the session internally and reconnect transparently on subsequent calls.
   */
  connect(config: AdapterConnectionConfig): Promise<void>;

  /**
   * Retrieve normalized OLT system information.
   *
   * Includes: identity (model, firmware, serial), hardware (boards, temps),
   * resource usage (CPU, memory), and ONU counts per PON port.
   *
   * Poll frequency: every 45 s (configurable via POLL_OLT_INTERVAL_MS).
   * Cache TTL: 90 s.
   */
  getOltInfo(): Promise<UniversalOLT>;

  /**
   * Retrieve the full list of registered ONUs on this OLT.
   *
   * Returns one entry per registered ONU with status and optical snapshot.
   * Large OLTs (512+ ONUs) may take 3–8 s; results are streamed to cache
   * as they arrive so partial data is available immediately.
   *
   * Poll frequency: every 90 s (configurable via POLL_ONU_INTERVAL_MS).
   * Cache TTL: 180 s.
   */
  getOnuList(): Promise<UniversalONU[]>;

  /**
   * Retrieve detailed information for a single ONU.
   *
   * Includes full optical measurements, traffic counters, eth port states,
   * and lifecycle timestamps. More expensive than getOnuList — only called
   * on detail page view or force-refresh.
   *
   * Cache TTL: 180 s (keyed by onuId).
   */
  getOnuDetails(onuIndex: number, portId: string): Promise<UniversalONU>;

  /**
   * Send a reboot command to the specified ONU.
   *
   * Write operation — serialized through the per-OLT write queue.
   * Reboot takes 60–120 s; callers should poll ONU status until Online.
   * Throws if the adapter does not support ONU reboot (check capabilities).
   *
   * Audit: the caller must pass the operator's identity for logging.
   */
  rebootOnu(onuIndex: number, portId: string, operatorId: string): Promise<void>;

  /**
   * Admin-disable or re-enable an ONU port.
   *
   * When disabled=true the ONU is forced offline via PON port admin-down.
   * When disabled=false the port is re-enabled and the ONU will re-register.
   *
   * Write operation — serialized through the per-OLT write queue.
   * Throws if the adapter does not support ONU disable (check capabilities).
   */
  disableOnu(onuIndex: number, portId: string, disable: boolean, operatorId: string): Promise<void>;
}
