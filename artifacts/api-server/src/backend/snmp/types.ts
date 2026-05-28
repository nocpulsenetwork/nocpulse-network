/**
 * SNMP Mock Adapter — shared types
 *
 * All methods in this layer are READ-ONLY.
 * No write operations, no reboot commands, no config changes.
 *
 * Read-only view types supplement the full UniversalOLT/ONU/Alarm shapes
 * by providing trimmed projections suited to individual polling methods.
 */

export type {
  UniversalOLT,
  UniversalONU,
  UniversalAlarm,
  PonPort,
  Vendor,
  DeviceStatus,
  AlarmSeverity,
  AlarmStatus,
  AlarmType,
  OnuType,
} from "../types/universal.types";

// ─── ONU optical power projection ─────────────────────────────────────────
// Returned by getOnuOpticalPower(). Carries only the optical measurements
// so callers that only need power levels skip the full ONU payload.

export interface OnuOpticalPower {
  onuId: string;
  oltId: string;
  oltPort: string;
  onuIndex: number;

  /** ONU transmit power in dBm. null when ONU is offline. */
  txPower: number | null;

  /** ONU receive power in dBm (as measured at the ONU). null when offline. */
  rxPower: number | null;

  /** OLT-side receive power for this ONU in dBm. null when offline. */
  oltRxPower: number | null;

  /** Laser bias current in mA. null when offline. */
  biasCurrent: number | null;

  /** Transceiver supply voltage in V. null when offline. */
  voltage: number | null;

  /** Transceiver temperature in °C. null when offline. */
  temperature: number | null;

  /** ISO 8601 timestamp of when this measurement was taken. */
  polledAt: string;
}

// ─── ONU status projection ─────────────────────────────────────────────────
// Returned by getOnuStatus(). Carries lifecycle state only, no optical data.

export interface OnuStatusView {
  onuId: string;
  oltId: string;
  oltPort: string;
  onuIndex: number;
  name: string;
  status: import("../types/universal.types").DeviceStatus;

  /** Uptime in seconds since last online event. null when offline. */
  uptime: number | null;

  /** Human-readable reason string for the last offline event. null when online. */
  lastOfflineReason: string | null;

  /** ISO 8601 timestamp of the most recent Online transition. null if never online. */
  lastOnlineTime: string | null;

  /** ISO 8601 timestamp of this status snapshot. */
  polledAt: string;
}

// ─── Session connection config ─────────────────────────────────────────────
// Passed to MockSnmpSession.connect(). Mirrors the real SNMP session config
// so it can be swapped in for the real session with no caller changes.

export interface MockSnmpConnectConfig {
  /** OLT management IP address. */
  host: string;

  /** SNMP community string (read-only). Default: "public". */
  community?: string;

  /** SNMP version. v1/v2c only for now. Default: "v2c". */
  version?: "v1" | "v2c";

  /** Request timeout in ms (used only to simulate realistic timing). Default: 3000. */
  timeoutMs?: number;
}

// ─── Unsupported operation error ───────────────────────────────────────────
// Thrown by any future attempt to call write operations from a mock adapter.
// Write methods are intentionally absent from the interface — this class
// exists as a documentation anchor and for future safety checks.

export class UnsupportedOperationError extends Error {
  constructor(adapterName: string, method: string) {
    super(
      `[${adapterName}] "${method}" is a write operation and is not supported ` +
      "by the read-only mock SNMP adapter. Real write support requires explicit " +
      "review and a separate write-capable adapter."
    );
    this.name = "UnsupportedOperationError";
  }
}

// ─── OLT not found error ────────────────────────────────────────────────────

export class OltNotFoundError extends Error {
  constructor(oltId: string) {
    super(
      `MockSnmpAdapter: OLT "${oltId}" not found in mock dataset. ` +
      "Registered IDs: olt-001, olt-002, olt-003, olt-004, olt-005."
    );
    this.name = "OltNotFoundError";
  }
}
