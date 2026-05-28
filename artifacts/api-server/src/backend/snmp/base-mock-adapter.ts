/**
 * BaseMockSnmpAdapter — base class for all six vendor mock SNMP adapters.
 *
 * ─── Read-only contract ───────────────────────────────────────────────────
 *
 *   All methods in this class are READ-ONLY:
 *     getOltInfo()        — OLT system information
 *     getPonPorts()       — PON port list with counts
 *     getOnuList()        — full ONU list with optical + traffic data
 *     getOnuOpticalPower() — optical power projection only
 *     getOnuStatus()      — lifecycle status projection only
 *     getAlarms()         — active alarm list
 *
 *   Write operations (reboot, disable, config push) are intentionally absent.
 *   Attempting to add them here requires explicit safety review.
 *
 * ─── Data source ─────────────────────────────────────────────────────────
 *
 *   All data comes from the typed MOCK_OLTS / MOCK_ONUS / MOCK_ALARMS arrays
 *   in mock-data.ts. Each adapter filters by oltId so results are scoped
 *   to the specific OLT the caller requested.
 *
 * ─── Simulated async behaviour ───────────────────────────────────────────
 *
 *   Every method awaits a short random delay (10–50 ms) before returning.
 *   This ensures that when real SNMP replaces these methods the call sites
 *   already handle async correctly — no synchronous assumptions can slip in.
 *
 *   Delay ranges by method type (mirrors real SNMP timing):
 *     connect()           → 10–50 ms  (session probe GET on sysDescr)
 *     getOltInfo()        → 20–60 ms  (single GET burst)
 *     getPonPorts()       → 10–30 ms  (small table)
 *     getOnuList()        → 80–200 ms (large walk — scales with ONU count)
 *     getOnuOpticalPower()→ 50–120 ms (per-ONU OID walk)
 *     getOnuStatus()      → 30–80 ms  (status-only walk, fewer OIDs)
 *     getAlarms()         → 20–60 ms  (alarm table walk)
 *
 * ─── Extending for vendor specifics ──────────────────────────────────────
 *
 *   Vendor subclasses override individual methods to adjust behaviour:
 *     - Different delay ranges (a VSOL may be slower than a Huawei)
 *     - Vendor-specific field transformations (when real SNMP lands)
 *     - Capability flags (VSOL has limited alarm data)
 *
 * ─── Swapping to real SNMP ────────────────────────────────────────────────
 *
 *   To replace a method with real SNMP:
 *     1. Call this.session.walk(VENDOR_OID_MAP.onuTable) in the method body
 *     2. Pass the raw results to a parseOnuRows(raw) helper
 *     3. Return the parsed results — the return type does not change
 *     4. Delete the simulatedDelay() call (real SNMP has its own latency)
 */

import type {
  UniversalOLT,
  UniversalONU,
  UniversalAlarm,
  PonPort,
  Vendor,
  OnuOpticalPower,
  OnuStatusView,
} from "./types";
import { OltNotFoundError } from "./types";
import { MockSnmpSession, simulatedDelay } from "./mock-snmp-session";
import type { MockSnmpConnectConfig } from "./types";
import { MOCK_ALARMS, MOCK_OLTS, MOCK_ONUS } from "../mock/mock-data";

// ─── Adapter capabilities ──────────────────────────────────────────────────

export interface MockAdapterCapabilities {
  /** Can return OLT system info (CPU, memory, temp, uptime). */
  oltInfo: boolean;
  /** Can list PON ports with ONU counts. */
  ponPorts: boolean;
  /** Can return the full ONU list. */
  onuList: boolean;
  /** Can return per-ONU optical power (RX/TX dBm). */
  opticalPower: boolean;
  /** Can return per-ONU lifecycle status. */
  onuStatus: boolean;
  /** Can return the active alarm list. */
  alarmPolling: boolean;
}

// ─── Base adapter ──────────────────────────────────────────────────────────

export abstract class BaseMockSnmpAdapter {
  /**
   * Vendor identifier — must match the `vendor` field in UniversalOLT.
   * Each vendor subclass sets this as a readonly literal.
   */
  abstract readonly vendor: Vendor;

  /**
   * Internal SNMP session — created on connect(), torn down on disconnect().
   * Protected so vendor subclasses can reference it when real SNMP is added.
   */
  protected session: MockSnmpSession | null = null;

  // ── Delay ranges (override in vendor subclasses for realistic variation) ─

  /** Min delay (ms) for a connect probe. */
  protected connectMinMs = 10;
  protected connectMaxMs = 50;

  /** Min/max delay (ms) for getOltInfo — single-OLT GET burst. */
  protected oltInfoMinMs = 20;
  protected oltInfoMaxMs = 60;

  /** Min/max delay (ms) for getPonPorts — small table walk. */
  protected ponPortsMinMs = 10;
  protected ponPortsMaxMs = 30;

  /** Min/max delay (ms) for getOnuList — full ONU table walk. */
  protected onuListMinMs = 80;
  protected onuListMaxMs = 200;

  /** Min/max delay (ms) for getOnuOpticalPower — per-ONU power OIDs. */
  protected opticalMinMs = 50;
  protected opticalMaxMs = 120;

  /** Min/max delay (ms) for getOnuStatus — status-only per-ONU walk. */
  protected statusMinMs = 30;
  protected statusMaxMs = 80;

  /** Min/max delay (ms) for getAlarms — alarm table walk. */
  protected alarmsMinMs = 20;
  protected alarmsMaxMs = 60;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Open a mock SNMP session to the target OLT.
   *
   * In real SNMP: creates a UDP socket and probes sysDescr.0.
   * Here: creates a MockSnmpSession and simulates the connection delay.
   *
   * @param config  Connection parameters (host, community, version, timeoutMs)
   */
  async connect(config: MockSnmpConnectConfig): Promise<void> {
    this.session = new MockSnmpSession(
      config,
      this.connectMinMs,
      this.connectMaxMs,
    );
    await this.session.connect();
  }

  /**
   * Close the SNMP session and release resources.
   * Always call in a `finally` block after any sequence of adapter calls.
   */
  disconnect(): void {
    this.session?.close();
    this.session = null;
  }

  /**
   * Returns static capability flags for this adapter.
   * Vendor subclasses override this if they have fewer capabilities.
   */
  capabilities(): MockAdapterCapabilities {
    return {
      oltInfo:      true,
      ponPorts:     true,
      onuList:      true,
      opticalPower: true,
      onuStatus:    true,
      alarmPolling: true,
    };
  }

  // ─── Read-only data methods ───────────────────────────────────────────────

  /**
   * Retrieve normalized OLT system information.
   *
   * Returns the full UniversalOLT shape including CPU, memory, temperature,
   * uptime, ONU counts, and PON port summaries.
   *
   * Real SNMP replacement:
   *   Walk sysDescr, sysUpTime, vendor CPU/mem OIDs, entPhysicalTable.
   *   Pass raw values to parseOltInfo(raw) and return the result.
   *
   * @param oltId  The OLT identifier to query.
   * @throws OltNotFoundError if oltId is not in the mock dataset.
   */
  async getOltInfo(oltId: string): Promise<UniversalOLT> {
    await simulatedDelay(this.oltInfoMinMs, this.oltInfoMaxMs);
    const olt = this.findOlt(oltId);
    return { ...olt, lastPolled: new Date().toISOString() };
  }

  /**
   * Retrieve the list of physical PON ports on an OLT.
   *
   * Derived from UniversalOLT.ponPorts — no separate walk needed in mock mode.
   *
   * Real SNMP replacement:
   *   Walk vendor PON port table (e.g. hwGponIfTable / zxAnPonPortTable).
   *   Map each row to PonPort and return the array.
   *
   * @param oltId  The OLT identifier to query.
   * @throws OltNotFoundError if oltId is not in the mock dataset.
   */
  async getPonPorts(oltId: string): Promise<PonPort[]> {
    await simulatedDelay(this.ponPortsMinMs, this.ponPortsMaxMs);
    const olt = this.findOlt(oltId);
    return olt.ponPorts.map((p) => ({ ...p }));
  }

  /**
   * Retrieve the full list of registered ONUs on an OLT.
   *
   * Returns the complete UniversalONU shape per ONU, including optical data,
   * traffic counters, lifecycle timestamps, and profile information.
   *
   * Real SNMP replacement:
   *   Walk vendor ONU index table (e.g. hwGponOnuTable / zxAnGponOnuTable).
   *   For each row fetch optical OIDs in a second pass (or combined GETBULK).
   *   Map all rows to UniversalONU via parseOnuRow(row).
   *
   * @param oltId  The OLT identifier to query.
   */
  async getOnuList(oltId: string): Promise<UniversalONU[]> {
    this.findOlt(oltId); // validate OLT exists before the expensive walk delay
    await simulatedDelay(this.onuListMinMs, this.onuListMaxMs);
    return this.filterOnus(oltId).map((o) => ({
      ...o,
      lastPolled: new Date().toISOString(),
    }));
  }

  /**
   * Retrieve optical power measurements for all ONUs on an OLT.
   *
   * Returns a lightweight projection — only optical fields, no traffic or
   * profile data. Use this for dashboards that only need signal level.
   *
   * Real SNMP replacement:
   *   Walk vendor per-ONU optical OID table (e.g. hwGponOnuRxOpticalPower).
   *   Divide raw integers by 100 (or 10 depending on vendor) to get dBm.
   *
   * @param oltId  The OLT identifier to query.
   */
  async getOnuOpticalPower(oltId: string): Promise<OnuOpticalPower[]> {
    this.findOlt(oltId);
    await simulatedDelay(this.opticalMinMs, this.opticalMaxMs);
    const now = new Date().toISOString();
    return this.filterOnus(oltId).map(
      (o): OnuOpticalPower => ({
        onuId:       o.id,
        oltId:       o.oltId,
        oltPort:     o.oltPort,
        onuIndex:    o.onuIndex,
        txPower:     o.txPower,
        rxPower:     o.rxPower,
        oltRxPower:  o.oltRxPower,
        biasCurrent: o.biasCurrent,
        voltage:     o.voltage,
        temperature: o.temperature,
        polledAt:    now,
      }),
    );
  }

  /**
   * Retrieve lifecycle status for all ONUs on an OLT.
   *
   * Returns a lightweight projection — only status, uptime, and last-event
   * timestamps. Use this for the ONU status table view.
   *
   * Real SNMP replacement:
   *   Walk vendor ONU oper-state OID per port (e.g. hwGponOnuOperState).
   *   Map 1 → "online", 2 → "offline" (or vendor-specific encoding).
   *
   * @param oltId  The OLT identifier to query.
   */
  async getOnuStatus(oltId: string): Promise<OnuStatusView[]> {
    this.findOlt(oltId);
    await simulatedDelay(this.statusMinMs, this.statusMaxMs);
    const now = new Date().toISOString();
    return this.filterOnus(oltId).map(
      (o): OnuStatusView => ({
        onuId:            o.id,
        oltId:            o.oltId,
        oltPort:          o.oltPort,
        onuIndex:         o.onuIndex,
        name:             o.name,
        status:           o.status,
        uptime:           o.uptime,
        lastOfflineReason: o.lastOfflineReason,
        lastOnlineTime:   o.lastOnlineTime,
        polledAt:         now,
      }),
    );
  }

  /**
   * Retrieve active alarms for a specific OLT (and its ONUs).
   *
   * Returns all alarms where deviceId matches the OLT ID or any ONU
   * belonging to that OLT. This matches how a real SNMP alarm table walk
   * would return device-scoped alarms.
   *
   * Real SNMP replacement:
   *   Walk vendor alarm table (e.g. hwAlarmActiveTable / zxAnAlarmTable).
   *   Map severity codes to AlarmSeverity values.
   *   Optionally merge with SNMP trap log from the trap receiver.
   *
   * @param oltId  The OLT identifier to query.
   */
  async getAlarms(oltId: string): Promise<UniversalAlarm[]> {
    this.findOlt(oltId);
    await simulatedDelay(this.alarmsMinMs, this.alarmsMaxMs);
    return this.filterAlarms(oltId).map((a) => ({ ...a }));
  }

  // ─── Protected helpers ────────────────────────────────────────────────────

  /**
   * Find an OLT by ID in the mock dataset.
   * @throws OltNotFoundError if not found.
   */
  protected findOlt(oltId: string): UniversalOLT {
    const olt = MOCK_OLTS.find((o) => o.id === oltId);
    if (!olt) throw new OltNotFoundError(oltId);
    return olt;
  }

  /**
   * Return all ONUs that belong to the given OLT.
   * Returns an empty array (no throw) if the OLT has no ONUs in mock data.
   */
  protected filterOnus(oltId: string): UniversalONU[] {
    return MOCK_ONUS.filter((o) => o.oltId === oltId);
  }

  /**
   * Return all alarms scoped to an OLT or any of its ONUs.
   *
   * The alarm table on a real OLT contains alarms for the OLT itself as well
   * as alarms raised on individual ONUs. This mirrors that behaviour by
   * matching on deviceId against both the OLT ID and ONU IDs.
   */
  protected filterAlarms(oltId: string): UniversalAlarm[] {
    const onuIds = new Set(
      MOCK_ONUS.filter((o) => o.oltId === oltId).map((o) => o.id),
    );
    return MOCK_ALARMS.filter(
      (a) => a.deviceId === oltId || onuIds.has(a.deviceId),
    );
  }
}
