/**
 * ONU Discovery types — shared across the adapter layer and API routes.
 *
 * OnuDiscoveryResult is produced by VendorAdapter.discoverOnus() and cached
 * in-memory per OLT ID. The API surface (`GET /api/olts/:id/onus/real`) returns
 * either OnuDiscoveryResult (hasData: true) or OnuDiscoveryEmpty (hasData: false).
 *
 * Safety: all fields are read-only. No SNMP write is ever involved.
 */

/** Minimal summary of a single ONU as returned by the discovery walk. */
export interface OnuDiscoverySummary {
  /** ONU identifier within the PON port (e.g. "1", "5"). */
  onuId: string;

  /** PON port the ONU is attached to (e.g. "0/1/0", "1"). */
  ponPort: string;

  /** Operational status from the OLT management table. */
  status: "online" | "offline" | "unknown";

  /** GPON serial number (VENDORHEX format), or null. */
  serial: string | null;

  /** ONU hardware model/type string, or null. */
  type: string | null;

  /**
   * ONU name/alias as configured on the OLT management interface, or null
   * when unavailable from this firmware version.
   */
  name: string | null;

  /**
   * MAC address / EPON LLID for this ONU (XX:XX:XX:XX:XX:XX format), or null.
   * Distinct from `serial` — serial is for GPON VENDORHEX, mac is hardware MAC.
   */
  mac: string | null;

  /**
   * De-registration reason code from the OLT (vendor INTEGER enum), or null.
   * See SnmpOnu.offlineReasonCode for the C-DATA/EasyPath value mapping.
   */
  offlineReasonCode: number | null;

  /**
   * ONU receive optical power in dBm, or null when not available from this
   * firmware/vendor.  Null for EasyPath FD1208S-B0 (no confirmed optical OIDs).
   */
  rxPowerDbm: number | null;

  /**
   * ONU transmit optical power in dBm, or null when unavailable.
   */
  txPowerDbm: number | null;

  /**
   * Physical fiber distance from OLT to ONU in metres, or null when unavailable.
   * Convert to km for display: `(distanceMeters / 1000).toFixed(2) + " km"`.
   */
  distanceMeters: number | null;
}

/** Per-PON-port summary derived from the ONU discovery list. */
export interface RealPonPort {
  /** PON port identifier as reported by the SNMP MIB. */
  id: string;

  /** Total ONUs on this port. */
  total: number;

  /** Online ONU count. */
  online: number;

  /** Offline ONU count. */
  offline: number;

  /** ONUs with unknown status. */
  unknown: number;
}

/** Full result of a successful ONU discovery operation. */
export interface OnuDiscoveryResult {
  /** Discriminator: true means real data was collected. */
  hasData: true;

  /** OLT ID this result belongs to. */
  oltId: string;

  /** Total ONUs found in the management table (up to the limit). */
  totalOnus: number;

  /** ONUs with status="online". */
  onlineOnus: number;

  /** ONUs with status="offline". */
  offlineOnus: number;

  /** ONUs with status="unknown". */
  unknownOnus: number;

  /** Number of distinct PON ports seen in the ONU list. */
  ponPortCount: number;

  /**
   * Number of physical PON ports confirmed from OLT hardware (ifTable scan).
   * May exceed ponPortCount when some ports have zero ONUs.
   * Undefined when hardware port count could not be determined.
   */
  physicalPortCount?: number;

  /** Per-port breakdown. */
  ponPorts: RealPonPort[];

  /** Individual ONU list. */
  onus: OnuDiscoverySummary[];

  /** ISO 8601 timestamp of when the discovery ran. */
  discoveredAt: string;

  /** Total time for the SNMP operation in milliseconds. */
  latencyMs: number;

  /** Always "live-snmp" — discovery never uses cached/mock data. */
  source: "live-snmp";

  /** Vendor name used to select the MIB (e.g. "CDATA", "Huawei"). */
  vendor: string;

  /** MIB table name used (e.g. "cdataGponOnuTable"). */
  mibUsed: string;

  /** Human-readable status message from the SNMP client. */
  message: string;

  /** OLT uptime in seconds at time of discovery (from sysUpTime), or null. */
  sysUpTimeSecs?: number | null;

  /** OLT sysDescr string at time of discovery (firmware / hardware info), or null. */
  sysDescr?: string | null;

  /** OLT sysName string at time of discovery, or null. */
  sysName?: string | null;
}

/** Returned when no discovery has been performed yet for this OLT. */
export interface OnuDiscoveryEmpty {
  hasData: false;
  oltId: string;
}

/** Union of both discovery states — returned by GET /api/olts/:id/onus/real. */
export type OnuDiscoveryResponse = OnuDiscoveryResult | OnuDiscoveryEmpty;
