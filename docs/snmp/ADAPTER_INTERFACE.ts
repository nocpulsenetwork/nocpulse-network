/**
 * NOCpulse — SNMP Adapter Interface (Planning Document)
 *
 * PLANNING ONLY — not compiled, not imported by the running app.
 *
 * Every vendor adapter must implement `ISnmpAdapter`. The poller resolves the
 * correct adapter at runtime via `VendorAdapterRegistry.resolve(brand)` and
 * falls back to `GenericAdapter` when no specific adapter is registered.
 *
 * Safety contract:
 *   - Adapters may ONLY call snmpSession.get(), getNext(), getSubtree(), walk()
 *   - snmpSession.set() must NEVER be called
 *   - Adapters must never issue writes, reboots, or config changes
 */

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

/** Raw OID value returned by the SNMP library before parsing */
export interface RawOidValue {
  oid: string;
  type: number; // net-snmp ObjectType enum
  value: unknown;
}

/** Parsed OLT-level snapshot — maps to OltDevice in the frontend */
export interface OltSnapshot {
  id: string;
  name: string;
  ip: string;
  sysDescr: string;           // sysDescr.0
  sysUpTimeSecs: number;      // sysUpTime.0 / 100 (centiseconds → seconds)
  cpu: number;                // 0–100 %
  memory: number;             // 0–100 %
  temperatureCelsius: number;
  uplinkStatus: "Active" | "Standby" | "Down";
  uplinkPort: string;
  ponPortCount: number;
  activeOnus: number;
  status: "Online" | "Offline" | "Degraded";
  polledAt: string;           // ISO 8601
}

/** Parsed per-ONU snapshot — maps to OnuDevice in the frontend */
export interface OnuSnapshot {
  index: number;              // vendor ONU table row index
  onuNo: string;              // human-readable slot/pon/onu e.g. "1/1/3"
  ponPort: string;            // e.g. "PON-1"
  macAddress: string;
  status: "Online" | "Offline" | "Degraded";
  rxPowerDbm: number | null;  // RX optical power, null if unavailable
  txPowerDbm: number | null;  // TX optical power, null if unavailable
  distance: string;           // e.g. "1.24 km"
  adminState: "enabled" | "disabled";
  description: string;
  polledAt: string;
}

/** Parsed alarm entry from the active alarm table */
export interface SnmpAlarm {
  index: number;
  severity: "Critical" | "Major" | "Minor" | "Info";
  description: string;
  raisedAt: string;           // ISO 8601
}

// ---------------------------------------------------------------------------
// SNMP session abstraction (wraps net-snmp or equivalent)
// ---------------------------------------------------------------------------

/** Minimal read-only session API that adapters may call */
export interface ISnmpSession {
  /** SNMPv2c GET for a list of OIDs */
  get(oids: string[]): Promise<RawOidValue[]>;

  /** SNMPv2c GETNEXT */
  getNext(oids: string[]): Promise<RawOidValue[]>;

  /** Walk a subtree (GETBULK / successive GETNEXTs) */
  walk(rootOid: string): Promise<RawOidValue[]>;

  /** Close the session and release the UDP socket */
  close(): void;
}

// ---------------------------------------------------------------------------
// Vendor adapter interface
// ---------------------------------------------------------------------------

export interface ISnmpAdapter {
  /** Human-readable vendor name — must match ManagedOlt.brand */
  readonly vendor: string;

  /**
   * Collect OLT-level metrics.
   * Must NOT issue any SNMP SET operations.
   */
  getOltSnapshot(session: ISnmpSession, ip: string): Promise<OltSnapshot>;

  /**
   * Collect full ONU list for an OLT.
   * Returns an empty array (never throws) if the walk times out.
   * Must NOT issue any SNMP SET operations.
   */
  getOnuList(session: ISnmpSession): Promise<OnuSnapshot[]>;

  /**
   * Collect active alarms / traps from the OLT alarm table.
   * Must NOT issue any SNMP SET operations.
   */
  getAlarms(session: ISnmpSession): Promise<SnmpAlarm[]>;
}

// ---------------------------------------------------------------------------
// Session factory interface
// ---------------------------------------------------------------------------

export interface SnmpSessionOptions {
  /** SNMP community string (read-only) */
  community: string;
  /** SNMP version — only v1 and v2c for now; v3 reserved */
  version: "v1" | "v2c";
  /** Request timeout in milliseconds (default 3000) */
  timeoutMs?: number;
  /** Max retries before giving up (default 2) */
  retries?: number;
}

export interface ISnmpSessionFactory {
  /**
   * Create a read-only SNMP session.
   * The caller is responsible for calling session.close() in a finally block.
   */
  create(ip: string, options: SnmpSessionOptions): ISnmpSession;
}

// ---------------------------------------------------------------------------
// Vendor adapter registry interface
// ---------------------------------------------------------------------------

export interface IVendorAdapterRegistry {
  /** Register a vendor adapter. Call once at server startup. */
  register(adapter: ISnmpAdapter): void;

  /**
   * Resolve the best adapter for a given vendor brand string.
   * Falls back to the Generic adapter if no exact match is found.
   */
  resolve(brand: string): ISnmpAdapter;
}

// ---------------------------------------------------------------------------
// Poller scheduler interface
// ---------------------------------------------------------------------------

export interface PollIntervals {
  oltInfoSecs: number;       // default 60
  onuListSecs: number;       // default 120
  alarmsSecs: number;        // default 30
}

export interface ISnmpPoller {
  /**
   * Start the polling loop for a single OLT.
   * Multiplies all intervals by 4 when safePollingMode is true.
   */
  start(oltId: string, ip: string, options: SnmpSessionOptions, safePollingMode: boolean): void;

  /** Stop polling for a single OLT and release resources. */
  stop(oltId: string): void;

  /** Trigger an immediate full refresh for a single OLT (manual). */
  refresh(oltId: string): Promise<void>;

  /** Return the most recent cached snapshot for an OLT. */
  getSnapshot(oltId: string): OltSnapshot | null;

  /** Return the most recent cached ONU list for an OLT. */
  getOnuList(oltId: string): OnuSnapshot[];
}
