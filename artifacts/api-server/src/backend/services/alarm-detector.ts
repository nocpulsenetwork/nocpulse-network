/**
 * Alarm Detector — read-only, zero side-effects.
 *
 * Scans UniversalOLT and UniversalONU records and derives alarms
 * based on fixed thresholds. No SNMP, no DB, no background process.
 * Returns DetectedAlarm[] — deterministic for the same input.
 *
 * Thresholds:
 *   OLT temperature warn  >50°C  /  crit  >55°C
 *   ONU RX power warn     <-25 dBm / crit <-27 dBm
 *   ONU temperature warn  >52°C
 *   CPU overload warn     ≥80%
 *   Memory overload warn  ≥85%
 */

import type { UniversalOLT, UniversalONU, AlarmType } from "../types/universal.types";

// ─── Thresholds ────────────────────────────────────────────────────────────

const RX_POWER_WARN_DBM = -25.0;
const RX_POWER_CRIT_DBM = -27.0;
const OLT_TEMP_WARN_C   = 50;
const OLT_TEMP_CRIT_C   = 55;
const ONU_TEMP_WARN_C   = 52;
const CPU_OVERLOAD_PCT  = 80;
const MEM_OVERLOAD_PCT  = 85;

// ─── Types ─────────────────────────────────────────────────────────────────

export type DetectedAlarmSeverity = "critical" | "warning" | "info";

export interface DetectedAlarm {
  id: string;
  oltId: string | null;
  onuId: string | null;
  type: AlarmType;
  severity: DetectedAlarmSeverity;
  title: string;
  message: string;
  createdAt: string;
  source: "read-only";
}

// ─── OLT detection ─────────────────────────────────────────────────────────

export function detectOltAlarms(olt: UniversalOLT): DetectedAlarm[] {
  const out: DetectedAlarm[] = [];
  const base = {
    oltId: olt.id,
    onuId: null,
    source: "read-only" as const,
    createdAt: olt.lastPolled,
  };

  if (olt.status === "offline" || olt.status === "unreachable") {
    out.push({
      ...base,
      id: `olt-${olt.id}-link-down`,
      type: "link-down",
      severity: "critical",
      title: "OLT Unreachable",
      message: `${olt.name} (${olt.ipAddress}) is ${olt.status}.${olt.lastOfflineReason ? " " + olt.lastOfflineReason : ""}`,
    });
  } else if (olt.status === "degraded") {
    out.push({
      ...base,
      id: `olt-${olt.id}-degraded`,
      type: "link-down",
      severity: "warning",
      title: "OLT Degraded",
      message: `${olt.name} (${olt.ipAddress}) is reporting degraded status.${olt.lastOfflineReason ? " " + olt.lastOfflineReason : ""}`,
    });
  }

  if (olt.temperature !== null) {
    if (olt.temperature > OLT_TEMP_CRIT_C) {
      out.push({
        ...base,
        id: `olt-${olt.id}-high-temp`,
        type: "high-temp",
        severity: "critical",
        title: "OLT Critical Temperature",
        message: `${olt.name} chassis is at ${olt.temperature}°C, above the critical threshold of ${OLT_TEMP_CRIT_C}°C. Check rack airflow.`,
      });
    } else if (olt.temperature > OLT_TEMP_WARN_C) {
      out.push({
        ...base,
        id: `olt-${olt.id}-high-temp`,
        type: "high-temp",
        severity: "warning",
        title: "OLT High Temperature",
        message: `${olt.name} chassis is at ${olt.temperature}°C, above the warning threshold of ${OLT_TEMP_WARN_C}°C.`,
      });
    }
  }

  if (olt.cpuUsagePercent !== null && olt.cpuUsagePercent >= CPU_OVERLOAD_PCT) {
    out.push({
      ...base,
      id: `olt-${olt.id}-cpu-overload`,
      type: "cpu-overload",
      severity: "warning",
      title: "OLT CPU Overload",
      message: `${olt.name} CPU usage is ${olt.cpuUsagePercent}%, above the ${CPU_OVERLOAD_PCT}% threshold.`,
    });
  }

  if (olt.memUsagePercent !== null && olt.memUsagePercent >= MEM_OVERLOAD_PCT) {
    out.push({
      ...base,
      id: `olt-${olt.id}-mem-overload`,
      type: "mem-overload",
      severity: "warning",
      title: "OLT Memory Overload",
      message: `${olt.name} memory usage is ${olt.memUsagePercent}%, above the ${MEM_OVERLOAD_PCT}% threshold.`,
    });
  }

  return out;
}

// ─── ONU detection ─────────────────────────────────────────────────────────

export function detectOnuAlarms(onu: UniversalONU): DetectedAlarm[] {
  const out: DetectedAlarm[] = [];
  const base = {
    oltId: onu.oltId,
    onuId: onu.id,
    source: "read-only" as const,
    createdAt: onu.lastPolled,
  };
  const reason = (onu.lastOfflineReason ?? "").toLowerCase();

  if (onu.status === "offline") {
    if (reason.includes("dying-gasp") || reason.includes("power loss")) {
      out.push({
        ...base,
        id: `onu-${onu.id}-dying-gasp`,
        type: "dying-gasp",
        severity: "critical",
        title: "ONU Dying Gasp — Power Loss",
        message: `${onu.name} sent a dying-gasp signal before going offline. Reason: ${onu.lastOfflineReason ?? "unknown"}.`,
      });
    } else if (
      reason.includes("los") ||
      reason.includes("loss of signal") ||
      reason.includes("fiber")
    ) {
      out.push({
        ...base,
        id: `onu-${onu.id}-los`,
        type: "los",
        severity: "critical",
        title: "ONU LOS — Loss of Signal",
        message: `${onu.name} is offline due to loss of optical signal on port ${onu.oltPort}. Reason: ${onu.lastOfflineReason ?? "unknown"}.`,
      });
    } else {
      out.push({
        ...base,
        id: `onu-${onu.id}-link-down`,
        type: "link-down",
        severity: "critical",
        title: "ONU Offline",
        message: `${onu.name} (${onu.ipAddress}) is offline. Last reason: ${onu.lastOfflineReason ?? "unknown"}.`,
      });
    }
  }

  if (onu.rxPower !== null) {
    if (onu.rxPower < RX_POWER_CRIT_DBM) {
      out.push({
        ...base,
        id: `onu-${onu.id}-low-rx-power`,
        type: "low-rx-power",
        severity: "critical",
        title: "ONU RX Power Critical",
        message:
          `${onu.name} RX power is ${onu.rxPower} dBm, below the critical threshold of ${RX_POWER_CRIT_DBM} dBm.` +
          (onu.distance != null ? ` Distance: ${(onu.distance / 1000).toFixed(1)} km.` : ""),
      });
    } else if (onu.rxPower < RX_POWER_WARN_DBM) {
      out.push({
        ...base,
        id: `onu-${onu.id}-low-rx-power`,
        type: "low-rx-power",
        severity: "warning",
        title: "ONU RX Power Low",
        message: `${onu.name} RX power is ${onu.rxPower} dBm, below the warning threshold of ${RX_POWER_WARN_DBM} dBm.`,
      });
    }
  }

  if (onu.temperature !== null && onu.temperature > ONU_TEMP_WARN_C) {
    out.push({
      ...base,
      id: `onu-${onu.id}-high-temp`,
      type: "high-temp",
      severity: "warning",
      title: "ONU High Temperature",
      message: `${onu.name} transceiver temperature is ${onu.temperature}°C, above the ${ONU_TEMP_WARN_C}°C threshold.`,
    });
  }

  if (onu.status === "online" && onu.rxRateBps === null && onu.txRateBps === null) {
    out.push({
      ...base,
      id: `onu-${onu.id}-traffic-unavail`,
      type: "unknown",
      severity: "info",
      title: "ONU Traffic Data Unavailable",
      message: `${onu.name} is online but traffic counters are not available from the adapter.`,
    });
  }

  return out;
}

// ─── Aggregate helpers ─────────────────────────────────────────────────────

export function detectAllAlarms(
  olts: UniversalOLT[],
  onus: UniversalONU[],
): DetectedAlarm[] {
  return [
    ...olts.flatMap(detectOltAlarms),
    ...onus.flatMap(detectOnuAlarms),
  ];
}

export function detectAlarmsForOlt(
  oltId: string,
  olts: UniversalOLT[],
  onus: UniversalONU[],
): DetectedAlarm[] {
  const olt = olts.find((o) => o.id === oltId);
  if (!olt) return [];
  return [
    ...detectOltAlarms(olt),
    ...onus.filter((o) => o.oltId === oltId).flatMap(detectOnuAlarms),
  ];
}

export function detectAlarmsForOnu(
  onuId: string,
  onus: UniversalONU[],
): DetectedAlarm[] {
  const onu = onus.find((o) => o.id === onuId);
  if (!onu) return [];
  return detectOnuAlarms(onu);
}
