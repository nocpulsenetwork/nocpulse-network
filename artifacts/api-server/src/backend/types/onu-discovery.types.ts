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

  /** Per-port breakdown. */
  ponPorts: RealPonPort[];

  /** Individual ONU list (at most 50 entries). */
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
}

/** Returned when no discovery has been performed yet for this OLT. */
export interface OnuDiscoveryEmpty {
  hasData: false;
  oltId: string;
}

/** Union of both discovery states — returned by GET /api/olts/:id/onus/real. */
export type OnuDiscoveryResponse = OnuDiscoveryResult | OnuDiscoveryEmpty;
