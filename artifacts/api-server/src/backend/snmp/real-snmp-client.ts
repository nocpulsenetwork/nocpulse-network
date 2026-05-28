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

  /** Operational status from the ONU management table. */
  status: "online" | "offline" | "unknown";

  /** ONU hardware model/type string (e.g. "HG8310M"), or null. */
  type: string | null;

  /** Raw OID instance suffix — useful for debugging MIB mapping. */
  rawInstanceOid: string;
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
        maxRepetitions,
        (error: Error | null, varbinds: snmp.Varbind[]) => {
          session.close();
          if (error) {
            reject(classifyError(error, this.host, this.timeoutMs));
            return;
          }
          resolve(varbinds);
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
  // Confirmed columns: 1=index, 3=SN, 4=type, 5=runState
  Huawei: {
    tableRoot: "1.3.6.1.4.1.2011.6.139.9.3.8.100.1",
    mibName:   "hwGponOnuMngTable",
    colIndex:  1,   // hwGponOnuMngAttrIndex
    colSerial: 3,   // hwGponOnuMngAttrSN — OCTET STRING 8 bytes (4 ASCII + 4 hex)
    colStatus: 5,   // hwGponOnuMngAttrRunState — 1=online, 2=offline
    colType:   4,   // hwGponOnuMngAttrType — ONU model string
    colMac:    null,
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
    tableRoot: "1.3.6.1.4.1.3902.3.101.13.10.1",
    mibName:   "zxAnGponOnuTable",
    colIndex:  1,   // zxAnGponOnuIndex
    colSerial: 2,   // zxAnGponOnuSN — OCTET STRING 8 bytes (GPON SN format)
    colStatus: 7,   // zxAnGponOnuOperStatus — 1=online, 2=offline
    colType:   null,
    colMac:    null,
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
    tableRoot: "1.3.6.1.4.1.3320.9.1.3.3.1",
    mibName:   "bdEponOnuTable",
    colIndex:  1,
    colSerial: null,
    colStatus: 3,   // 1=online, 2=offline (tentative — verify per firmware)
    colType:   null,
    colMac:    2,   // 6-byte MAC address
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
    tableRoot: "1.3.6.1.4.1.37950.2.1.1.1",
    mibName:   "vsolGponOnuTable",
    colIndex:  1,
    colSerial: 3,
    colStatus: 5,   // tentative
    colType:   null,
    colMac:    2,
    parseInstance: (suffix) => {
      const p = suffix.split(".");
      if (p.length < 2) return null;
      return { ponPort: p.slice(0, -1).join("."), onuId: p[p.length - 1]! };
    },
    parseStatus: (v) => v === 1 ? "online" : v === 2 ? "offline" : "unknown",
  },

  // ── C-DATA FD1616GS / FD8920 / FD1204SN GPON ────────────────────────────
  // Tentative OIDs — verify against device-specific MIB before production use
  CDATA: {
    tableRoot: "1.3.6.1.4.1.34592.5.1.3.1",
    mibName:   "cdataGponOnuTable",
    colIndex:  1,
    colSerial: 3,
    colStatus: 7,   // tentative
    colType:   4,
    colMac:    null,
    parseInstance: (suffix) => {
      const p = suffix.split(".");
      if (p.length < 2) return null;
      return { ponPort: p.slice(0, -1).join("."), onuId: p[p.length - 1]! };
    },
    parseStatus: (v) => v === 1 ? "online" : v === 2 ? "offline" : "unknown",
  },
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
