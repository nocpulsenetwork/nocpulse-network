/**
 * Universal device types — vendor-agnostic normalized data contract.
 *
 * These interfaces are the single source of truth for what the API always
 * returns, regardless of the vendor-specific MIB/CLI format underneath.
 * Every adapter must map its raw payload to these shapes before returning.
 *
 * Field naming convention:
 *  - All power values  → dBm (float, negative)
 *  - All time values   → ISO 8601 string (serialization) or Date (runtime)
 *  - All traffic rates → bits per second (number)
 *  - All distances     → meters (number)
 *  - All temperatures  → degrees Celsius (number)
 *
 * Nullable fields (null) mean "device did not report / not applicable".
 * Absent fields should never appear — always include with null when unknown.
 */

// ─── Shared enums ──────────────────────────────────────────────────────────

export type Vendor = "huawei" | "zte" | "bdcom" | "vsol" | "cdata" | "generic";

export type OnuType = "GPON" | "EPON" | "XGS-PON" | "10G-EPON" | "XPON";

export type DeviceStatus = "online" | "offline" | "degraded" | "unreachable" | "unknown";

export type AlarmSeverity = "critical" | "major" | "minor" | "warning" | "info";

export type AlarmStatus = "active" | "cleared" | "acknowledged";

// ─── Universal OLT ─────────────────────────────────────────────────────────

export interface UniversalOLT {
  /** Stable unique identifier (UUID or slug). Never changes after provisioning. */
  id: string;

  /** Human-readable name (editable by NOC operator). */
  name: string;

  /** OLT vendor. Drives adapter selection in the registry. */
  vendor: Vendor;

  /** Hardware model string as reported by the device (e.g. "MA5800-X7"). */
  model: string;

  /** Active firmware / software version string. */
  firmware: string;

  /** Management IP address (IPv4 or IPv6). */
  ipAddress: string;

  /** Physical or logical site location. */
  location: string;

  /** Current operational status. */
  status: DeviceStatus;

  /** Total ONU slots capacity across all PON ports. */
  totalOnuCapacity: number;

  /** Number of ONUs currently registered (auth'd) on this OLT. */
  registeredOnu: number;

  /** Number of registered ONUs currently in Online state. */
  onlineOnu: number;

  /** Number of registered ONUs currently in Offline / LOS state. */
  offlineOnu: number;

  /** CPU utilization percentage (0–100). */
  cpuUsagePercent: number | null;

  /** RAM / heap utilization percentage (0–100). */
  memUsagePercent: number | null;

  /** Chassis temperature in °C (main sensor or highest board sensor). */
  temperature: number | null;

  /** Device uptime in seconds since last boot. */
  uptime: number;

  /** Reason for the last unplanned restart / offline event, if known. */
  lastOfflineReason: string | null;

  /** ISO 8601 timestamp of when this OLT last transitioned to Online. */
  lastOnlineTime: string | null;

  /** ISO 8601 timestamp of the most recent successful poll. */
  lastPolled: string;

  /** Active alarm count by severity (snapshot at last poll). */
  alarmSummary: {
    critical: number;
    major: number;
    minor: number;
    warning: number;
  };
}

// ─── Universal ONU ─────────────────────────────────────────────────────────

export interface UniversalONU {
  /** Stable unique identifier. */
  id: string;

  /** ID of the parent OLT. */
  oltId: string;

  /** PON port identifier (e.g. "0/1/3"). */
  oltPort: string;

  /** ONU registration index on the PON port. */
  onuIndex: number;

  /** PON technology type. */
  onuType: OnuType;

  /** ONU hardware serial number (hex, vendor-encoded). */
  serial: string;

  /** ONU MAC address (colon-separated hex). */
  mac: string;

  /** Hardware model string (e.g. "EG8145V5"). */
  model: string;

  /** Active firmware version on the ONU. */
  firmware: string;

  /** Vendor of the ONU hardware (may differ from OLT vendor). */
  vendor: Vendor;

  /** Subscriber-facing label. */
  name: string;

  /** Optional NOC description / notes. */
  description: string;

  /** Management or subscriber IP address. */
  ipAddress: string;

  /** VLAN ID associated with this ONU. */
  vlan: number;

  /** Service / line profile name applied to this ONU. */
  profile: string;

  /** Current operational status. */
  status: DeviceStatus;

  // ── Optical measurements ──────────────────────────────────────────────

  /** ONU transmit optical power in dBm. Typical range: +0.5 to +5 dBm. */
  txPower: number | null;

  /** ONU receive optical power in dBm. Typical range: -8 to -27 dBm. */
  rxPower: number | null;

  /** OLT-side receive power for this ONU in dBm. */
  oltRxPower: number | null;

  /** Laser bias current in mA. */
  biasCurrent: number | null;

  /** Transceiver supply voltage in V. */
  voltage: number | null;

  /** Transceiver temperature in °C. */
  temperature: number | null;

  // ── Physical ──────────────────────────────────────────────────────────

  /** Fiber distance from OLT to ONU in meters. */
  distance: number | null;

  // ── Traffic ───────────────────────────────────────────────────────────

  /** Downstream (OLT → ONU) traffic rate in bits per second. */
  rxRateBps: number | null;

  /** Upstream (ONU → OLT) traffic rate in bits per second. */
  txRateBps: number | null;

  // ── Lifecycle ─────────────────────────────────────────────────────────

  /** Uptime in seconds since last ONU registration / online event. */
  uptime: number | null;

  /** Reason string for the last offline event (LOS, dying-gasp, etc.). */
  lastOfflineReason: string | null;

  /** ISO 8601 timestamp of the most recent Online transition. */
  lastOnlineTime: string | null;

  /** ISO 8601 timestamp of the most recent successful poll. */
  lastPolled: string;
}

// ─── Universal Alarm ───────────────────────────────────────────────────────

export type AlarmType =
  | "los"             // Loss of Signal
  | "lof"             // Loss of Frame
  | "dying-gasp"      // ONU powering down
  | "rogue-onu"       // Rogue ONU causing port disruption
  | "high-temp"       // Temperature threshold exceeded
  | "low-rx-power"    // Receive optical power below threshold
  | "high-rx-power"   // Receive optical power above threshold
  | "cpu-overload"    // CPU usage threshold exceeded
  | "mem-overload"    // Memory usage threshold exceeded
  | "link-down"       // Uplink / board port down
  | "auth-fail"       // ONU authentication failure
  | "config-mismatch" // ONU profile mismatch
  | "unknown";

export interface UniversalAlarm {
  /** Stable unique identifier for this alarm event. */
  id: string;

  /** Alarm category. */
  type: AlarmType;

  /** NOC-facing severity classification. */
  severity: AlarmSeverity;

  /** Current lifecycle state. */
  status: AlarmStatus;

  /** ID of the affected OLT or ONU. */
  deviceId: string;

  /** Display name of the affected device. */
  deviceName: string;

  /** IP address of the affected device. */
  deviceIp: string;

  /** Vendor that reported this alarm. */
  vendor: Vendor;

  /** Short human-readable alarm message. */
  message: string;

  /** Extended detail / raw trap message. */
  detail: string;

  /** ISO 8601 timestamp when this alarm was raised. */
  raisedAt: string;

  /** ISO 8601 timestamp when cleared, or null if still active. */
  clearedAt: string | null;

  /** ISO 8601 timestamp when acknowledged, or null if not yet ack'd. */
  acknowledgedAt: string | null;

  /** Username / operator who acknowledged, or null. */
  acknowledgedBy: string | null;
}

// ─── Standard API envelope ─────────────────────────────────────────────────

export interface ApiListResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    source: "cache" | "live" | "db" | "mock";
    generatedAt: string; // ISO 8601
  };
}

export interface ApiDetailResponse<T> {
  data: T;
  meta: {
    source: "cache" | "live" | "db" | "mock";
    generatedAt: string;
  };
}

export interface ApiError {
  error: string;
  code: string;
  detail?: string;
}
