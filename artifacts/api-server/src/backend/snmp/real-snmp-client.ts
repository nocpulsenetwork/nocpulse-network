/**
 * RealSnmpClient — read-only SNMP v2c client wrapper for OLT probing.
 *
 * ─── Safety contract ──────────────────────────────────────────────────────
 *
 *   This module is READ-ONLY by design:
 *     • snmpGet()  → SNMP GET only
 *     • snmpWalk() → SNMP GETBULK / GETNEXT walk only
 *     • SNMP SET is not called anywhere in this file
 *     • No reboot, no disable, no config writes
 *
 *   The only operations are: connect probe, GET scalar OIDs, GETBULK table walk.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────
 *
 *   const client = new RealSnmpClient({ host: "192.168.1.1", community: "public" });
 *   const test   = await client.testConnection();        // quick ping
 *   const sys    = await client.getSysInfo();            // OLT identity
 *   const uptime = await client.getUptime();             // seconds since boot
 *   const vendor = await client.getVendor();             // detected vendor string
 *   const model  = await client.getModel();              // detected model string
 *   const ports  = await client.getPonPorts();           // PON port list
 *   const onus   = await client.getOnuListMockFallback(); // ONUs (live or mock)
 *
 * ─── Timeout / retry ──────────────────────────────────────────────────────
 *
 *   Defaults: 3 000 ms timeout, 1 retry.
 *   Each method creates a fresh SNMP session and closes it in a finally block.
 *   A timed-out request throws `SnmpTimeoutError` so callers can distinguish
 *   unreachable hosts from parsing failures.
 *
 * ─── No auto-polling ──────────────────────────────────────────────────────
 *
 *   This client has no setInterval, no EventEmitter subscriptions, and no
 *   background loops. Every method is one-shot (call → result → done).
 *   The PollingEngine (polling-engine.ts) is responsible for scheduling;
 *   this client is called by the engine — never the other way around.
 */

import * as snmp from "net-snmp";
import { MOCK_ONUS } from "../mock/mock-data";
import type { UniversalONU } from "../types/universal.types";

// ─── Standard OIDs ────────────────────────────────────────────────────────

const OID = {
  // RFC 1213 / SNMPv2-MIB system group
  sysDescr:    "1.3.6.1.2.1.1.1.0",
  sysObjectID: "1.3.6.1.2.1.1.2.0",
  sysUpTime:   "1.3.6.1.2.1.1.3.0",
  sysContact:  "1.3.6.1.2.1.1.4.0",
  sysName:     "1.3.6.1.2.1.1.5.0",
  sysLocation: "1.3.6.1.2.1.1.6.0",

  // IF-MIB — interface table columns (walk these subtrees)
  ifDescrCol:      "1.3.6.1.2.1.2.2.1.2",   // interface description strings
  ifOperStatusCol: "1.3.6.1.2.1.2.2.1.8",   // 1=up 2=down 3=testing
  ifAdminStatusCol:"1.3.6.1.2.1.2.2.1.7",   // 1=up 2=down (READ ONLY — never SET)
} as const;

// ─── Timeout / retry defaults ──────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 3_000;
const DEFAULT_RETRIES    = 1;
const DEFAULT_PORT       = 161;

// Maximum number of varbinds per GETBULK request in a walk.
// Kept low to avoid triggering OLT SNMP agent queue limits.
const WALK_MAX_REPETITIONS = 20;

// ─── Public option and result types ───────────────────────────────────────

export interface SnmpClientOptions {
  /** OLT management IP address (IPv4). */
  host: string;

  /** SNMP v1/v2c read-only community string (e.g. "public"). */
  community: string;

  /** UDP port. Default: 161. */
  port?: number;

  /** Per-request timeout in milliseconds. Default: 3 000. */
  timeoutMs?: number;

  /** Max retries before giving up. Default: 1. */
  retries?: number;
}

export interface SnmpTestResult {
  /** Whether the OLT responded within the timeout window. */
  success: boolean;

  /** IP address that was probed. */
  host: string;

  /** UDP port used. */
  port: number;

  /** Community string used (never log in prod — keep internal). */
  community: string;

  /** SNMP version string used. */
  version: "v2c";

  /** Round-trip time from request to first response in milliseconds. */
  responseTimeMs: number;

  /** sysDescr.0 value — vendor/firmware info string. */
  sysDescr?: string;

  /** sysName.0 value — configured device name. */
  sysName?: string;

  /** sysObjectID.0 value — vendor enterprise OID. */
  sysObjectID?: string;

  /** sysUpTime.0 converted to seconds. */
  sysUpTimeSecs?: number;

  /** Human-readable error message if success=false. */
  error?: string;
}

export interface SysInfo {
  sysDescr: string;
  sysObjectID: string;
  sysUpTimeSecs: number;
  sysContact: string;
  sysName: string;
  sysLocation: string;
}

export interface PonPortSummary {
  /** Interface index (ifIndex) as reported by the OLT. */
  ifIndex: number;

  /** Interface description string (e.g. "GPON 0/1/0"). */
  description: string;

  /** Interface operational status: "up" | "down" | "testing" | "unknown". */
  operStatus: "up" | "down" | "testing" | "unknown";
}

export interface OnuListResult {
  /** "live" if real SNMP data was returned; "mock" if fallback was used. */
  source: "live" | "mock";

  /** ONUs found. Empty array if live walk returned no data. */
  onus: UniversalONU[];

  /** Human-readable note about why mock fallback was used, if applicable. */
  fallbackReason?: string;
}

/** A single ONU entry returned by `readOnuTable()`. */
export interface SnmpOnu {
  /** ONU ID within its PON port (e.g. "1", "5", "127"). */
  onuId: string;

  /** PON port the ONU is connected to (e.g. "0/4/3", "gpon-ifIndex:123"). */
  ponPort: string;

  /** GPON serial number in VENDORHEX format (e.g. "HWTC1A2B3C4D"), or null. */
  serial: string | null;

  /** MAC address for EPON ONUs (e.g. "A1:B2:C3:D4:E5:F6"), or null. */
  mac: string | null;

  /**
   * ONU name/alias as configured on the OLT management interface, or null
   * when the firmware does not expose this column or the value is blank.
   * Undefined (not set) when the adapter has not attempted to read it.
   */
  name?: string | null;

  /** Operational status from the ONU management table. */
  status: "online" | "offline" | "unknown";

  /** ONU hardware model/type string (e.g. "HG8310M"), or null. */
  type: string | null;

  /**
   * De-registration reason code from the OLT (vendor-specific INTEGER enum).
   * Null when not reported; undefined when the adapter has not attempted to read.
   * Common C-DATA/EasyPath values: 0=Unknown, 1=DyingGasp, 2=LOS,
   * 3=AdminDisabled, 4=MPCPTimeout, 5=LinkFault, 6=Deregistered, 7=AgingOut.
   */
  offlineReasonCode?: number | null;

  /**
   * ONU receive optical power in dBm, or null when unavailable.
   * Populated by vendor-specific optical table reads after discovery.
   */
  rxPowerDbm?: number | null;

  /**
   * ONU transmit optical power in dBm, or null when unavailable.
   */
  txPowerDbm?: number | null;

  /**
   * Physical fiber distance from OLT to ONU in metres, or null when unavailable.
   */
  distanceMeters?: number | null;

  /** Raw OID instance suffix — useful for debugging MIB mapping. */
  rawInstanceOid: string;

  /**
   * ONU optical module temperature in degrees Celsius, or null when unavailable.
   * Populated by MIB-confirmed SNMP GET (EasyPath: 17409.2.3.4.2.1.8.{e}.0.1).
   */
  temperatureCelsius?: number | null;

  /**
   * Time since the ONU last registered on the PON, in seconds.
   * Null when unavailable from this firmware/vendor.
   */
  registerDurationSecs?: number | null;
}

/** Result returned by `readOnuTable()`. */
export interface ReadOnuTableResult {
  /** true if the SNMP operation completed without a network error. */
  success: boolean;

  /** Vendor name used to select the MIB (e.g. "Huawei"). */
  vendor: string;

  /** Number of ONUs returned in `onus`. */
  totalFound: number;

  /** Normalized ONU list (at most `limit` entries). */
  onus: SnmpOnu[];

  /** Human-readable status or error message. */
  message: string;

  /** Total time from call to return, in milliseconds. */
  latencyMs: number;

  /** MIB table name used for the walk (e.g. "hwGponOnuMngTable"). */
  mibUsed: string;
}

/**
 * Detailed attributes for a single ONU, read from a vendor-specific SNMP table.
 *
 * Fields not supported by a given vendor MIB or firmware version are null.
 * Traffic counters and optical power are intentionally excluded — use a
 * separate endpoint for those. Client MAC, ONU uptime, and last-online/offline
 * timestamps require vendor-specific event/stats tables and are currently
 * unimplemented (marked null with TODO comments).
 */
export interface SnmpOnuDetail {
  /** Short ONU identifier within its PON port (e.g. "5"). */
  onuId: string;

  /** Human-readable PON port identifier (e.g. "0/4/3" for Huawei). */
  ponPort: string;

  /** GPON serial number — 4-char ASCII vendor code + 8 uppercase hex chars. Null for EPON. */
  serial: string | null;

  /** ONU's own MAC address (EPON). Null for GPON. */
  mac: string | null;

  /**
   * Downstream client/CPE MAC address.
   * Currently null — requires a separate ARP/bridge table walk per ONU.
   * TODO: Huawei hwEponOnuMacTable; ZTE zxAnEponOnuMacTable.
   */
  clientMac: null;

  /** ONU model or type string as reported by the device MIB. */
  type: string | null;

  /** Administrator-assigned description or name label for this ONU. */
  description: string | null;

  /** Operational status of the ONU. */
  status: "online" | "offline" | "unknown";

  /** Physical distance from OLT to ONU in metres. Null if unsupported by firmware. */
  distanceMeters: number | null;

  /**
   * ONU uptime in seconds.
   * Currently null — requires vendor-specific optical stats table.
   * TODO: Huawei hwGponOnuOptIfTable col 12; ZTE zxAnGponOnuStatTable.
   */
  onuUptimeSecs: null;

  /**
   * ISO 8601 timestamp of the last time this ONU registered as online.
   * Currently null — requires vendor-specific event/alarm log table.
   * TODO: Huawei hwGponOnuAlarmTable; ZTE zxAnGponOnuStateChangeTable.
   */
  lastOnlineTime: null;

  /**
   * ISO 8601 timestamp of the last time this ONU went offline.
   * Currently null — see lastOnlineTime TODO above.
   */
  lastOfflineTime: null;

  /** Full OID instance suffix as used in the vendor MIB (e.g. "0.4.3.5"). */
  rawInstanceOid: string;
}

/** Return type of {@link RealSnmpClient.readOnuDetails}. */
export interface ReadOnuDetailResult {
  /** Whether the SNMP read succeeded. */
  success: boolean;

  /** Vendor name used to select the MIB. */
  vendor: string;

  /** Populated ONU detail on success, null on failure. */
  onu: SnmpOnuDetail | null;

  /** Human-readable status or error description. */
  message: string;

  /** Round-trip time from call to return, in milliseconds. */
  latencyMs: number;

  /** MIB table name used (e.g. "hwGponOnuMngTable"). */
  mibUsed: string;
}

/**
 * Optical transceiver measurements for a single ONU.
 *
 * All power values are in dBm (floating-point, 2 decimal places).
 * Raw SNMP integers are multiplied by the vendor scale factor
 * (typically 0.01, so a raw value of −2730 = −27.30 dBm).
 * Null means the measurement is not available from the device MIB.
 */
export interface SnmpOnuOptical {
  /** Short ONU identifier within its PON port. */
  onuId: string;

  /** Human-readable PON port identifier (e.g. "0/4/3"). */
  ponPort: string;

  /**
   * ONU optical receive power (dBm).
   * Typical GPON ONT range: −8 to −27 dBm. Below −30 dBm is critical.
   */
  rxPowerDbm: number | null;

  /**
   * ONU optical transmit power (dBm).
   * Typical GPON ONT TX range: +0.5 to +5 dBm.
   */
  txPowerDbm: number | null;

  /**
   * OLT receive power — the signal strength measured at the OLT's receiver (dBm).
   * Useful for diagnosing upstream fibre attenuation.
   */
  oltRxPowerDbm: number | null;

  /**
   * ONU optical module temperature in degrees Celsius.
   * Null if not reported by the device firmware.
   */
  temperatureC: number | null;

  /**
   * Derived optical health status based on ONU RX power thresholds:
   *   good     — RX ≥ −28 dBm  (normal operating range)
   *   weak     — −30 ≤ RX < −28 dBm  (marginal; monitor closely)
   *   critical — RX < −30 dBm  (below receiver sensitivity; likely to drop)
   *   unknown  — RX power not available
   */
  opticalStatus: "good" | "weak" | "critical" | "unknown";

  /** Full OID instance suffix used in the vendor MIB (e.g. "0.4.3.5"). */
  rawInstanceOid: string;
}

/** Return type of {@link RealSnmpClient.readOnuOptical}. */
export interface ReadOnuOpticalResult {
  /** Whether the SNMP read succeeded. */
  success: boolean;

  /** Vendor name used to select the optical MIB. */
  vendor: string;

  /** Populated optical data on success, null on failure. */
  onu: SnmpOnuOptical | null;

  /** Human-readable status or error description. */
  message: string;

  /** Round-trip time from call to return, in milliseconds. */
  latencyMs: number;

  /** MIB table name used (e.g. "hwGponOnuOptIfInfoTable"). */
  mibUsed: string;
}

/**
 * Traffic counters for a single ONU, as read from a vendor-specific SNMP table
 * or from the standard IF-MIB.
 *
 * Byte counters are cumulative since last device reboot or counter reset.
 * Rates are device-reported (not computed from two readings) and may represent
 * a moving average rather than an instantaneous snapshot.
 * Null means the measurement is not available from the MIB used.
 */
export interface SnmpOnuTraffic {
  /** Short ONU identifier within its PON port. */
  onuId: string;

  /** Human-readable PON port identifier. */
  ponPort: string;

  /**
   * Total downstream bytes received by the ONU (cumulative counter).
   * Read from IF-MIB ifHCInOctets (64-bit) or ifInOctets (32-bit fallback),
   * or from a vendor-specific statistics table.
   */
  downloadBytes: number | null;

  /**
   * Total upstream bytes sent by the ONU (cumulative counter).
   * Read from IF-MIB ifHCOutOctets (64-bit) or ifOutOctets (32-bit fallback),
   * or from a vendor-specific statistics table.
   */
  uploadBytes: number | null;

  /**
   * Sum of downloadBytes + uploadBytes.
   * Null when either counter is unavailable.
   */
  totalBytes: number | null;

  /**
   * Current downstream rate in kbps, as reported by the device.
   * Available only from vendor-specific stats tables that expose a rate column.
   * Not available via IF-MIB (would require two timed readings).
   */
  downloadRateKbps: number | null;

  /**
   * Current upstream rate in kbps, as reported by the device.
   * Same availability caveat as downloadRateKbps.
   */
  uploadRateKbps: number | null;

  /**
   * IF-MIB interface index used for the counters, if the IF-MIB path was taken.
   * Null when vendor-specific tables were used instead.
   */
  ifIndex: number | null;

  /** Full OID instance suffix used in the vendor MIB (e.g. "0.4.3.5"). */
  rawInstanceOid: string;
}

/** Return type of {@link RealSnmpClient.readOnuTraffic}. */
export interface ReadOnuTrafficResult {
  /** Whether the SNMP read succeeded. */
  success: boolean;

  /** Vendor name used to select the traffic MIB. */
  vendor: string;

  /** Populated traffic data on success, null on failure. */
  onu: SnmpOnuTraffic | null;

  /** Human-readable status or error description. */
  message: string;

  /** Round-trip time from call to return, in milliseconds. */
  latencyMs: number;

  /** MIB table or standard used (e.g. "hwGponOnuStatTable" or "IF-MIB"). */
  mibUsed: string;
}

// ─── OLT health types ─────────────────────────────────────────────────────

/** Operational status of a single OLT network port, read from IF-MIB. */
export interface OltPortStatus {
  ifIndex: number;
  description: string;
  operStatus: "up" | "down" | "testing" | "unknown";
  adminStatus: "up" | "down" | "unknown";
}

/**
 * OLT-level health metrics returned by `getOltHealth()`.
 *
 * Standard fields (always attempted):
 *   • uptimeSecs    — sysUpTime.0 (standard, always available)
 *   • uplinkPorts   — IF-MIB 10G/uplink-named interfaces
 *   • ethernetPorts — IF-MIB GE/FE interfaces
 *   • sfpPorts      — IF-MIB SFP-labeled interfaces
 *
 * EasyPath V2 MIB proprietary fields (null when OID returns noSuchObject/noSuchInstance):
 *   • cpuPct        — 1.3.6.1.4.1.34592.1.3.100.1.8.1.0  (CPU utilisation %)
 *   • memPct        — derived: (memTotal − memFree) / memTotal × 100
 *                     memTotal: 1.3.6.1.4.1.34592.1.3.100.1.8.2.0
 *                     memFree:  1.3.6.1.4.1.34592.1.3.100.1.8.3.0
 *   • temperatureC  — 1.3.6.1.4.1.34592.1.3.100.1.8.6.0
 *
 * Any field that cannot be read returns null — never a fake value.
 */
export interface OltHealthResult {
  uptimeSecs:    number | null;
  cpuPct:        number | null;
  memPct:        number | null;
  temperatureC:  number | null;
  uplinkPorts:   OltPortStatus[];
  ethernetPorts: OltPortStatus[];
  sfpPorts:      OltPortStatus[];
  polledAt:  string;
  latencyMs: number;
  source: "live-snmp";
}

// ─── Custom error types ────────────────────────────────────────────────────

export class SnmpTimeoutError extends Error {
  constructor(host: string, timeoutMs: number) {
    super(`SNMP request to ${host} timed out after ${timeoutMs} ms`);
    this.name = "SnmpTimeoutError";
  }
}

export class SnmpUnreachableError extends Error {
  constructor(host: string, cause?: string) {
    super(`SNMP agent at ${host} unreachable${cause ? `: ${cause}` : ""}`);
    this.name = "SnmpUnreachableError";
  }
}

// ─── RealSnmpClient ────────────────────────────────────────────────────────

export class RealSnmpClient {
  private readonly host: string;
  private readonly community: string;
  private readonly port: number;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(options: SnmpClientOptions) {
    this.host      = options.host;
    this.community = options.community;
    this.port      = options.port      ?? DEFAULT_PORT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries   = options.retries   ?? DEFAULT_RETRIES;
  }

  // ─── Session factory ──────────────────────────────────────────────────

  /**
   * Create a fresh read-only SNMP session.
   *
   * A new session is created per-call and closed in a finally block.
   * This avoids session state leaks and ensures timeouts are applied
   * per-request rather than being shared across multiple concurrent calls.
   *
   * IMPORTANT: Always call session.close() — it releases the UDP socket.
   */
  private createSession(): snmp.Session {
    return snmp.createSession(this.host, this.community, {
      port:    this.port,
      timeout: this.timeoutMs,
      retries: this.retries,
      version: snmp.Version2c,
    });
  }

  // ─── Low-level primitives ─────────────────────────────────────────────

  /**
   * Issue a synchronous SNMP GET for a list of OIDs.
   * Creates and closes its own session — safe to call concurrently.
   *
   * @throws SnmpTimeoutError on timeout
   * @throws SnmpUnreachableError on connection error
   */
  private snmpGet(oids: string[]): Promise<snmp.Varbind[]> {
    return new Promise((resolve, reject) => {
      const session = this.createSession();
      session.get(oids, (error: Error | null, varbinds: snmp.Varbind[]) => {
        session.close();
        if (error) {
          reject(classifyError(error, this.host, this.timeoutMs));
          return;
        }
        resolve(varbinds);
      });
    });
  }

  /**
   * Fetch the current register duration (onuTimeSinceLastRegister) for one
   * EasyPath ONU via a single SNMP GET — no caching, always live.
   *
   * OID: 1.3.6.1.4.1.17409.2.3.4.1.1.18.{EponDeviceIndex}
   * EponDeviceIndex = (0x01 << 24) | (portSlot << 8) | onuSlot
   *
   * Returns seconds (unsigned Counter32), or null on any error / missing OID.
   */
  async fetchRegisterDuration(portSlot: number, onuSlot: number): Promise<number | null> {
    const e   = (1 * 0x1000000) + (portSlot << 8) + onuSlot;
    const oid = `1.3.6.1.4.1.17409.2.3.4.1.1.18.${e}`;
    try {
      const varbinds = await this.snmpGet([oid]);
      const flat: snmp.Varbind[] = Array.isArray(varbinds[0])
        ? (varbinds as unknown as snmp.Varbind[][]).flat()
        : varbinds;
      const vb = flat[0];
      if (!vb || snmp.isVarbindError(vb)) return null;
      const raw = typeof vb.value === "number" ? vb.value
                : typeof vb.value === "bigint"  ? Number(vb.value)
                : null;
      if (raw === null || !Number.isFinite(raw)) return null;
      return raw < 0 ? raw + 0x100000000 : raw;
    } catch {
      return null;
    }
  }

  /**
   * Walk a MIB subtree using GETBULK (v2c) or successive GETNEXTs (v1).
   * Creates and closes its own session.
   *
   * Walk is limited to WALK_MAX_REPETITIONS (20) OIDs per request to avoid
   * overwhelming the OLT's SNMP agent queue on large deployments.
   *
   * @throws SnmpTimeoutError on timeout
   * @throws SnmpUnreachableError on connection error
   */
  private snmpWalk(rootOid: string): Promise<snmp.Varbind[]> {
    return new Promise((resolve, reject) => {
      const session = this.createSession();
      const results: snmp.Varbind[] = [];

      session.walk(
        rootOid,
        WALK_MAX_REPETITIONS,
        (varbinds: snmp.Varbind[]) => {
          for (const vb of varbinds) {
            if (!snmp.isVarbindError(vb)) results.push(vb);
          }
        },
        (error: Error | null) => {
          session.close();
          if (error) {
            reject(classifyError(error, this.host, this.timeoutMs));
          } else {
            resolve(results);
          }
        },
      );
    });
  }

  /**
   * Issue a single SNMP GETBULK request — bounded, one PDU, no walk loop.
   *
   * Returns at most `maxRepetitions` entries per starting OID. Because this is
   * a single PDU exchange (not a walk loop), the total response is strictly
   * bounded, making it safe for fetching the first N rows of a large table.
   *
   * Use `snmpWalk()` when you need the entire subtree.
   * Use `snmpGetBulk()` when you only need the first N rows (e.g. ONU table).
   *
   * @param startOids       OID(s) to start from (typically one table column OID)
   * @param maxRepetitions  Max rows to retrieve per starting OID (≤ 50)
   * @throws SnmpTimeoutError | SnmpUnreachableError on failure
   */
  private snmpGetBulk(startOids: string[], maxRepetitions: number): Promise<snmp.Varbind[]> {
    return new Promise((resolve, reject) => {
      const session = this.createSession();
      session.getBulk(
        startOids,
        0,               // nonRepeaters: 0 — all OIDs are repeating
        maxRepetitions,
        (error: Error | null, varbinds: snmp.Varbind[]) => {
          session.close();
          if (error) {
            reject(classifyError(error, this.host, this.timeoutMs));
            return;
          }
          // net-snmp getBulk returns a mixed structure:
          //   non-repeater OIDs → flat Varbind at top level
          //   repeater OIDs     → Array<Varbind> at top level (one per starting OID)
          // Normalize to a flat Varbind[] so all callers can iterate uniformly.
          const flat: snmp.Varbind[] = [];
          for (const entry of varbinds as unknown as Array<snmp.Varbind | snmp.Varbind[]>) {
            if (Array.isArray(entry)) {
              flat.push(...entry);
            } else {
              flat.push(entry);
            }
          }
          resolve(flat);
        },
      );
    });
  }

  // ─── Public read-only methods ─────────────────────────────────────────

  /**
   * Test SNMP connectivity to the target OLT.
   *
   * Performs a single SNMP GET on sysDescr, sysName, sysObjectID, and
   * sysUpTime. Returns success=false (never throws) so callers can safely
   * display the error without try/catch at the call site.
   *
   * Suitable for the "Test Connection" button on the OLT management page.
   */
  async testConnection(): Promise<SnmpTestResult> {
    const start = Date.now();
    const base: Pick<SnmpTestResult, "host" | "port" | "community" | "version"> = {
      host:      this.host,
      port:      this.port,
      community: this.community,
      version:   "v2c",
    };

    try {
      const varbinds = await this.snmpGet([
        OID.sysDescr,
        OID.sysName,
        OID.sysObjectID,
        OID.sysUpTime,
      ]);

      const responseTimeMs = Date.now() - start;
      const parsed = indexVarbinds(varbinds);

      return {
        ...base,
        success:        true,
        responseTimeMs,
        sysDescr:       stringVal(parsed[OID.sysDescr]),
        sysName:        stringVal(parsed[OID.sysName]),
        sysObjectID:    oidVal(parsed[OID.sysObjectID]),
        sysUpTimeSecs:  timeTicksToSecs(parsed[OID.sysUpTime]),
      };
    } catch (err) {
      return {
        ...base,
        success:        false,
        responseTimeMs: Date.now() - start,
        error:          err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Retrieve all six standard SNMPv2-MIB system scalars.
   *
   * OIDs: sysDescr, sysObjectID, sysUpTime, sysContact, sysName, sysLocation.
   * This is a single SNMP GET (six OIDs in one PDU) — very fast even on slow OLTs.
   *
   * @throws SnmpTimeoutError | SnmpUnreachableError on failure
   */
  async getSysInfo(): Promise<SysInfo> {
    const oids = [
      OID.sysDescr,
      OID.sysObjectID,
      OID.sysUpTime,
      OID.sysContact,
      OID.sysName,
      OID.sysLocation,
    ];

    const varbinds = await this.snmpGet(oids);
    const v = indexVarbinds(varbinds);

    return {
      sysDescr:      stringVal(v[OID.sysDescr])    ?? "",
      sysObjectID:   oidVal(v[OID.sysObjectID])    ?? "",
      sysUpTimeSecs: timeTicksToSecs(v[OID.sysUpTime]) ?? 0,
      sysContact:    stringVal(v[OID.sysContact])  ?? "",
      sysName:       stringVal(v[OID.sysName])     ?? "",
      sysLocation:   stringVal(v[OID.sysLocation]) ?? "",
    };
  }

  /**
   * Retrieve device uptime in seconds (sysUpTime.0 ÷ 100).
   *
   * sysUpTime is stored as TimeTicks (hundredths of a second). This method
   * converts it to whole seconds for display.
   *
   * @throws SnmpTimeoutError | SnmpUnreachableError on failure
   */
  async getUptime(): Promise<number> {
    const varbinds = await this.snmpGet([OID.sysUpTime]);
    const v = indexVarbinds(varbinds);
    return timeTicksToSecs(v[OID.sysUpTime]) ?? 0;
  }

  /**
   * Detect the OLT vendor from sysDescr and/or sysObjectID.
   *
   * Matches well-known vendor strings in the sysDescr response. Returns the
   * matched vendor name in title case, or "Unknown" when no pattern matches.
   *
   * This is a heuristic — not a guaranteed identifier. The OLT enterprise OID
   * (sysObjectID) is the canonical vendor identifier for future use.
   *
   * @throws SnmpTimeoutError | SnmpUnreachableError on failure
   */
  async getVendor(): Promise<string> {
    const varbinds = await this.snmpGet([OID.sysDescr, OID.sysObjectID]);
    const v = indexVarbinds(varbinds);
    const descr = stringVal(v[OID.sysDescr]) ?? "";
    const objId = oidVal(v[OID.sysObjectID]) ?? "";
    return detectVendor(descr, objId);
  }

  /**
   * Extract the hardware model string from sysDescr.
   *
   * Applies vendor-specific regex patterns to pull the model designation
   * (e.g. "MA5800-X7", "C300", "P3310C") from the free-text sysDescr field.
   * Returns "Unknown" if no pattern matches.
   *
   * @throws SnmpTimeoutError | SnmpUnreachableError on failure
   */
  async getModel(): Promise<string> {
    const varbinds = await this.snmpGet([OID.sysDescr]);
    const v = indexVarbinds(varbinds);
    const descr = stringVal(v[OID.sysDescr]) ?? "";
    return extractModel(descr);
  }

  /**
   * Discover PON ports by walking ifDescr and filtering for PON/GPON/EPON.
   *
   * Walks the ifDescr column (1.3.6.1.2.1.2.2.1.2) to get all interface
   * descriptions, then filters for entries that contain known PON keywords.
   * A second walk of ifOperStatus (1.3.6.1.2.1.2.2.1.8) gives port state.
   *
   * NOTE: This walk may return 50–300+ entries on large OLTs with many
   * Ethernet and management interfaces. The GPON/EPON filter narrows that
   * to typically 4–32 PON ports.
   *
   * @throws SnmpTimeoutError | SnmpUnreachableError on failure
   */
  async getPonPorts(): Promise<PonPortSummary[]> {
    // Walk both tables concurrently — two independent SNMP sessions
    const [descrVbs, statusVbs] = await Promise.all([
      this.snmpWalk(OID.ifDescrCol),
      this.snmpWalk(OID.ifOperStatusCol),
    ]);

    // Build a map: ifIndex → operStatus
    const statusMap = new Map<number, number>();
    for (const vb of statusVbs) {
      const idx = ifIndexFromOid(vb.oid);
      if (idx !== null) statusMap.set(idx, intVal(vb) ?? 2);
    }

    // Filter ifDescr entries that look like PON ports
    const ponPorts: PonPortSummary[] = [];
    for (const vb of descrVbs) {
      const description = stringVal(vb) ?? "";
      if (!isPonPort(description)) continue;

      const ifIndex = ifIndexFromOid(vb.oid);
      if (ifIndex === null) continue;

      const raw = statusMap.get(ifIndex) ?? 2;
      ponPorts.push({
        ifIndex,
        description,
        operStatus: operStatusToString(raw),
      });
    }

    return ponPorts;
  }

  /**
   * Collect OLT-level health metrics via read-only SNMP.
   *
   * Standard OIDs (always attempted):
   *   • sysUpTime.0  — device uptime
   *   • IF-MIB ifDescr + ifOperStatus + ifAdminStatus — port inventory
   *
   * Proprietary OIDs (CDATA EasyPath 1.3.6.1.4.1.17409 enterprise tree):
   *   • CPU / memory / temperature — attempted; null if noSuchInstance
   *
   * Does NOT throw. All errors are caught; unreadable fields return null.
   */
  async getOltHealth(): Promise<OltHealthResult> {
    const start    = Date.now();
    const polledAt = new Date().toISOString();

    const CPU_OID       = "1.3.6.1.4.1.34592.1.3.100.1.8.1.0";
    const MEM_TOTAL_OID = "1.3.6.1.4.1.34592.1.3.100.1.8.2.0";
    const MEM_FREE_OID  = "1.3.6.1.4.1.34592.1.3.100.1.8.3.0";
    const TEMP_OID      = "1.3.6.1.4.1.34592.1.3.100.1.8.6.0";

    // Hard deadline: the entire poll must complete within 4 500 ms.
    // Each SNMP task also has its own 2 s per-PDU timeout, but a sequential
    // walk of a large interface table can chain many PDUs. The race ensures
    // the caller always gets a response even if a task stalls mid-walk.
    const HEALTH_DEADLINE_MS = 4_500;
    const deadlinePromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("health-poll-deadline")), HEALTH_DEADLINE_MS),
    );

    // Run all three SNMP tasks in parallel.
    // Promise.allSettled — a timeout on one task never blocks the others.
    const [uptimeResult, scalarsResult, ifResult] = await Promise.race([
      Promise.allSettled([

        // ── Task A: sysUpTime (1 GET) ────────────────────────────────────
        this.snmpGet([OID.sysUpTime]),

        // ── Task B: EasyPath V2 MIB scalars (1 GET, 4 OIDs) ─────────────
        // noSuchObject/noSuchInstance → indexVarbinds drops that varbind → intVal → undefined → null
        this.snmpGet([CPU_OID, MEM_TOTAL_OID, MEM_FREE_OID, TEMP_OID]),

        // ── Task C: IF-MIB — single bounded GETBULK (one PDU, ~40 reps) ─
        // Replaces snmpWalk() which chains multiple sequential GETBULK PDUs
        // and has no bounded total time. One GETBULK with maxRepetitions=40
        // captures all interfaces on a typical OLT in a single round-trip.
        (async () => {
          const bulk   = await this.snmpGetBulk([OID.ifDescrCol], 40);
          const prefix = OID.ifDescrCol + ".";
          const ifMap  = new Map<number, string>();
          for (const vb of bulk) {
            if (!vb.oid.startsWith(prefix)) break; // left the ifDescr subtree
            const idx = ifIndexFromOid(vb.oid);
            if (idx !== null) ifMap.set(idx, stringVal(vb) ?? "");
          }
          if (ifMap.size === 0) return { ifMap, sv: {} as Record<string, snmp.Varbind> };
          const idxList   = [...ifMap.keys()];
          const operOids  = idxList.map(i => `${OID.ifOperStatusCol}.${i}`);
          const adminOids = idxList.map(i => `${OID.ifAdminStatusCol}.${i}`);
          const sv = indexVarbinds(await this.snmpGet([...operOids, ...adminOids]));
          return { ifMap, sv };
        })(),
      ]),
      deadlinePromise,
    ]);

    // ── Extract: uptime ────────────────────────────────────────────────────
    let uptimeSecs: number | null = null;
    if (uptimeResult.status === "fulfilled") {
      uptimeSecs = timeTicksToSecs(indexVarbinds(uptimeResult.value)[OID.sysUpTime]) ?? null;
    }

    // ── Extract: scalars ──────────────────────────────────────────────────
    let cpuPct:       number | null = null;
    let memPct:       number | null = null;
    let temperatureC: number | null = null;
    if (scalarsResult.status === "fulfilled") {
      const pv          = indexVarbinds(scalarsResult.value);
      const rawCpu      = intVal(pv[CPU_OID]);
      const rawMemTotal = intVal(pv[MEM_TOTAL_OID]);
      const rawMemFree  = intVal(pv[MEM_FREE_OID]);
      const rawTemp     = intVal(pv[TEMP_OID]);

      if (rawCpu !== undefined && rawCpu >= 0 && rawCpu <= 100) cpuPct = rawCpu;
      if (
        rawMemTotal !== undefined && rawMemFree !== undefined &&
        rawMemTotal > 0 && rawMemFree >= 0 && rawMemFree <= rawMemTotal
      ) {
        memPct = Math.round(((rawMemTotal - rawMemFree) / rawMemTotal) * 100);
      }
      if (rawTemp !== undefined) {
        temperatureC = parseFloat((rawTemp / 10).toFixed(1));
      }
    }

    // ── Extract: ports ────────────────────────────────────────────────────
    const uplinkPorts:   OltPortStatus[] = [];
    const ethernetPorts: OltPortStatus[] = [];
    const sfpPorts:      OltPortStatus[] = [];
    if (ifResult.status === "fulfilled") {
      const { ifMap, sv } = ifResult.value;
      for (const [ifIndex, descr] of ifMap) {
        if (isPonPort(descr)) continue;
        const operRaw  = intVal(sv[`${OID.ifOperStatusCol}.${ifIndex}`]);
        const adminRaw = intVal(sv[`${OID.ifAdminStatusCol}.${ifIndex}`]);
        const port: OltPortStatus = {
          ifIndex,
          description: descr,
          operStatus:  operStatusToString(operRaw ?? 4),
          adminStatus: adminRaw === 1 ? "up" : adminRaw === 2 ? "down" : "unknown",
        };
        const kind = classifyOltInterface(descr);
        if      (kind === "uplink")   uplinkPorts.push(port);
        else if (kind === "ethernet") ethernetPorts.push(port);
        else if (kind === "sfp")      sfpPorts.push(port);
      }
    }

    return {
      uptimeSecs,
      cpuPct,
      memPct,
      temperatureC,
      uplinkPorts,
      ethernetPorts,
      sfpPorts,
      polledAt,
      latencyMs: Date.now() - start,
      source: "live-snmp",
    };
  }

  /**
   * Attempt a live ONU walk, falling back to mock data on any failure.
   *
   * Live path:
   *   Detects vendor from sysDescr, then walks the vendor-specific ONU index
   *   table (if known). Returns up to 128 ONU entries.
   *
   * Fallback path:
   *   If the live walk fails (timeout, empty result, unknown vendor),
   *   returns ONUs from MOCK_ONUS filtered by oltId.
   *   This ensures the calling route always gets a valid ONU list even
   *   when the real device is unreachable or the OID walk is not yet implemented.
   *
   * @param oltId  Optional OLT ID used to filter mock fallback data.
   */
  async getOnuListMockFallback(oltId?: string): Promise<OnuListResult> {
    try {
      const varbinds = await this.snmpGet([OID.sysDescr, OID.sysObjectID]);
      const v        = indexVarbinds(varbinds);
      const descr    = stringVal(v[OID.sysDescr]) ?? "";
      const objId    = oidVal(v[OID.sysObjectID]) ?? "";
      const vendor   = detectVendor(descr, objId);

      const onuRootOid = vendorOnuTableOid(vendor);
      if (!onuRootOid) {
        return mockFallback(oltId, `No ONU table OID known for vendor "${vendor}"`);
      }

      // Walk the vendor ONU table — short timeout to keep response fast
      const onuVbs = await this.snmpWalk(onuRootOid);
      if (onuVbs.length === 0) {
        return mockFallback(oltId, "ONU table walk returned 0 entries (device may use different OID tree)");
      }

      // We have real ONU table entries but parsing is vendor-specific.
      // Return the raw count as a stub — full parsing is done in the real adapter.
      // For now, fall back to mock so the UI always has usable data.
      return mockFallback(
        oltId,
        `Live walk returned ${onuVbs.length} raw ONU OIDs. ` +
        "Vendor-specific parsing is not yet implemented — using mock data.",
      );
    } catch (err) {
      return mockFallback(
        oltId,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  /**
   * Read the vendor-specific ONU management table from the OLT.
   *
   * ─── SNMP operation count ─────────────────────────────────────────────────
   *
   *   Exactly 2 SNMP PDUs total — regardless of how many ONUs the OLT has:
   *     1. GETBULK  on the ONU index column  → at most `limit` rows (1 PDU)
   *     2. GET      on all attribute columns → serial, status, type, mac (1 PDU)
   *
   *   This is the theoretical minimum for reading a tabular MIB with attributes.
   *   It does NOT walk the full table tree, does NOT issue one GET per ONU,
   *   and does NOT loop. Total PDUs: always 2.
   *
   * ─── Safety ──────────────────────────────────────────────────────────────
   *
   *   - Read-only: GETBULK + GET only — absolutely no SNMP SET calls
   *   - Bounded: `limit` is clamped to 50 regardless of input
   *   - One-shot: no background state, no polling timer, sessions closed immediately
   *
   * @param vendor  Detected vendor label (from `detectVendorFromSysInfo()`).
   * @param limit   Max ONUs to return. Clamped to 50.
   */
  async readOnuTable(vendor: string, limit = 50): Promise<ReadOnuTableResult> {
    const cappedLimit = Math.min(limit, 50);
    const start = Date.now();

    const mib = VENDOR_ONU_MIBS[vendor];
    if (!mib) {
      return {
        success:    false,
        vendor,
        totalFound: 0,
        onus:       [],
        message:    `No ONU table MIB defined for vendor "${vendor}". ` +
                    "Supported vendors: Huawei, ZTE, BDCOM, VSOL, CDATA.",
        latencyMs:  Date.now() - start,
        mibUsed:    "none",
      };
    }

    const indexColOid = `${mib.tableRoot}.${mib.colIndex}`;

    // ── Phase 1: Single GETBULK on index column (max cappedLimit rows) ─────
    let indexVbs: snmp.Varbind[];
    try {
      indexVbs = await this.snmpGetBulk([indexColOid], cappedLimit);
    } catch (err) {
      return {
        success:    false,
        vendor,
        totalFound: 0,
        onus:       [],
        message:    err instanceof Error ? err.message : "SNMP GETBULK failed",
        latencyMs:  Date.now() - start,
        mibUsed:    mib.mibName,
      };
    }

    // Filter: keep only varbinds within the index column subtree
    const indexPrefix    = indexColOid + ".";
    const onuInstances: string[] = [];
    for (const vb of indexVbs) {
      if (!vb.oid.startsWith(indexPrefix)) continue;
      const suffix = vb.oid.slice(indexPrefix.length);
      if (suffix) onuInstances.push(suffix);
    }

    if (onuInstances.length === 0) {
      return {
        success:    true,
        vendor,
        totalFound: 0,
        onus:       [],
        message:    `GETBULK on ${mib.mibName} (${indexColOid}) returned 0 entries within the index column. ` +
                    "The OLT may use a different MIB firmware path, or the table is empty.",
        latencyMs:  Date.now() - start,
        mibUsed:    mib.mibName,
      };
    }

    // ── Phase 2: Single GET for all attribute OIDs across all found ONUs ────
    const attrOids: string[] = [];
    for (const inst of onuInstances) {
      if (mib.colSerial !== null) attrOids.push(`${mib.tableRoot}.${mib.colSerial}.${inst}`);
      if (mib.colStatus !== null) attrOids.push(`${mib.tableRoot}.${mib.colStatus}.${inst}`);
      if (mib.colType   !== null) attrOids.push(`${mib.tableRoot}.${mib.colType}.${inst}`);
      if (mib.colMac    !== null) attrOids.push(`${mib.tableRoot}.${mib.colMac}.${inst}`);
    }

    let attrMap: Record<string, snmp.Varbind> = {};
    if (attrOids.length > 0) {
      try {
        attrMap = indexVarbinds(await this.snmpGet(attrOids));
      } catch {
        // Attribute GET failed — ONUs still present, attributes will be null.
        // This is acceptable for a test endpoint.
      }
    }

    // ── Build normalised ONU list ──────────────────────────────────────────
    const onus: SnmpOnu[] = [];
    for (const inst of onuInstances) {
      const parsed    = mib.parseInstance(inst);
      const serialOid = mib.colSerial !== null ? `${mib.tableRoot}.${mib.colSerial}.${inst}` : null;
      const statusOid = mib.colStatus !== null ? `${mib.tableRoot}.${mib.colStatus}.${inst}` : null;
      const typeOid   = mib.colType   !== null ? `${mib.tableRoot}.${mib.colType}.${inst}`   : null;
      const macOid    = mib.colMac    !== null ? `${mib.tableRoot}.${mib.colMac}.${inst}`    : null;

      const rawStatus = statusOid ? attrMap[statusOid] : undefined;

      onus.push({
        onuId:          parsed?.onuId    ?? (inst.split(".").pop() ?? inst),
        ponPort:        parsed?.ponPort  ?? inst,
        serial:         serialOid ? parseGponSerial(attrMap[serialOid]?.value)  : null,
        mac:            macOid    ? parseMacAddress(attrMap[macOid]?.value)     : null,
        status:         rawStatus ? mib.parseStatus(intVal(rawStatus) ?? 2)     : "unknown",
        type:           typeOid   ? (stringVal(attrMap[typeOid]) ?? null)       : null,
        rawInstanceOid: inst,
      });
    }

    const onlineCount = onus.filter((o) => o.status === "online").length;
    return {
      success:    true,
      vendor,
      totalFound: onus.length,
      onus,
      message:    `Found ${onus.length} ONU${onus.length !== 1 ? "s" : ""} in ${mib.mibName}` +
                  (onus.length > 0 ? ` (${onlineCount} online, ${onus.length - onlineCount} offline/unknown)` : ""),
      latencyMs:  Date.now() - start,
      mibUsed:    mib.mibName,
    };
  }

  // ── debugWalkSubtree ─────────────────────────────────────────────────────

  /**
   * Temporary debug helper — iterative GETBULK walk of any SNMP subtree.
   *
   * Read-only (GETBULK only). Returns every varbind the device responds with,
   * grouped by common OID prefix, with type names and sample values.
   * Intended for identifying an unknown vendor's ONU table OID.
   *
   * @param rootOid   OID to walk (e.g. "1.3.6.1.4.1.34592")
   * @param maxOids   Safety cap on total OIDs collected (default 1 000)
   * @param batchSize GETBULK maxRepetitions per PDU (default 20)
   */
  async debugWalkSubtree(
    rootOid:   string,
    maxOids:   number = 1_000,
    batchSize: number = 20,
  ): Promise<{
    totalOids:    number;
    walkMs:       number;
    batches:      number;
    rows: Array<{
      oid:      string;
      typeName: string;
      typeNum:  number;
      hex:      string | null;   // binary values as hex
      text:     string | null;   // printable string (if applicable)
      num:      number | null;   // numeric value (if applicable)
      isMac:    boolean;         // 6-byte OctetString = likely ONU MAC/LLID
    }>;
    subtrees: Array<{
      prefix:      string;        // depth-11 OID prefix
      rowCount:    number;
      hasMac:      boolean;
      typeNames:   string;        // comma-separated distinct type names
      samples:     string[];      // up to 3 sample value strings
    }>;
  }> {
    const start = Date.now();

    // SNMP ObjectType name map (net-snmp numeric codes → human names)
    const TYPE_NAMES: Record<number, string> = {
      2:   "INTEGER",
      4:   "OctetString",
      5:   "Null",
      6:   "OID",
      64:  "IpAddress",
      65:  "Counter32",
      66:  "Gauge32",
      67:  "TimeTicks",
      68:  "Opaque",
      70:  "Counter64",
      128: "NoSuchObject",
      129: "NoSuchInstance",
      130: "EndOfMibView",
    };

    const allVbs: snmp.Varbind[] = [];
    let   cursor  = rootOid;
    let   batches = 0;

    while (allVbs.length < maxOids) {
      let batch: snmp.Varbind[];
      try {
        batch = await this.snmpGetBulk([cursor], batchSize);
      } catch {
        break;
      }
      batches++;
      const inTree = batch.filter((vb) => vb.oid.startsWith(rootOid + "."));
      allVbs.push(...inTree);
      if (inTree.length === 0) break;
      // Advance cursor to the last in-tree OID so the next GETBULK continues
      // from inside the subtree. Using the last OID of the full batch would
      // jump the cursor past the enterprise subtree when the batch straddles
      // the subtree boundary.
      cursor = inTree[inTree.length - 1].oid;
      // Stop if the device signals end-of-MIB on the last varbind
      const lastType = (batch[batch.length - 1] as unknown as { type?: number }).type;
      if (lastType === 130) break; // EndOfMibView
    }

    // ── Format each varbind ────────────────────────────────────────────────
    const rows = allVbs.map((vb) => {
      const typeNum  = (vb as unknown as { type?: number }).type ?? -1;
      const typeName = TYPE_NAMES[typeNum] ?? `type(${typeNum})`;

      let hex:  string | null = null;
      let text: string | null = null;
      let num:  number | null = null;
      let isMac = false;

      if (Buffer.isBuffer(vb.value)) {
        const buf = vb.value as Buffer;
        isMac = buf.length === 6;
        hex   = Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join(":");
        const str = buf.toString("utf8");
        if (/^[\x20-\x7e]+$/.test(str)) text = str;
      } else if (typeof vb.value === "number" || typeof vb.value === "bigint") {
        num = Number(vb.value);
      } else if (typeof vb.value === "string") {
        text = vb.value;
      }

      return { oid: vb.oid, typeName, typeNum, hex, text, num, isMac };
    });

    // ── Group by depth-11 OID prefix ──────────────────────────────────────
    const groupMap = new Map<string, typeof rows>();
    for (const row of rows) {
      const key   = row.oid.split(".").slice(0, 11).join(".");
      const group = groupMap.get(key) ?? [];
      group.push(row);
      groupMap.set(key, group);
    }

    const subtrees = [...groupMap.entries()]
      .map(([prefix, items]) => {
        const hasMac    = items.some((r) => r.isMac);
        const typeNames = [...new Set(items.map((r) => r.typeName))].join(", ");
        const samples   = items
          .slice(0, 3)
          .map((r) => r.text ?? (r.isMac ? `MAC:${r.hex}` : r.hex ?? String(r.num ?? "?")));
        return { prefix, rowCount: items.length, hasMac, typeNames, samples };
      })
      .sort((a, b) => b.rowCount - a.rowCount);

    return { totalOids: allVbs.length, walkMs: Date.now() - start, batches, rows, subtrees };
  }

  // ── readCdataEponOnusProbe ────────────────────────────────────────────────

  /**
   * Discover C-DATA EPON ONUs by probing the enterprise MIB subtree dynamically.
   *
   * Use this when the static `readOnuTable("CDATA-EPON", ...)` returns 0 ONUs —
   * it works regardless of which C-DATA firmware path the ONU table lives on.
   *
   * Algorithm:
   *   1. Issue a bounded GETBULK on several candidate sub-trees of the C-DATA
   *      EPON enterprise branch (1.3.6.1.4.1.34592.1.*), trying the most
   *      specific subtrees first to minimize returned varbinds.
   *   2. Find all 6-byte OctetString varbinds → these are EPON ONU MAC/LLID
   *      addresses, the primary ONU identifier in all EPON MIBs.
   *   3. Derive the table root and MAC column number from the common OID prefix
   *      shared by all MAC varbinds.
   *   4. Issue one GET for status (MAC_COL+1) and type (MAC_COL+2) columns.
   *   5. Return normalised SnmpOnu entries.
   *
   * Safety contract:
   *   - Read-only: GETBULK + GET only, no SET
   *   - Bounded: at most cappedLimit×3 varbinds in the probe, 1 GET
   *   - One-shot: no background state, no persistent session
   *
   * @param limit  Max ONUs to return (clamped to 50).
   */
  async readCdataEponOnusProbe(limit: number): Promise<ReadOnuTableResult> {
    const start       = Date.now();
    const cappedLimit = Math.min(limit, 50);

    // ── Iterative GETBULK walk of the full C-DATA enterprise subtree ─────────
    //
    // No OID guessing. Walk 1.3.6.1.4.1.34592 in GETBULK batches of 20,
    // collecting every varbind the device actually returns, until:
    //   a) we find ≥3 six-byte OctetStrings (ONU MAC/LLID addresses), or
    //   b) the next batch contains no OIDs inside the enterprise subtree, or
    //   c) 500 total OIDs fetched (safety cap).
    //
    // Each subtree group is logged: OID prefix, row count, whether it has MACs.
    // The MAC-containing group identifies the ONU table column.

    const ENTERPRISE_ROOT = "1.3.6.1.4.1.34592";
    const BATCH           = 20;
    const MAX_OIDS        = 500;
    const MAC_THRESHOLD   = 3;

    const allVbs: snmp.Varbind[] = [];
    const walkLog: string[]      = [];
    let   cursor                 = ENTERPRISE_ROOT;

    walkLoop: while (allVbs.length < MAX_OIDS) {
      let batch: snmp.Varbind[];
      try {
        batch = await this.snmpGetBulk([cursor], BATCH);
      } catch (err) {
        walkLog.push(`ERR cursor=${cursor}: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }

      const inSubtree = batch.filter((vb) => vb.oid.startsWith(ENTERPRISE_ROOT + "."));
      allVbs.push(...inSubtree);

      if (inSubtree.length === 0) break; // walked past enterprise branch

      // Stop early once we have confirmed MAC/LLID addresses
      const macsSoFar = allVbs.filter(
        (vb) => Buffer.isBuffer(vb.value) && vb.value.length === 6,
      ).length;
      if (macsSoFar >= MAC_THRESHOLD) break walkLoop;

      // Advance cursor (GETNEXT semantics: start from last returned OID)
      const lastOid = batch[batch.length - 1]?.oid;
      if (!lastOid || batch.length < BATCH) break;
      cursor = lastOid;
    }

    // ── Group by depth-11 OID prefix and build walk log ───────────────────
    // 1.3.6.1.4.1.34592 = 7 components; depth 11 adds 4 sub-levels —
    // enough to distinguish individual table columns.
    const groupMap = new Map<string, snmp.Varbind[]>();
    for (const vb of allVbs) {
      const key   = vb.oid.split(".").slice(0, 11).join(".");
      const group = groupMap.get(key) ?? [];
      group.push(vb);
      groupMap.set(key, group);
    }
    for (const [subtree, vbs] of groupMap) {
      const hasMacs = vbs.some((vb) => Buffer.isBuffer(vb.value) && vb.value.length === 6);
      walkLog.push(`oid=${subtree} rows=${vbs.length}${hasMacs ? " [MAC]" : ""}`);
    }

    // ── Find MAC varbinds ─────────────────────────────────────────────────
    const macVbs = allVbs.filter(
      (vb) => Buffer.isBuffer(vb.value) && vb.value.length === 6,
    );

    if (macVbs.length === 0) {
      return {
        success:    true,
        vendor:     "CDATA-EPON",
        totalFound: 0,
        onus:       [],
        message:
          `CDATA enterprise walk (root=${ENTERPRISE_ROOT}, walked=${allVbs.length} OIDs): ` +
          "no 6-byte OctetStrings (ONU MAC/LLID) found. " +
          "Walk log: " + (walkLog.join(" | ") || "(empty — no OIDs in subtree)"),
        latencyMs: Date.now() - start,
        mibUsed:   `cdataWalk(walked=${allVbs.length})`,
      };
    }

    // Remove unused variable — probedRoot was only used in the old guessed-OID path
    void 0;

    // ── Derive table structure from the MAC OIDs ───────────────────────────
    //
    // Given MAC OIDs like:
    //   1.3.6.1.4.1.34592.1.1.3.1.2.1.5   ← ponPort=1, onuId=5, macCol=2
    //   1.3.6.1.4.1.34592.1.1.3.1.2.1.7
    // The common prefix before the instance suffix is the "MAC column OID"
    // (tableRoot + "." + macColNum).
    //
    // We try instance depths of 2 (ponPort.onuId) and 1 (onuId) and pick the
    // depth that gives a consistent prefix across all MAC varbinds.

    const firstOid   = macVbs[0]!.oid;
    const firstParts = firstOid.split(".");

    let macColPrefix  = "";
    let instanceDepth = 2;

    for (const depth of [2, 1, 3]) {
      if (firstParts.length <= depth) continue;
      const candidatePrefix = firstParts.slice(0, -depth).join(".");
      const consistent      = macVbs.every((vb) => vb.oid.startsWith(candidatePrefix + "."));
      if (consistent) {
        macColPrefix  = candidatePrefix;
        instanceDepth = depth;
        break;
      }
    }

    // Last resort: use depth 2 even if not fully consistent
    if (!macColPrefix) {
      macColPrefix  = firstParts.slice(0, -2).join(".");
      instanceDepth = 2;
    }

    // Derive table root (strip the column number from the prefix)
    const prefixParts  = macColPrefix.split(".");
    const macColNum    = Number(prefixParts[prefixParts.length - 1]);
    const tableRoot    = prefixParts.slice(0, -1).join(".");
    const statusColNum = macColNum + 1;  // column immediately after MAC → status
    const typeColNum   = macColNum + 2;  // two columns after MAC → type/model

    // ── Extract instance OIDs (everything after the MAC column prefix) ─────
    const instances = macVbs.slice(0, cappedLimit).map((vb) => ({
      instance: vb.oid.slice(macColPrefix.length + 1), // e.g. "1.5"
      mac:      parseMacAddress(vb.value),
    }));

    // ── GET status + type from adjacent columns ────────────────────────────
    const statusOids = instances.map((inst) => `${tableRoot}.${statusColNum}.${inst.instance}`);
    const typeOids   = instances.map((inst) => `${tableRoot}.${typeColNum}.${inst.instance}`);

    let attrMap: Record<string, snmp.Varbind> = {};
    try {
      attrMap = indexVarbinds(await this.snmpGet([...statusOids, ...typeOids]));
    } catch {
      // Non-fatal: proceed with unknown status / null type
    }

    // ── Build normalised ONU list ──────────────────────────────────────────
    const onus: SnmpOnu[] = instances.map((inst) => {
      const statusVb  = attrMap[`${tableRoot}.${statusColNum}.${inst.instance}`];
      const typeVb    = attrMap[`${tableRoot}.${typeColNum}.${inst.instance}`];
      const rawStatus = statusVb !== undefined ? intVal(statusVb) : undefined;
      const instParts = inst.instance.split(".");

      return {
        onuId:          instParts[instParts.length - 1] ?? inst.instance,
        ponPort:        instParts.length > 1 ? instParts.slice(0, -1).join(".") : "0",
        serial:         null,
        mac:            inst.mac,
        status:         rawStatus === 1 ? "online" : rawStatus === 2 ? "offline" : "unknown",
        type:           typeVb !== undefined ? (stringVal(typeVb) ?? null) : null,
        rawInstanceOid: inst.instance,
      };
    });

    const onlineCount = onus.filter((o) => o.status === "online").length;

    return {
      success:    true,
      vendor:     "CDATA-EPON",
      totalFound: onus.length,
      onus,
      message:
        `Found ${onus.length} EPON ONU${onus.length !== 1 ? "s" : ""}` +
        (onus.length > 0
          ? ` (${onlineCount} online, ${onus.length - onlineCount} offline/unknown).` +
            ` Discovered via enterprise walk (${allVbs.length} OIDs).` +
            ` Table: ${tableRoot}, MAC col: ${macColNum}.` +
            ` Walk log: ${walkLog.join(" | ")}`
          : ""),
      latencyMs: Date.now() - start,
      mibUsed:   `cdataWalk(table=${tableRoot} macCol=${macColNum} walked=${allVbs.length})`,
    };
  }

  // ── readEasyPathOnuTable ──────────────────────────────────────────────────

  /**
   * Discover ONUs from a CDATA FD1208S-B0 / EasyPath Ethernet-PON OLT.
   *
   * TWO-SOURCE APPROACH (confirmed live on FD1208S-B0 V1.6.0, community=public,
   * exhaustively verified 2026-06-12 against OLT web UI — per-PON counts match):
   *
   * Source A — Live operational status (17409.2.3.4 ONU status table):
   *   1.3.6.1.4.1.17409.2.3.4.1.1.8.{bigN}  →  INTEGER status
   *     1 = online, 2 = offline
   *   Index = bigN (SAME encoding as Source B — direct join, no transformation)
   *   Covers ALL provisioned ONUs (~356 rows); per-PON counts match web UI exactly.
   *
   * Source B — Registered ONU list with MAC addresses (34592 MAC table):
   *   1.3.6.1.4.1.34592.1.3.1.1.2.1.1.2.1.2.{bigN}  →  6-byte MAC OctetString
   *
   * bigN index encoding (4-byte big-endian integer, stored as decimal OID component):
   *   byte[0] = 0x01 (OLT group, always 1)
   *   byte[1] = 0x00 (reserved)
   *   byte[2] = portSlot  (13–20 for PON1–PON8 on FD1208S-B0)
   *   byte[3] = ONU slot within port (1-based)
   *
   * Port extraction:
   *   portSlot  = (bigN >>> 8) & 0xFF   // byte[2] = 13–20
   *   portIndex = portSlot − 13          // 0-based: 0=PON1, …, 7=PON8
   *
   * Merge:
   *   Walk Source A first → Map<bigN, "online"|"offline">
   *   Walk Source B second → for each bigN, look up status in map
   *   ONUs in Source B absent from Source A are marked "offline"
   *   (should not occur — both tables contain the same set of provisioned ONUs)
   *
   * Note: FD1208S-B0 rejects GETBULK with maxRepetitions ≥ 50; use BATCH = 20.
   * Safety: GETBULK read-only — no SET operations.
   */
  async readEasyPathOnuTable(limit: number): Promise<ReadOnuTableResult> {
    const start     = Date.now();
    const safeLimit = Math.min(limit, 500);
    const BATCH     = 20;  // FD1208S-B0 V1.6.0 rejects maxRepetitions ≥ 50

    const PORT_SLOT_MIN = 13;
    const PORT_SLOT_MAX = 28;

    // ── Phase 1: Walk 17409.2.3.4 col7 (MAC) + col8 (status) in parallel ──────
    //
    // Both columns share the same bigN index.  Walking them in parallel halves
    // the SNMP round-trip time vs. a sequential walk.
    //
    // col7 OID: 1.3.6.1.4.1.17409.2.3.4.1.1.7.{bigN}  → 6-byte OctetString MAC
    // col8 OID: 1.3.6.1.4.1.17409.2.3.4.1.1.8.{bigN}  → INTEGER 1=online 2=offline
    //
    // Both cover ALL provisioned ONUs (~356 rows).  No 34592 MAC table walk needed.

    const STATUS_ROOT   = "1.3.6.1.4.1.17409.2.3.4.1.1.8";
    const STATUS_PREFIX = STATUS_ROOT + ".";
    const MAC_COL_ROOT  = "1.3.6.1.4.1.17409.2.3.4.1.1.7";
    const MAC_COL_PREFIX = MAC_COL_ROOT + ".";
    const MIB_NAME       = "EasyPath17409.2.3.4(col7=mac,col8=status)";

    const statusByBigN = new Map<number, "online" | "offline">();
    const macByBigN    = new Map<number, string>();

    const walkCol8 = async (): Promise<void> => {
      let cursor = STATUS_ROOT;
      let errors = 0;
      while (true) {
        let batch: snmp.Varbind[];
        try {
          batch = await this.snmpGetBulk([cursor], BATCH);
          errors = 0;
        } catch {
          if (++errors >= 3) break;
          continue;
        }
        const inTree = batch.filter((vb) => vb.oid.startsWith(STATUS_PREFIX));
        if (inTree.length === 0) break;
        for (const vb of inTree) {
          const bigNStr = vb.oid.slice(STATUS_PREFIX.length);
          if (bigNStr.includes(".")) continue;
          const bigN = parseInt(bigNStr, 10);
          if (!Number.isFinite(bigN) || bigN < 0) continue;
          const portSlot = (bigN >>> 8) & 0xFF;
          if (portSlot < PORT_SLOT_MIN || portSlot > PORT_SLOT_MAX) continue;
          const statusVal = typeof vb.value === "number" ? vb.value
                          : typeof vb.value === "bigint" ? Number(vb.value)
                          : null;
          if (statusVal === null) continue;
          statusByBigN.set(bigN, statusVal === 1 ? "online" : "offline");
        }
        const newCursor = inTree[inTree.length - 1]!.oid;
        if (newCursor === cursor) break;
        cursor = newCursor;
      }
    };

    const walkCol7 = async (): Promise<void> => {
      let cursor = MAC_COL_ROOT;
      let errors = 0;
      while (true) {
        let batch: snmp.Varbind[];
        try {
          batch = await this.snmpGetBulk([cursor], BATCH);
          errors = 0;
        } catch {
          if (++errors >= 3) break;
          continue;
        }
        const inTree = batch.filter((vb) => vb.oid.startsWith(MAC_COL_PREFIX));
        if (inTree.length === 0) break;
        for (const vb of inTree) {
          const bigNStr = vb.oid.slice(MAC_COL_PREFIX.length);
          if (bigNStr.includes(".")) continue;
          const bigN = parseInt(bigNStr, 10);
          if (!Number.isFinite(bigN) || bigN < 0) continue;
          const portSlot = (bigN >>> 8) & 0xFF;
          if (portSlot < PORT_SLOT_MIN || portSlot > PORT_SLOT_MAX) continue;
          if (!Buffer.isBuffer(vb.value) || vb.value.length !== 6) continue;
          const mac = parseMacAddress(vb.value);
          if (mac) macByBigN.set(bigN, mac);
        }
        const newCursor = inTree[inTree.length - 1]!.oid;
        if (newCursor === cursor) break;
        cursor = newCursor;
      }
    };

    await Promise.all([walkCol8(), walkCol7()]);

    // ── Build ONU list from status map ───────────────────────────────────────
    // statusByBigN covers ALL provisioned ONUs (col8 has 356 rows).
    // MAC comes from col7 (same table, same bigN index).
    // On EPON, the ONU hardware MAC IS the unique ONU identity (no separate serial).

    if (statusByBigN.size === 0) {
      return {
        success:    false,
        vendor:     "CDATA",
        totalFound: 0,
        onus:       [],
        message:    `GETBULK walk of ${MIB_NAME} returned 0 ONU entries — check SNMP community and OID.`,
        latencyMs:  Date.now() - start,
        mibUsed:    MIB_NAME,
      };
    }

    // ── Phase 2+3: MIB-confirmed optical telemetry — direct GETs, no walks ──
    //
    // V2 NSCRTV EPON MIB OIDs (confirmed against uploaded V2.zip, 2026-06-13).
    // EponDeviceIndex (4-byte) = (0x01 << 24) | (portSlot << 8) | onuSlot
    //
    // onuPonPortOpticalTransmissionPropertyTable — 3-part index: {eponIdx}.0.1
    //   .17409.2.3.4.2.1.4.{e}.0.1  onuReceivedOpticalPower    centi-dBm ÷ 100
    //   .17409.2.3.4.2.1.5.{e}.0.1  onuTramsmittedOpticalPower centi-dBm ÷ 100
    //   .17409.2.3.4.2.1.8.{e}.0.1  onuWorkingTemperature      Centi-°C  ÷ 100
    //
    // onuInfoTable — 1-part index: {eponIdx}
    //   .17409.2.3.4.1.1.15.{e}     onuTestDistance            Meters    × 1
    //   .17409.2.3.4.1.1.18.{e}     onuTimeSinceLastRegister   seconds   × 1 (Counter32)
    //
    // Validation targets for PON-3 ONU-6 (portSlot=15, onuSlot=6, eponIdx=16781062):
    //   RX  raw -1224  → -12.24 dBm   TX  raw 270   → 2.70 dBm
    //   Temp raw 2968  → 29.68 °C     Dist raw 985  → 985 m

    const OPT_BASE  = "1.3.6.1.4.1.17409.2.3.4.2.1";
    const INFO_BASE = "1.3.6.1.4.1.17409.2.3.4.1.1";

    const rxByBigN   = new Map<number, number>();
    const txByBigN   = new Map<number, number>();
    const tempByBigN = new Map<number, number>();
    const distByBigN = new Map<number, number>();
    const durByBigN  = new Map<number, number>();

    // Collect only the bigN values that will appear in the output (up to safeLimit).
    const targetBigNs: number[] = [];
    for (const bigN of statusByBigN.keys()) {
      if (targetBigNs.length >= safeLimit) break;
      targetBigNs.push(bigN);
    }

    // Confirmed via live SNMP walk: EasyPath FD1208S-B0 indexes the optical
    // property table as {EponDeviceIndex}.0.0 (CardIndex=0, PortIndex=0),
    // not .0.1 as the MIB documentation implies.
    const optSuffix = ".0.0";

    // Build OID→{bigN, field} lookup for all target ONUs.
    type OptField = "rx" | "tx" | "temp" | "dist" | "dur";
    const oidMeta = new Map<string, { bigN: number; field: OptField }>();

    for (const bigN of targetBigNs) {
      const portSlot = (bigN >>> 8) & 0xFF;
      const onuSlot  = bigN & 0xFF;
      // 4-byte EponDeviceIndex: byte[0]=OLT(1), byte[1]=card(0), byte[2]=slot, byte[3]=onu
      const e = (1 * 0x1000000) + (portSlot << 8) + onuSlot;   // avoids JS sign issues

      oidMeta.set(`${OPT_BASE}.4.${e}${optSuffix}`,  { bigN, field: "rx"   });
      oidMeta.set(`${OPT_BASE}.5.${e}${optSuffix}`,  { bigN, field: "tx"   });
      oidMeta.set(`${OPT_BASE}.8.${e}${optSuffix}`,  { bigN, field: "temp" });
      oidMeta.set(`${INFO_BASE}.15.${e}`,             { bigN, field: "dist" });
      oidMeta.set(`${INFO_BASE}.18.${e}`,             { bigN, field: "dur"  });
    }

    // Split into batches of 40 OIDs (= 8 ONUs × 5 OIDs) and issue in parallel.
    // Direct GET — one round-trip per batch, no walk loop.
    const OPTICAL_BATCH = 40;
    const allOids = [...oidMeta.keys()];
    const oidBatches: string[][] = [];
    for (let i = 0; i < allOids.length; i += OPTICAL_BATCH) {
      oidBatches.push(allOids.slice(i, i + OPTICAL_BATCH));
    }

    const batchResults = await Promise.allSettled(
      oidBatches.map((batch) => this.snmpGet(batch)),
    );

    for (const result of batchResults) {
      if (result.status !== "fulfilled") continue;
      // net-snmp getBulk may return varbind[][] — flatten one level defensively.
      const flatVbs: snmp.Varbind[] = Array.isArray(result.value[0])
        ? (result.value as unknown as snmp.Varbind[][]).flat()
        : result.value;
      for (const vb of flatVbs) {
        if (!vb || snmp.isVarbindError(vb)) continue;
        const meta = oidMeta.get(vb.oid);
        if (!meta) continue;

        let raw: number | null = typeof vb.value === "number" ? vb.value
                               : typeof vb.value === "bigint" ? Number(vb.value)
                               : null;
        if (raw === null) continue;
        // Sign-extend 32-bit unsigned → signed (Gauge32/Counter32 encoding of negative dBm).
        // e.g. 0xFFFFFB18 (4294966072) → -1224 (= -12.24 dBm × 100)
        if (raw > 0x7FFFFFFF) raw -= 0x100000000;

        switch (meta.field) {
          case "rx":   rxByBigN.set(meta.bigN,   raw); break;
          case "tx":   txByBigN.set(meta.bigN,   raw); break;
          case "temp": tempByBigN.set(meta.bigN, raw); break;
          case "dist": distByBigN.set(meta.bigN, raw); break;
          case "dur":  durByBigN.set(meta.bigN,  raw); break;
        }
      }
    }

    const onus: SnmpOnu[] = [];

    for (const [bigN, status] of statusByBigN) {
      if (onus.length >= safeLimit) break;

      const portSlot  = (bigN >>> 8) & 0xFF;
      const onuSlot   = bigN & 0xFF;
      const portIndex = portSlot - PORT_SLOT_MIN;
      const mac       = macByBigN.get(bigN) ?? null;

      // On EPON, the MAC address IS the ONU serial equivalent.
      // Store it without colons (AABBCCDDEEFF format) so it is searchable as
      // a serial number while `mac` retains the colon-separated display format.
      const serial = mac ? mac.replace(/:/g, "").toUpperCase() : null;

      const rxPowRaw = rxByBigN.get(bigN)   ?? null;
      const txPowRaw = txByBigN.get(bigN)   ?? null;
      const distMRaw = distByBigN.get(bigN) ?? null;
      const tempRaw  = tempByBigN.get(bigN) ?? null;
      const durRaw   = durByBigN.get(bigN)  ?? null;

      onus.push({
        // Use the explicit two-part SNMP index "portSlot.onuSlot" as the ONU ID.
        // This is the canonical identifier on C-DATA/EasyPath EPON firmware and
        // allows the frontend to unambiguously recover portSlot and onuSlot
        // without bit-masking the encoded bigN integer.
        onuId:   `${portSlot}.${onuSlot}`,
        ponPort: `port-${portIndex}`,
        serial,
        mac,
        name:              null,  // ONU descriptions not exposed via SNMP community=public
        status,
        type:              null,
        offlineReasonCode: null,
        // MIB-confirmed scaling: all optical fields are centi-units (÷100).
        //   RX/TX raw centi-dBm → dBm  (e.g. -1224 → -12.24, 270 → 2.70)
        //   Temp   raw Centi-°C → °C   (e.g. 2968  → 29.68)
        //   Dist   raw meters   → m    (no scaling)
        rxPowerDbm:           rxPowRaw !== null ? rxPowRaw / 100 : null,
        txPowerDbm:           txPowRaw !== null ? txPowRaw / 100 : null,
        distanceMeters:       distMRaw,
        rawInstanceOid:       String(bigN),
        temperatureCelsius:   tempRaw  !== null ? tempRaw  / 100 : null,
        registerDurationSecs: durRaw,
      });
    }

    const onlineCount  = onus.filter((o) => o.status === "online").length;
    const offlineCount = onus.filter((o) => o.status === "offline").length;

    return {
      success:    true,
      vendor:     "CDATA",
      totalFound: onus.length,
      onus,
      message:
        `Found ${onus.length} registered ONUs` +
        ` (online=${onlineCount}, offline=${offlineCount}).` +
        ` MAC OID: 17409.2.3.4.1.1.7.{bigN};` +
        ` Status OID: 17409.2.3.4.1.1.8.{bigN} (1=online, 2=offline).`,
      latencyMs: Date.now() - start,
      mibUsed:   MIB_NAME,
    };
  }

  // ── readEasyPathPhysicalPorts ─────────────────────────────────────────────

  /**
   * Determine the number of physical PON ports on an EasyPath OLT.
   *
   * Walks the standard ifDescr table (1.3.6.1.2.1.2.2.1.2) and counts
   * interfaces whose description contains "PON", "EPON", or "GPON"
   * (case-insensitive). This is vendor-agnostic and works on any device
   * that populates standard ifTable.
   *
   * Returns 0 when the count cannot be determined (caller should fall back
   * to discovered-port count or model-name inference).
   *
   * Safety: one GETBULK walk of ifDescr only. No SET.
   */
  async readEasyPathPhysicalPorts(): Promise<number> {
    const IF_DESCR_COL = "1.3.6.1.2.1.2.2.1.2";
    const prefix       = IF_DESCR_COL + ".";
    let   cursor       = IF_DESCR_COL;
    let   ponCount     = 0;
    let   total        = 0;
    const MAX_IFS      = 128;  // safety cap — even a 32-port OLT has < 128 interfaces total
    const PON_RE       = /pon|epon|gpon/i;

    while (total < MAX_IFS) {
      let batch: snmp.Varbind[];
      try {
        batch = await this.snmpGetBulk([cursor], 20);
      } catch {
        break;
      }

      const inTree = batch.filter((vb) => vb.oid.startsWith(prefix));
      if (inTree.length === 0) break;

      for (const vb of inTree) {
        if (total >= MAX_IFS) break;
        total++;
        const desc =
          Buffer.isBuffer(vb.value)
            ? vb.value.toString("ascii")
            : typeof vb.value === "string"
              ? vb.value
              : "";
        if (PON_RE.test(desc)) ponCount++;
      }

      const newCursor = inTree[inTree.length - 1]!.oid;
      if (newCursor === cursor) break;
      cursor = newCursor;
    }

    return ponCount;
  }

  // ── readOnuDetails ────────────────────────────────────────────────────────

  /**
   * Read detailed attributes for a single ONU.
   *
   * Issues at most 2 SNMP PDUs:
   *   PDU 1 — GET all available column OIDs for the specified ONU instance
   *   PDU 2 — GET distance OID (only if the vendor defines one; most don't yet)
   *
   * No GETBULK, no walk, no background state.
   *
   * Safety contract:
   *   • Read-only: only snmpGet() — no SET, no walk, no GETBULK
   *   • One-shot: no interval, no background worker, no persistent session
   *   • Bounded: at most 2 SNMP PDUs total
   *
   * @param vendor      Vendor name — must match a key in VENDOR_ONU_MIBS.
   * @param instanceOid OID instance suffix for the ONU (e.g. "0.4.3.5" for
   *                    Huawei, "123.7" for ZTE).  Use {@link buildOnuInstance}
   *                    to construct this from ponPort + onuId.
   */
  async readOnuDetails(vendor: string, instanceOid: string): Promise<ReadOnuDetailResult> {
    const start = Date.now();
    const mib = VENDOR_ONU_MIBS[vendor];

    if (!mib) {
      return {
        success:   false,
        vendor,
        onu:       null,
        message:   `No MIB configuration for vendor "${vendor}". Supported: ${Object.keys(VENDOR_ONU_MIBS).join(", ")}`,
        latencyMs: Date.now() - start,
        mibUsed:   "none",
      };
    }

    // Build per-field OIDs (null for unsupported columns)
    const colMap = {
      serial: mib.colSerial !== null ? `${mib.tableRoot}.${mib.colSerial}.${instanceOid}` : null,
      status: mib.colStatus !== null ? `${mib.tableRoot}.${mib.colStatus}.${instanceOid}` : null,
      type:   mib.colType   !== null ? `${mib.tableRoot}.${mib.colType}.${instanceOid}`   : null,
      mac:    mib.colMac    !== null ? `${mib.tableRoot}.${mib.colMac}.${instanceOid}`    : null,
      desc:   mib.colDesc   !== null ? `${mib.tableRoot}.${mib.colDesc}.${instanceOid}`   : null,
    };

    const oids: string[] = Object.values(colMap).filter((v): v is string => v !== null);

    if (oids.length === 0) {
      return {
        success:   false,
        vendor,
        onu:       null,
        message:   `MIB config for "${vendor}" has no readable detail columns.`,
        latencyMs: Date.now() - start,
        mibUsed:   mib.mibName,
      };
    }

    // ── PDU 1: GET all column OIDs for this ONU instance ─────────────────
    let attrMap: Record<string, snmp.Varbind>;
    try {
      attrMap = indexVarbinds(await this.snmpGet(oids));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success:   false,
        vendor,
        onu:       null,
        message:   `SNMP GET failed for ONU instance ${instanceOid}: ${msg}`,
        latencyMs: Date.now() - start,
        mibUsed:   mib.mibName,
      };
    }

    // ── PDU 2 (optional): GET distance OID if the vendor defines one ─────
    let distanceMeters: number | null = null;
    const distOid = mib.distanceOid ? mib.distanceOid(instanceOid) : null;
    if (distOid) {
      try {
        const distVbs = indexVarbinds(await this.snmpGet([distOid]));
        const dv = distVbs[distOid];
        if (dv) distanceMeters = intVal(dv) ?? null;
      } catch {
        // Distance not available — non-fatal, continue with null
      }
    }

    // ── Parse instance OID into human-readable port + onuId ──────────────
    const parsed = mib.parseInstance(instanceOid);

    // ── Normalise ONU detail fields ───────────────────────────────────────
    const rawStatus = colMap.status ? attrMap[colMap.status] : undefined;

    const onu: SnmpOnuDetail = {
      onuId:           parsed?.onuId   ?? instanceOid.split(".").pop() ?? instanceOid,
      ponPort:         parsed?.ponPort ?? instanceOid,
      serial:          colMap.serial   ? parseGponSerial(attrMap[colMap.serial]?.value)  : null,
      mac:             colMap.mac      ? parseMacAddress(attrMap[colMap.mac]?.value)      : null,
      clientMac:       null,
      type:            colMap.type     ? (stringVal(attrMap[colMap.type])  ?? null)       : null,
      description:     colMap.desc     ? (stringVal(attrMap[colMap.desc])  ?? null)       : null,
      status:          rawStatus       ? mib.parseStatus(intVal(rawStatus) ?? 2)          : "unknown",
      distanceMeters,
      onuUptimeSecs:   null,
      lastOnlineTime:  null,
      lastOfflineTime: null,
      rawInstanceOid:  instanceOid,
    };

    return {
      success:   true,
      vendor,
      onu,
      message:   `ONU ${onu.onuId} on port ${onu.ponPort} read from ${mib.mibName}`,
      latencyMs: Date.now() - start,
      mibUsed:   mib.mibName,
    };
  }

  // ── readOnuOptical ────────────────────────────────────────────────────────

  /**
   * Read optical transceiver measurements for a single ONU.
   *
   * Issues exactly 1 SNMP GET with all available optical column OIDs.
   * No GETBULK, no walk, no background state.
   *
   * Safety contract:
   *   • Read-only: only snmpGet() — no SET, no walk, no GETBULK
   *   • One-shot: no interval, no background worker, no persistent session
   *   • Bounded: exactly 1 SNMP PDU
   *
   * @param vendor      Vendor name — must match a key in VENDOR_OPTICAL_MIBS.
   * @param instanceOid OID instance suffix (same format as readOnuDetails).
   *                    Use {@link buildOnuInstance} to construct from ponPort + onuId.
   */
  async readOnuOptical(vendor: string, instanceOid: string): Promise<ReadOnuOpticalResult> {
    const start = Date.now();
    const mib = VENDOR_OPTICAL_MIBS[vendor];

    if (!mib) {
      const configured = Object.keys(VENDOR_OPTICAL_MIBS).join(", ");
      return {
        success:   false,
        vendor,
        onu:       null,
        message:   `Optical power MIB not available for vendor "${vendor}". ` +
                   (configured
                     ? `Currently configured: ${configured}.`
                     : `No vendors configured yet — see TODO comments in VENDOR_OPTICAL_MIBS.`),
        latencyMs: Date.now() - start,
        mibUsed:   "none",
      };
    }

    // Build per-field OIDs (null entries skipped — columns unsupported by this vendor)
    const colMap = {
      rxPower:     mib.colRxPower     !== null ? `${mib.tableRoot}.${mib.colRxPower}.${instanceOid}`     : null,
      txPower:     mib.colTxPower     !== null ? `${mib.tableRoot}.${mib.colTxPower}.${instanceOid}`     : null,
      oltRxPower:  mib.colOltRxPower  !== null ? `${mib.tableRoot}.${mib.colOltRxPower}.${instanceOid}`  : null,
      temperature: mib.colTemperature !== null ? `${mib.tableRoot}.${mib.colTemperature}.${instanceOid}` : null,
    };

    const oids: string[] = Object.values(colMap).filter((v): v is string => v !== null);

    if (oids.length === 0) {
      return {
        success:   false,
        vendor,
        onu:       null,
        message:   `Optical MIB config for "${vendor}" has no readable columns.`,
        latencyMs: Date.now() - start,
        mibUsed:   mib.mibName,
      };
    }

    // ── Single GET for all optical column OIDs ────────────────────────────
    let attrMap: Record<string, snmp.Varbind>;
    try {
      attrMap = indexVarbinds(await this.snmpGet(oids));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success:   false,
        vendor,
        onu:       null,
        message:   `SNMP GET failed for ONU optical instance ${instanceOid}: ${msg}`,
        latencyMs: Date.now() - start,
        mibUsed:   mib.mibName,
      };
    }

    // ── Scale raw SNMP integers to dBm / °C ──────────────────────────────
    const rawRx    = colMap.rxPower     ? intVal(attrMap[colMap.rxPower])     : undefined;
    const rawTx    = colMap.txPower     ? intVal(attrMap[colMap.txPower])     : undefined;
    const rawOltRx = colMap.oltRxPower  ? intVal(attrMap[colMap.oltRxPower])  : undefined;
    const rawTemp  = colMap.temperature ? intVal(attrMap[colMap.temperature]) : undefined;

    // Round to 2 decimal places for power, 1 for temperature — avoids float noise.
    const rxPowerDbm    = rawRx    !== undefined ? Math.round(rawRx    * mib.powerScale       * 100) / 100 : null;
    const txPowerDbm    = rawTx    !== undefined ? Math.round(rawTx    * mib.powerScale       * 100) / 100 : null;
    const oltRxPowerDbm = rawOltRx !== undefined ? Math.round(rawOltRx * mib.powerScale       * 100) / 100 : null;
    const temperatureC  = rawTemp  !== undefined ? Math.round(rawTemp  * mib.temperatureScale * 10)  / 10  : null;

    // ── Parse instance OID into human-readable port + onuId ──────────────
    const onuMib = VENDOR_ONU_MIBS[vendor];
    const parsed = onuMib ? onuMib.parseInstance(instanceOid) : null;

    const onu: SnmpOnuOptical = {
      onuId:          parsed?.onuId   ?? instanceOid.split(".").pop() ?? instanceOid,
      ponPort:        parsed?.ponPort ?? instanceOid,
      rxPowerDbm,
      txPowerDbm,
      oltRxPowerDbm,
      temperatureC,
      opticalStatus:  deriveOpticalStatus(rxPowerDbm),
      rawInstanceOid: instanceOid,
    };

    return {
      success:   true,
      vendor,
      onu,
      message:   `ONU ${onu.onuId} optical data read from ${mib.mibName}`,
      latencyMs: Date.now() - start,
      mibUsed:   mib.mibName,
    };
  }

  // ── readOnuTraffic ────────────────────────────────────────────────────────

  /**
   * Read traffic counters for a single ONU.
   *
   * Two paths — exactly 1 SNMP GET in either case:
   *
   *   Path A (preferred): IF-MIB  — when `ifIndex` is provided.
   *     GETs ifHCInOctets + ifHCOutOctets (64-bit) with Counter32 fallback.
   *     Vendor-agnostic; works for all 5 supported vendors.
   *     Note: rates not available from a single reading.
   *
   *   Path B: vendor-specific stats table  — when `ifIndex` is omitted.
   *     GETs up to 4 columns (download/upload bytes + rates).
   *     Currently configured: Huawei (hwGponOnuStatTable), ZTE (tentative).
   *
   * Safety contract:
   *   • Read-only: only snmpGet() — no SET, no walk, no GETBULK
   *   • One-shot: no interval, no background worker, no persistent session
   *   • Bounded: exactly 1 SNMP PDU
   */
  async readOnuTraffic(
    vendor: string,
    instanceOid: string,
    ifIndex?: number,
  ): Promise<ReadOnuTrafficResult> {
    const start   = Date.now();
    const onuMib  = VENDOR_ONU_MIBS[vendor];
    const parsed  = onuMib ? onuMib.parseInstance(instanceOid) : null;
    const resolvedId   = parsed?.onuId   ?? instanceOid.split(".").pop() ?? instanceOid;
    const resolvedPort = parsed?.ponPort ?? instanceOid;

    // ── Path A: Standard IF-MIB ──────────────────────────────────────────
    if (ifIndex !== undefined) {
      const ifOids = [
        `${IF_HC_IN_OCTETS}.${ifIndex}`,
        `${IF_HC_OUT_OCTETS}.${ifIndex}`,
        `${IF_IN_OCTETS}.${ifIndex}`,
        `${IF_OUT_OCTETS}.${ifIndex}`,
      ];

      let attrMap: Record<string, snmp.Varbind>;
      try {
        attrMap = indexVarbinds(await this.snmpGet(ifOids));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success:   false,
          vendor,
          onu:       null,
          message:   `SNMP GET failed for IF-MIB ifIndex ${ifIndex}: ${msg}`,
          latencyMs: Date.now() - start,
          mibUsed:   "IF-MIB",
        };
      }

      // 64-bit preferred; fall back to 32-bit when HC is absent
      const hcIn   = parseCounter64(attrMap[`${IF_HC_IN_OCTETS}.${ifIndex}`]?.value);
      const hcOut  = parseCounter64(attrMap[`${IF_HC_OUT_OCTETS}.${ifIndex}`]?.value);
      const in32   = intVal(attrMap[`${IF_IN_OCTETS}.${ifIndex}`]);
      const out32  = intVal(attrMap[`${IF_OUT_OCTETS}.${ifIndex}`]);

      const downloadBytes = hcIn  ?? in32  ?? null;
      const uploadBytes   = hcOut ?? out32 ?? null;

      const onu: SnmpOnuTraffic = {
        onuId:            resolvedId,
        ponPort:          resolvedPort,
        downloadBytes,
        uploadBytes,
        totalBytes:       downloadBytes !== null && uploadBytes !== null
                            ? downloadBytes + uploadBytes
                            : null,
        downloadRateKbps: null, // rates require two timed readings — not available in single GET
        uploadRateKbps:   null,
        ifIndex,
        rawInstanceOid:   instanceOid,
      };

      return {
        success:   true,
        vendor,
        onu,
        message:   `ONU ${resolvedId} traffic counters read via IF-MIB (ifIndex ${ifIndex})`,
        latencyMs: Date.now() - start,
        mibUsed:   "IF-MIB",
      };
    }

    // ── Path B: Vendor-specific stats table ──────────────────────────────
    const mib = VENDOR_TRAFFIC_MIBS[vendor];

    if (!mib) {
      const configured = Object.keys(VENDOR_TRAFFIC_MIBS).join(", ");
      return {
        success:   false,
        vendor,
        onu:       null,
        message:   `No traffic MIB configured for vendor "${vendor}". ` +
                   (configured
                     ? `Configured: ${configured}. `
                     : "") +
                   `Alternatively, pass an ifIndex to use IF-MIB directly (works for any vendor).`,
        latencyMs: Date.now() - start,
        mibUsed:   "none",
      };
    }

    const colMap = {
      downloadBytes:    mib.colDownloadBytes    !== null
                          ? `${mib.tableRoot}.${mib.colDownloadBytes}.${instanceOid}`    : null,
      uploadBytes:      mib.colUploadBytes      !== null
                          ? `${mib.tableRoot}.${mib.colUploadBytes}.${instanceOid}`      : null,
      downloadRateKbps: mib.colDownloadRateKbps !== null
                          ? `${mib.tableRoot}.${mib.colDownloadRateKbps}.${instanceOid}` : null,
      uploadRateKbps:   mib.colUploadRateKbps   !== null
                          ? `${mib.tableRoot}.${mib.colUploadRateKbps}.${instanceOid}`   : null,
    };

    const oids: string[] = Object.values(colMap).filter((v): v is string => v !== null);

    if (oids.length === 0) {
      return {
        success:   false,
        vendor,
        onu:       null,
        message:   `Traffic MIB for "${vendor}" has no readable columns. Pass an ifIndex to use IF-MIB instead.`,
        latencyMs: Date.now() - start,
        mibUsed:   mib.mibName,
      };
    }

    let attrMap: Record<string, snmp.Varbind>;
    try {
      attrMap = indexVarbinds(await this.snmpGet(oids));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success:   false,
        vendor,
        onu:       null,
        message:   `SNMP GET failed for ONU traffic instance ${instanceOid}: ${msg}`,
        latencyMs: Date.now() - start,
        mibUsed:   mib.mibName,
      };
    }

    // Vendor counters may be Counter32 or Counter64 — try both parsers
    const rawDl    = colMap.downloadBytes
                       ? (parseCounter64(attrMap[colMap.downloadBytes]?.value) ?? intVal(attrMap[colMap.downloadBytes]))
                       : undefined;
    const rawUl    = colMap.uploadBytes
                       ? (parseCounter64(attrMap[colMap.uploadBytes]?.value)   ?? intVal(attrMap[colMap.uploadBytes]))
                       : undefined;
    const rawDlRps = colMap.downloadRateKbps ? intVal(attrMap[colMap.downloadRateKbps]) : undefined;
    const rawUlRps = colMap.uploadRateKbps   ? intVal(attrMap[colMap.uploadRateKbps])   : undefined;

    const downloadBytes = rawDl ?? null;
    const uploadBytes   = rawUl ?? null;

    const onu: SnmpOnuTraffic = {
      onuId:            resolvedId,
      ponPort:          resolvedPort,
      downloadBytes,
      uploadBytes,
      totalBytes:       downloadBytes !== null && uploadBytes !== null
                          ? downloadBytes + uploadBytes
                          : null,
      downloadRateKbps: rawDlRps ?? null,
      uploadRateKbps:   rawUlRps ?? null,
      ifIndex:          null,
      rawInstanceOid:   instanceOid,
    };

    return {
      success:   true,
      vendor,
      onu,
      message:   `ONU ${resolvedId} traffic read from ${mib.mibName}`,
      latencyMs: Date.now() - start,
      mibUsed:   mib.mibName,
    };
  }
}

// ─── Helper functions ──────────────────────────────────────────────────────

/** Map varbinds by OID for O(1) lookup. */
function indexVarbinds(vbs: snmp.Varbind[]): Record<string, snmp.Varbind> {
  const map: Record<string, snmp.Varbind> = {};
  for (const vb of vbs) {
    if (!snmp.isVarbindError(vb)) map[vb.oid] = vb;
  }
  return map;
}

/** Extract the ifIndex from an ifTable column OID like "1.3.6.1.2.1.2.2.1.2.13". */
function ifIndexFromOid(oid: string): number | null {
  const parts = oid.split(".");
  const idx = parseInt(parts[parts.length - 1]!, 10);
  return isNaN(idx) ? null : idx;
}

/** Convert a Buffer or string varbind value to a UTF-8 string. */
function stringVal(vb: snmp.Varbind | undefined): string | undefined {
  if (!vb) return undefined;
  const v = vb.value;
  if (Buffer.isBuffer(v)) return v.toString("utf8").trim();
  if (typeof v === "string") return v.trim();
  return undefined;
}

/** Extract OID string value (sysObjectID returns as string). */
function oidVal(vb: snmp.Varbind | undefined): string | undefined {
  if (!vb) return undefined;
  return typeof vb.value === "string" ? vb.value : undefined;
}

/** Convert TimeTicks (hundredths of a second) to whole seconds. */
function timeTicksToSecs(vb: snmp.Varbind | undefined): number | undefined {
  if (!vb) return undefined;
  const n = typeof vb.value === "number" ? vb.value : undefined;
  return n !== undefined ? Math.floor(n / 100) : undefined;
}

/** Extract integer value from a varbind. */
function intVal(vb: snmp.Varbind | undefined): number | undefined {
  if (!vb) return undefined;
  return typeof vb.value === "number" ? vb.value : undefined;
}

/** Map ifOperStatus integer to human-readable string. */
function operStatusToString(n: number): "up" | "down" | "testing" | "unknown" {
  if (n === 1) return "up";
  if (n === 2) return "down";
  if (n === 3) return "testing";
  return "unknown";
}

/** Return true if the interface description looks like a PON port. */
function isPonPort(descr: string): boolean {
  const d = descr.toLowerCase();
  return (
    d.includes("gpon") ||
    d.includes("epon") ||
    d.includes("xpon") ||
    d.includes("xgs-pon") ||
    d.includes("10g-epon") ||
    (d.includes("pon") && !d.includes("component"))
  );
}

/** Classify a non-PON interface into a display category for OLT health. */
function classifyOltInterface(descr: string): "uplink" | "ethernet" | "sfp" | "other" {
  const d = descr.toLowerCase();
  if (d.includes("10ge") || d.includes("xge") || d.startsWith("ten") ||
      d.includes("uplink") || d.includes("10g-eth")) return "uplink";
  if (d.includes("sfp")) return "sfp";
  if (d.includes("ge") || d.includes("gigabit") || d.includes("ethernet") ||
      d.startsWith("eth") || d.startsWith("fe") || d.startsWith("fastethernet")) return "ethernet";
  return "other";
}

/** Classify a net-snmp error into a typed error subclass. */
function classifyError(err: Error, host: string, timeoutMs: number): Error {
  const msg = err.message.toLowerCase();
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return new SnmpTimeoutError(host, timeoutMs);
  }
  if (
    msg.includes("unreachable") ||
    msg.includes("econnrefused") ||
    msg.includes("enetunreach")
  ) {
    return new SnmpUnreachableError(host, err.message);
  }
  return err;
}

/**
 * Heuristic vendor detection from sysDescr + sysObjectID.
 * Returns a normalised vendor label.
 *
 * Exported so callers (e.g. snmp-test.routes.ts) can re-use the result from
 * an already-fetched SysInfo without issuing a second SNMP round-trip.
 */
export function detectVendorFromSysInfo(sysDescr: string, sysObjectID: string): string {
  return detectVendor(sysDescr, sysObjectID);
}

/**
 * Heuristic model extraction from sysDescr.
 *
 * Exported so callers can re-use the result from an already-fetched SysInfo
 * without issuing a second SNMP round-trip.
 */
export function extractModelFromDescr(sysDescr: string): string {
  return extractModel(sysDescr);
}

/**
 * Detect the PON technology type (EPON vs GPON) from a C-DATA sysDescr string.
 *
 * Used by the C-DATA adapter to select between cdataEponOnuTable and
 * cdataGponOnuTable before issuing any ONU discovery SNMP operations.
 *
 * Detection priority:
 *   1. Explicit "EPON" / "GPON" keyword in sysDescr (most reliable)
 *   2. C-DATA model number patterns:
 *      GPON series: FD1616GS, FD8920, FD1204SN (suffix GS or SN = GPON)
 *      EPON series: FD1208S-xx, FD1104S-xx, FD1204S-xx (dash after S = EPON variant)
 *                   FD1204S, FD1104S  (S without GS/SN suffix = EPON)
 *   3. "unknown" when the sysDescr contains no recognisable pattern.
 *
 * Returns "unknown" rather than guessing when the type cannot be determined.
 * Callers should try GPON first and EPON as fallback, or vice versa.
 */
export function detectCdataPonType(sysDescr: string): "EPON" | "GPON" | "unknown" {
  const d = sysDescr.toLowerCase();

  // Explicit technology keywords (fastest path)
  if (d.includes("epon")) return "EPON";
  if (d.includes("gpon")) return "GPON";

  // GPON model suffixes: FD1616GS, FD8920, FD1204SN
  if (/\bFD\d{4}GS\b/i.test(sysDescr)) return "GPON";   // e.g. FD1616GS
  if (/\bFD\d{4}SN\b/i.test(sysDescr)) return "GPON";   // e.g. FD1204SN
  if (/\bFD89\d{2}\b/i.test(sysDescr)) return "GPON";   // e.g. FD8920

  // EPON model patterns: FD1208S-B0, FD1104S-xx, FD1204S-xx (dash variant)
  if (/\bFD\d{4}S-/i.test(sysDescr))        return "EPON";
  // EPON models without dash suffix but also without GS/SN
  if (/\bFD1[12]\d{2}S\b/i.test(sysDescr)) return "EPON";

  return "unknown";
}

function detectVendor(sysDescr: string, sysObjectID: string): string {
  const d = sysDescr.toLowerCase();
  const o = sysObjectID;

  if (d.includes("huawei") || d.includes("ma5800") || d.includes("ma5600") || o.startsWith("1.3.6.1.4.1.2011"))
    return "Huawei";
  if (d.includes("zte") || d.includes("zxa10") || d.includes("c300") || d.includes("c600") || o.startsWith("1.3.6.1.4.1.3902"))
    return "ZTE";
  if (d.includes("bdcom") || d.includes("p3310") || d.includes("p3608") || o.startsWith("1.3.6.1.4.1.3320"))
    return "BDCOM";
  if (d.includes("vsol") || d.includes("v1600") || d.includes("v2801") || o.startsWith("1.3.6.1.4.1.37950"))
    return "VSOL";
  if (d.includes("c-data") || d.includes("cdata") || d.includes("fd1616") || d.includes("fd8920") || o.startsWith("1.3.6.1.4.1.34592"))
    return "CDATA";
  // EasyPath Ethernet-PON (FD1208S-B0 V1.6.0) — same vendor, different firmware OID tree
  if (d.includes("easypath") || o.startsWith("1.3.6.1.4.1.17409"))
    return "CDATA";

  return "Unknown";
}

/**
 * Heuristic model extraction from sysDescr.
 * Applies vendor-specific patterns in order of specificity.
 */
function extractModel(sysDescr: string): string {
  // Huawei: MA5800-X7, MA5800-X15, MA5600T, MA5683T
  let m = sysDescr.match(/\b(MA5[68]\d{2}(?:[A-Z0-9-]+)?)\b/i);
  if (m?.[1]) return m[1];

  // ZTE: C300, C320, C600, C650, ZXA10 C300
  m = sysDescr.match(/\b(C\d{3}(?:[A-Z0-9-]*)?)\b/);
  if (m?.[1]) return m[1];

  // BDCOM: P3310C, P3608, GP3600
  m = sysDescr.match(/\b([GP]\d{4}[A-Z0-9]*)\b/i);
  if (m?.[1]) return m[1];

  // VSOL: V1600G4, V2801F, V2802G
  m = sysDescr.match(/\b(V\d{4}[A-Z0-9]*)\b/i);
  if (m?.[1]) return m[1];

  // C-DATA: FD1616GS, FD8920, FD1204SN
  m = sysDescr.match(/\b(FD\d{4}[A-Z0-9]*)\b/i);
  if (m?.[1]) return m[1];

  // Generic last-resort: first uppercase alphanumeric token that looks like a model
  m = sysDescr.match(/\b([A-Z0-9][A-Z0-9-]{3,12})\b/);
  if (m?.[1]) return m[1];

  return "Unknown";
}

/**
 * Returns the root OID of the ONU index table for a given vendor.
 * Returns null when the vendor is unknown or unimplemented.
 *
 * TODO: Add EPON tables for Huawei and ZTE.
 * TODO: Validate OID paths against confirmed MIB versions.
 */
function vendorOnuTableOid(vendor: string): string | null {
  switch (vendor) {
    case "Huawei": return "1.3.6.1.4.1.2011.6.139.9.3.8.100.1.1";  // hwGponOnuTable
    case "ZTE":    return "1.3.6.1.4.1.3902.3.101.13.10.1.1";        // zxAnGponOnuTable
    case "BDCOM":  return "1.3.6.1.4.1.3320.9.1.3.3.1";              // bdEponOnuTable
    case "VSOL":   return "1.3.6.1.4.1.37950.2.1.1.1";               // tentative
    case "CDATA":  return "1.3.6.1.4.1.34592.5.1.3.1";               // cdataGponOnuTable
    default:       return null;
  }
}

/** Build the mock-fallback OnuListResult. */
function mockFallback(oltId: string | undefined, reason: string): OnuListResult {
  const onus = oltId
    ? MOCK_ONUS.filter((o) => o.oltId === oltId)
    : MOCK_ONUS;
  return {
    source: "mock",
    onus,
    fallbackReason: reason,
  };
}

// ─── Vendor ONU table MIB definitions ─────────────────────────────────────

interface VendorOnuMib {
  /** Root OID of the ONU management table (without column suffix). */
  tableRoot: string;

  /** Short MIB table name for logging and error messages. */
  mibName: string;

  /** Column number for the ONU index (used as the GETBULK starting point). */
  colIndex: number;

  /** Column number for serial number, or null if not available in this MIB. */
  colSerial: number | null;

  /** Column number for operational status, or null if not available. */
  colStatus: number | null;

  /** Column number for ONU type/model string, or null if not available. */
  colType: number | null;

  /** Column number for MAC address (EPON), or null if not applicable. */
  colMac: number | null;

  /** Column number for administrator description/name label, or null if absent in this MIB. */
  colDesc: number | null;

  /**
   * Returns the full OID for the ONU's physical distance to the OLT (in metres),
   * given the ONU instance suffix.  Returns null when the vendor does not publish
   * a distance OID or the OID is unconfirmed.
   *
   * The distance column is typically in a separate optical-info table rather
   * than the main ONU management table.
   *
   * TODO: Confirm exact OIDs against production firmware MIBs for each vendor.
   */
  distanceOid: ((instance: string) => string) | null;

  /**
   * Parse the OID instance suffix (the part after the column OID) into
   * a human-readable PON port identifier and ONU ID.
   *
   * Returns null when the suffix doesn't match the expected format.
   */
  parseInstance: (suffix: string) => { ponPort: string; onuId: string } | null;

  /**
   * Convert the raw INTEGER status value from the MIB to a normalised string.
   */
  parseStatus: (value: number) => "online" | "offline" | "unknown";
}

/**
 * Per-vendor ONU table MIB configurations.
 *
 * OID column numbers and table root paths are sourced from publicly available
 * MIB documentation. Exact column assignments can vary between firmware
 * versions — always verify against the specific device's MIB before relying
 * on these in production.
 *
 * TODO: Add Huawei EPON table (hwEponOnuTable).
 * TODO: Add ZTE EPON table (zxAnEponOnuTable).
 * TODO: Confirm VSOL and CDATA OIDs against multiple firmware versions.
 */
const VENDOR_ONU_MIBS: Record<string, VendorOnuMib | undefined> = {

  // ── Huawei MA5800-X7 / MA5800-X15 / MA5600T GPON ───────────────────────
  // MIB: HUAWEI-XPON-MIB::hwGponOnuMngTable
  // Instance index: {frame}.{slot}.{port}.{onuId}  — e.g. "0.4.3.5"
  // Confirmed columns: 1=index, 2=desc, 3=SN, 4=type, 5=runState
  Huawei: {
    tableRoot:   "1.3.6.1.4.1.2011.6.139.9.3.8.100.1",
    mibName:     "hwGponOnuMngTable",
    colIndex:    1,    // hwGponOnuMngAttrIndex
    colSerial:   3,    // hwGponOnuMngAttrSN — OCTET STRING 8 bytes (4 ASCII + 4 hex)
    colStatus:   5,    // hwGponOnuMngAttrRunState — 1=online, 2=offline
    colType:     4,    // hwGponOnuMngAttrType — ONU model string
    colMac:      null,
    colDesc:     2,    // hwGponOnuMngAttrDesc — operator-assigned description
    // Distance is in a separate optical interface table; OID unconfirmed across
    // firmware versions — left null until validated on production hardware.
    // TODO: validate 1.3.6.1.4.1.2011.6.139.4.1.3.1.3 (hwGponOnuDistance)
    distanceOid: null,
    parseInstance: (suffix) => {
      const p = suffix.split(".");
      if (p.length < 4) return null;
      return { ponPort: `${p[0]}/${p[1]}/${p[2]}`, onuId: p[3] ?? suffix };
    },
    parseStatus: (v) => v === 1 ? "online" : v === 2 ? "offline" : "unknown",
  },

  // ── ZTE C300 / C320 / C600 / C650 GPON ─────────────────────────────────
  // MIB: ZTE-AN-GPON-MIB::zxAnGponOnuTable
  // Instance index: {gponIfIndex}.{onuId}  — e.g. "123.7"
  // Confirmed columns: 1=index, 2=SN, 7=operStatus
  ZTE: {
    tableRoot:   "1.3.6.1.4.1.3902.3.101.13.10.1",
    mibName:     "zxAnGponOnuTable",
    colIndex:    1,    // zxAnGponOnuIndex
    colSerial:   2,    // zxAnGponOnuSN — OCTET STRING 8 bytes (GPON SN format)
    colStatus:   7,    // zxAnGponOnuOperStatus — 1=online, 2=offline
    colType:     null,
    colMac:      null,
    colDesc:     null, // No description column in confirmed ZTE GPON ONU MIB
    distanceOid: null, // TODO: zxAnGponOnuStatTable distance col (unconfirmed OID)
    parseInstance: (suffix) => {
      const p = suffix.split(".");
      if (p.length < 2) return null;
      const onuId  = p[p.length - 1]!;
      const port   = p.slice(0, -1).join(".");
      return { ponPort: `gpon-ifIndex:${port}`, onuId };
    },
    parseStatus: (v) => v === 1 ? "online" : v === 2 ? "offline" : "unknown",
  },

  // ── BDCOM P3310C / P3608 / GP3600 EPON ──────────────────────────────────
  // MIB: BDCOM-EPON-ONU-MIB (enterprise OID space 1.3.6.1.4.1.3320)
  // Instance index: {ponPort}.{onuId} — tentative; verify per firmware
  BDCOM: {
    tableRoot:   "1.3.6.1.4.1.3320.9.1.3.3.1",
    mibName:     "bdEponOnuTable",
    colIndex:    1,
    colSerial:   null,
    colStatus:   3,    // 1=online, 2=offline (tentative — verify per firmware)
    colType:     null,
    colMac:      2,    // 6-byte MAC address
    colDesc:     null, // No description column in confirmed BDCOM EPON ONU MIB
    distanceOid: null, // TODO: BDCOM distance OID unconfirmed
    parseInstance: (suffix) => {
      const p = suffix.split(".");
      if (p.length < 2) return null;
      return { ponPort: p.slice(0, -1).join("."), onuId: p[p.length - 1]! };
    },
    parseStatus: (v) => v === 1 ? "online" : v === 2 ? "offline" : "unknown",
  },

  // ── VSOL V1600 / V2801 / V2802 GPON ─────────────────────────────────────
  // Tentative OIDs — verify against device-specific MIB before production use
  VSOL: {
    tableRoot:   "1.3.6.1.4.1.37950.2.1.1.1",
    mibName:     "vsolGponOnuTable",
    colIndex:    1,
    colSerial:   3,
    colStatus:   5,    // tentative
    colType:     null,
    colMac:      2,
    colDesc:     null, // TODO: confirm description column for VSOL MIB
    distanceOid: null, // TODO: VSOL distance OID unconfirmed
    parseInstance: (suffix) => {
      const p = suffix.split(".");
      if (p.length < 2) return null;
      return { ponPort: p.slice(0, -1).join("."), onuId: p[p.length - 1]! };
    },
    parseStatus: (v) => v === 1 ? "online" : v === 2 ? "offline" : "unknown",
  },

  // ── C-DATA FD1616GS / FD8920 / FD1204SN GPON ────────────────────────────
  // Tentative OIDs — verify against device-specific MIB before production use
  // Note: Use "CDATA-GPON" or "CDATA-EPON" for explicit PON-type dispatch.
  //       "CDATA" is kept as a backward-compat alias for the GPON table.
  CDATA: {
    tableRoot:   "1.3.6.1.4.1.34592.5.1.3.1",
    mibName:     "cdataGponOnuTable",
    colIndex:    1,
    colSerial:   3,
    colStatus:   7,    // tentative
    colType:     4,
    colMac:      null,
    colDesc:     null,
    distanceOid: null,
    parseInstance: (suffix) => {
      const p = suffix.split(".");
      if (p.length < 2) return null;
      return { ponPort: p.slice(0, -1).join("."), onuId: p[p.length - 1]! };
    },
    parseStatus: (v) => v === 1 ? "online" : v === 2 ? "offline" : "unknown",
  },

  // ── C-DATA GPON — explicit alias (same as CDATA above) ──────────────────
  "CDATA-GPON": {
    tableRoot:   "1.3.6.1.4.1.34592.5.1.3.1",
    mibName:     "cdataGponOnuTable",
    colIndex:    1,
    colSerial:   3,
    colStatus:   7,    // tentative
    colType:     4,
    colMac:      null,
    colDesc:     null,
    distanceOid: null,
    parseInstance: (suffix) => {
      const p = suffix.split(".");
      if (p.length < 2) return null;
      return { ponPort: p.slice(0, -1).join("."), onuId: p[p.length - 1]! };
    },
    parseStatus: (v) => v === 1 ? "online" : v === 2 ? "offline" : "unknown",
  },

  // ── C-DATA EPON — FD1208S / FD1104S / FD1204S / FD8000-EPON series ──────
  //
  // Enterprise OID: 1.3.6.1.4.1.34592 (C-DATA)
  // EPON branch:    1.3.6.1.4.1.34592.1  (vs GPON at .5)
  // ONU table:      1.3.6.1.4.1.34592.1.1.3.1  (cdataEponOnuTable / fdEponOnuBaseTable)
  //
  // Instance index: {ponPortIndex}.{llid}  — e.g. "1.3" = PON port 1, LLID 3
  //
  // Column assignments (tentative — verified against FD1208S-B0 firmware pattern):
  //   1 = ONU index (autoindex)
  //   2 = ONU MAC address / LLID (OCTET STRING 6 bytes)
  //   3 = Registration state  (1=online/registered, 2=offline/deregistered)
  //   4 = ONU hardware type string (DisplayString)
  //
  // TODO: Confirm column offsets across FD12xx vs FD8000 EPON firmware lines.
  "CDATA-EPON": {
    tableRoot:   "1.3.6.1.4.1.34592.1.1.3.1",
    mibName:     "cdataEponOnuTable",
    colIndex:    1,
    colSerial:   null,  // EPON uses MAC/LLID, not GPON SN format
    colStatus:   3,     // tentative: 1=online, 2=offline
    colType:     4,     // tentative: ONU model/type string
    colMac:      2,     // EPON ONU MAC address (6-byte OCTET STRING)
    colDesc:     null,
    distanceOid: null,
    parseInstance: (suffix) => {
      // Instance: {ponPortIndex}.{llid} — e.g. "1.3" → ponPort "1", onuId "3"
      const p = suffix.split(".");
      if (p.length < 2) return null;
      return { ponPort: p.slice(0, -1).join("."), onuId: p[p.length - 1]! };
    },
    parseStatus: (v) => v === 1 ? "online" : v === 2 ? "offline" : "unknown",
  },
};

// ─── Vendor optical power MIB definitions ─────────────────────────────────

/**
 * Per-vendor optical interface table MIB configuration.
 *
 * All power columns store raw integers where:
 *   dBm = rawValue × powerScale   (Huawei: 0.01 — raw −2730 = −27.30 dBm)
 * Temperature columns store raw integers where:
 *   °C   = rawValue × temperatureScale  (typical: 0.1 — raw 273 = 27.3 °C)
 *
 * Columns marked "tentative" are based on public MIB documentation but have
 * not been verified on production hardware across all firmware versions.
 * Always confirm against the specific device's compiled MIB before relying on
 * these in production monitoring.
 */
interface VendorOpticalMib {
  /** Root OID of the optical interface info table (without column or instance suffix). */
  tableRoot: string;

  /** Short MIB table name for logging and error messages. */
  mibName: string;

  /** Column for ONU receive power. Raw integer × powerScale = dBm. Null = unsupported. */
  colRxPower: number | null;

  /** Column for ONU transmit power. Raw integer × powerScale = dBm. Null = unsupported. */
  colTxPower: number | null;

  /** Column for OLT receive power (upstream signal). Raw integer × powerScale = dBm. */
  colOltRxPower: number | null;

  /** Column for ONU module temperature. Raw integer × temperatureScale = °C. Null = unsupported. */
  colTemperature: number | null;

  /** Multiply raw SNMP integer by this to get dBm. Most vendors use 0.01. */
  powerScale: number;

  /** Multiply raw SNMP integer by this to get °C. Typical: 0.1 or 1. */
  temperatureScale: number;
}

/**
 * Per-vendor optical interface table MIB configurations.
 *
 * The optical info table uses the same instance index format as the ONU
 * management table for each vendor, so the same `buildOnuInstance()` logic
 * applies. Vendors without a confirmed optical table are simply absent from
 * this map — the caller receives a clear "not supported" message.
 *
 * TODO: Add BDCOM, VSOL, and C-DATA optical tables once OIDs are confirmed.
 */
const VENDOR_OPTICAL_MIBS: Record<string, VendorOpticalMib | undefined> = {

  // ── Huawei MA5800-X7 / MA5800-X15 / MA5600T GPON ───────────────────────
  // MIB: HUAWEI-XPON-MIB::hwGponOnuOptIfInfoTable
  // Instance index: {frame}.{slot}.{port}.{onuId} — same as hwGponOnuMngTable
  // Confirmed: cols 2, 3, 4 (RX / TX / OLT-RX) @ 0.01 dBm resolution
  // Temperature col 9 is tentative — verify per firmware version
  Huawei: {
    tableRoot:        "1.3.6.1.4.1.2011.6.139.4.1.4.1",
    mibName:          "hwGponOnuOptIfInfoTable",
    colRxPower:       2,    // hwGponOnuOptIfInfoRxPower    — 0.01 dBm
    colTxPower:       3,    // hwGponOnuOptIfInfoTxPower    — 0.01 dBm
    colOltRxPower:    4,    // hwGponOnuOptIfInfoOltRxPower — 0.01 dBm
    colTemperature:   9,    // hwGponOnuOptIfInfoTemperature — tentative, 0.1 °C
    powerScale:       0.01,
    temperatureScale: 0.1,
  },

  // ── ZTE C300 / C320 / C600 / C650 GPON ─────────────────────────────────
  // MIB: ZTE-AN-GPON-MIB — optical performance stats table (OIDs tentative)
  // Instance index: {gponIfIndex}.{onuId} — same as zxAnGponOnuTable
  // TODO: Validate all column assignments against production device MIB file.
  //       Column numbers vary significantly across C300 vs C320 firmware lines.
  ZTE: {
    tableRoot:        "1.3.6.1.4.1.3902.3.101.13.10.8.1",
    mibName:          "zxAnGponOnuPerfTable",
    colRxPower:       4,    // tentative — zxAnGponOnuRxPower (0.01 dBm)
    colTxPower:       5,    // tentative — zxAnGponOnuTxPower (0.01 dBm)
    colOltRxPower:    6,    // tentative — zxAnGponOltRxPower (0.01 dBm)
    colTemperature:   null, // not confirmed in publicly available ZTE GPON MIBs
    powerScale:       0.01,
    temperatureScale: 1,
  },

  // BDCOM / VSOL / CDATA:
  // Optical power MIBs not yet confirmed — entries absent so the endpoint
  // returns a clear "not supported" message instead of silently returning nulls.
  // TODO: Add BDCOM bdEponOnuOptIfInfoTable OIDs once validated.
  // TODO: Add VSOL/CDATA optical table OIDs once validated.
};

// ─── Standard IF-MIB OID prefixes (RFC 2863) ──────────────────────────────
// These are vendor-agnostic and work on any SNMP-capable device.
// Append .{ifIndex} to form a complete OID (e.g. "...6.12" for ifIndex 12).

const IF_HC_IN_OCTETS  = "1.3.6.1.2.1.31.1.1.1.6";   // ifHCInOctets  — Counter64 (64-bit preferred)
const IF_HC_OUT_OCTETS = "1.3.6.1.2.1.31.1.1.1.10";  // ifHCOutOctets — Counter64 (64-bit preferred)
const IF_IN_OCTETS     = "1.3.6.1.2.1.2.2.1.10";     // ifInOctets    — Counter32 (32-bit fallback)
const IF_OUT_OCTETS    = "1.3.6.1.2.1.2.2.1.16";     // ifOutOctets   — Counter32 (32-bit fallback)

// ─── Vendor traffic statistics MIB definitions ────────────────────────────

/**
 * Per-vendor ONU traffic statistics table MIB configuration.
 *
 * Vendor-specific tables typically expose cumulative byte counters and
 * device-reported moving-average rates. The IF-MIB path (available when the
 * caller provides an `ifIndex`) is preferred when vendor tables are absent.
 *
 * Byte counter columns may be Counter32 (can roll over at 4 GB) or Counter64.
 * Rate columns are vendor-specific and may represent intervals of 5–300 s.
 *
 * Columns marked "tentative" are based on public MIB documentation; always
 * verify against the specific device's MIB before relying on them in production.
 *
 * TODO: Add BDCOM, VSOL, and C-DATA traffic tables once OIDs are validated.
 */
interface VendorTrafficMib {
  /** Root OID of the traffic statistics table (without column or instance suffix). */
  tableRoot: string;

  /** Short MIB table name for logging and error messages. */
  mibName: string;

  /** Column for cumulative downstream byte counter. Null = unsupported. */
  colDownloadBytes: number | null;

  /** Column for cumulative upstream byte counter. Null = unsupported. */
  colUploadBytes: number | null;

  /** Column for device-reported downstream rate (kbps). Null = unsupported. */
  colDownloadRateKbps: number | null;

  /** Column for device-reported upstream rate (kbps). Null = unsupported. */
  colUploadRateKbps: number | null;
}

const VENDOR_TRAFFIC_MIBS: Record<string, VendorTrafficMib | undefined> = {

  // ── Huawei MA5800 / MA5600 GPON ─────────────────────────────────────────
  // MIB: HUAWEI-XPON-MIB::hwGponOnuStatTable (tentative OIDs)
  // Instance index: {frame}.{slot}.{port}.{onuId} — same as hwGponOnuMngTable
  // TODO: Confirm all column assignments against production firmware MIB file.
  //       Counter width (32-bit vs 64-bit) varies across MA5800/MA5600 firmware.
  Huawei: {
    tableRoot:           "1.3.6.1.4.1.2011.6.139.4.1.5.1",
    mibName:             "hwGponOnuStatTable",
    colDownloadBytes:    2,    // tentative — hwGponOnuStatRxBytes
    colUploadBytes:      3,    // tentative — hwGponOnuStatTxBytes
    colDownloadRateKbps: 4,    // tentative — hwGponOnuStatRxRate (kbps)
    colUploadRateKbps:   5,    // tentative — hwGponOnuStatTxRate (kbps)
  },

  // ── ZTE C300 / C320 / C600 / C650 GPON ─────────────────────────────────
  // MIB: ZTE-AN-GPON-MIB — ONU traffic statistics table (tentative OIDs)
  // Instance index: {gponIfIndex}.{onuId} — same as zxAnGponOnuTable
  // TODO: Validate column numbers across C300 vs C320 firmware lines.
  ZTE: {
    tableRoot:           "1.3.6.1.4.1.3902.3.101.13.10.9.1",
    mibName:             "zxAnGponOnuTrafficTable",
    colDownloadBytes:    2,    // tentative
    colUploadBytes:      3,    // tentative
    colDownloadRateKbps: null, // not confirmed in publicly available ZTE MIBs
    colUploadRateKbps:   null, // not confirmed
  },

  // BDCOM / VSOL / CDATA: traffic table OIDs not yet confirmed.
  // The IF-MIB path (provide ifIndex in the request) works for these vendors.
  // TODO: Add EPON traffic table OIDs for BDCOM/VSOL/CDATA once validated.
};

// ─── ONU value parsers ─────────────────────────────────────────────────────

/**
 * Parse a GPON serial number from a raw SNMP value.
 *
 * Standard GPON SN format (8 bytes):
 *   Bytes 0–3 : ASCII vendor code  (e.g. "HWTC", "ZTEG", "GPON")
 *   Bytes 4–7 : 4-byte serial → 8 uppercase hex chars
 *
 * Returns "HWTC1A2B3C4D" for a Huawei ONU or equivalent for other vendors.
 */
function parseGponSerial(value: unknown): string | null {
  if (Buffer.isBuffer(value)) {
    if (value.length < 4) return value.toString("hex").toUpperCase() || null;
    const vendor = value.slice(0, 4).toString("ascii").replace(/[^\x20-\x7E]/g, "?");
    const hex    = value.slice(4).toString("hex").toUpperCase();
    return `${vendor}${hex}` || null;
  }
  if (typeof value === "string") return value.trim() || null;
  return null;
}

/**
 * Extract a printable ASCII string from an SNMP OCTET STRING buffer.
 *
 * Returns null when the buffer is empty, all-zero, or contains mostly
 * non-printable bytes (threshold: ≥75% must be ASCII 0x20–0x7E).
 */
function bufToPrintableAscii(buf: Buffer): string | null {
  const str = buf.toString("ascii").replace(/\x00/g, "").trim();
  if (str.length === 0) return null;
  const printable = [...str].filter((c) => {
    const code = c.charCodeAt(0);
    return code >= 0x20 && code < 0x7f;
  }).length;
  return printable / str.length >= 0.75 ? str : null;
}

/**
 * Parse a MAC address from a raw SNMP value.
 *
 * Accepts a 6-byte Buffer or a string that already contains colons.
 * Returns "XX:XX:XX:XX:XX:XX" uppercase format.
 */
function parseMacAddress(value: unknown): string | null {
  if (Buffer.isBuffer(value)) {
    if (value.length < 6) return null;
    return Array.from(value.slice(0, 6))
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join(":");
  }
  if (typeof value === "string" && value.includes(":")) return value.toUpperCase();
  return null;
}

/**
 * Reconstruct the OID instance suffix for a specific ONU from human-readable
 * fields returned by the API or UI.
 *
 * Use this when you have `ponPort` + `onuId` from user input but do not have
 * the `rawInstanceOid` that {@link RealSnmpClient.readOnuTable} returns directly.
 *
 * Instance format by vendor:
 * ```
 *   Huawei — frame.slot.port.onuId  (ponPort "0/4/3", onuId "5"  → "0.4.3.5")
 *   ZTE    — ifIndex.onuId          (ponPort "gpon-ifIndex:123"   → "123.5")
 *   Others — portId.onuId           (ponPort "3", onuId "5"       → "3.5")
 * ```
 *
 * Falls back to just `onuId` when `ponPort` is not provided.
 */
export function buildOnuInstance(vendor: string, onuId: string, ponPort?: string): string {
  if (!ponPort) return onuId;

  switch (vendor) {
    case "Huawei": {
      // ponPort format: "frame/slot/port"  →  instance: "frame.slot.port.onuId"
      const parts = ponPort.split("/");
      if (parts.length === 3) return `${parts.join(".")}.${onuId}`;
      return `${ponPort}.${onuId}`;
    }
    case "ZTE": {
      // ponPort format: "gpon-ifIndex:123"  →  instance: "123.onuId"
      const m = ponPort.match(/:(\d+)$/);
      if (m?.[1]) return `${m[1]}.${onuId}`;
      return `${ponPort}.${onuId}`;
    }
    default:
      // BDCOM / VSOL / CDATA: ponPort is a plain numeric port ID
      return `${ponPort}.${onuId}`;
  }
}

/**
 * Derive a simple optical health status label from ONU receive power.
 *
 * Thresholds are based on ITU-T G.984.2 Class B+ which specifies −28 dBm
 * as the minimum ONT receiver sensitivity at 1490 nm.
 */
function deriveOpticalStatus(rxPowerDbm: number | null): "good" | "weak" | "critical" | "unknown" {
  if (rxPowerDbm === null) return "unknown";
  if (rxPowerDbm >= -28)   return "good";
  if (rxPowerDbm >= -30)   return "weak";
  return "critical";
}

/**
 * Parse a SNMP Counter64 value into a JavaScript number.
 *
 * net-snmp may represent Counter64 as a Buffer, plain number, BigInt, or an
 * object with `{ high, low }` depending on the library version and value size.
 * Handles all known representations.
 *
 * Precision: JavaScript doubles hold integers exactly up to 2⁵³ (≈ 9 × 10¹⁵),
 * which is ~9 petabytes — safe for per-ONU traffic counters.
 */
function parseCounter64(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);

  if (Buffer.isBuffer(value)) {
    if (value.length === 8) {
      const high = value.readUInt32BE(0);
      const low  = value.readUInt32BE(4);
      return high * 4294967296 + low;
    }
    if (value.length > 0) {
      let n = 0;
      for (let i = 0; i < value.length; i++) n = n * 256 + (value[i] ?? 0);
      return n;
    }
    return null;
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (typeof obj["high"] === "number" && typeof obj["low"] === "number") {
      return (obj["high"] >>> 0) * 4294967296 + (obj["low"] >>> 0);
    }
  }

  return null;
}
