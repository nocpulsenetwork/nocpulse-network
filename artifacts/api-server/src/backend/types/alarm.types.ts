export type AlarmSeverity = "critical" | "major" | "minor" | "warning" | "info";

export type AlarmStatus = "active" | "cleared" | "acknowledged";

export type AlarmSource = "olt" | "onu" | "system" | "link";

export type AlarmType =
  | "los"           // Loss of Signal
  | "lof"           // Loss of Frame
  | "lom"           // Loss of Multi-frame
  | "dying-gasp"    // ONU powering down
  | "rogue-onu"     // Rogue ONU detected
  | "high-temp"     // High temperature
  | "cpu-overload"  // CPU usage threshold exceeded
  | "mem-overload"  // Memory usage threshold exceeded
  | "low-rx-power"  // Low optical receive power
  | "high-rx-power" // High optical receive power
  | "link-down"     // Link failure
  | "auth-fail"     // ONU authentication failure
  | "config-mismatch"
  | "unknown";

export interface AlarmNormalized {
  id: string;
  type: AlarmType;
  severity: AlarmSeverity;
  status: AlarmStatus;
  source: AlarmSource;
  deviceId: string;        // oltId or onuId
  deviceName: string;
  deviceIp: string;
  message: string;
  detail: string;
  raisedAt: Date;
  clearedAt: Date | null;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  vendor: string;
  rawData?: Record<string, unknown>;
}

export interface AlarmFilter {
  severity?: AlarmSeverity[];
  status?: AlarmStatus[];
  source?: AlarmSource[];
  deviceId?: string;
  from?: Date;
  to?: Date;
}
