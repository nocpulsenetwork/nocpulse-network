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
import type { OltHealthResult } from "../snmp/real-snmp-client";
import type { OnuDiscoveryResult } from "../types/onu-discovery.types";

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
  /** Human-readable device name (OLT name or ONU identifier). */
  deviceName: string;
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
    deviceName: olt.name,
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
  const label = onu.name || onu.id;
  const base = {
    oltId: onu.oltId,
    onuId: onu.id,
    deviceName: label,
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
        message: `${label} sent a dying-gasp signal before going offline. Reason: ${onu.lastOfflineReason ?? "unknown"}.`,
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
        message: `${label} is offline due to loss of optical signal on port ${onu.oltPort}. Reason: ${onu.lastOfflineReason ?? "unknown"}.`,
      });
    } else {
      out.push({
        ...base,
        id: `onu-${onu.id}-link-down`,
        type: "link-down",
        severity: "critical",
        title: "ONU Offline",
        message: `${label} on port ${onu.oltPort} is offline. Last reason: ${onu.lastOfflineReason ?? "unknown"}.`,
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
          `${label} RX power is ${onu.rxPower} dBm, below the critical threshold of ${RX_POWER_CRIT_DBM} dBm.` +
          (onu.distance != null ? ` Distance: ${(onu.distance / 1000).toFixed(1)} km.` : ""),
      });
    } else if (onu.rxPower < RX_POWER_WARN_DBM) {
      out.push({
        ...base,
        id: `onu-${onu.id}-low-rx-power`,
        type: "low-rx-power",
        severity: "warning",
        title: "ONU RX Power Low",
        message: `${label} RX power is ${onu.rxPower} dBm, below the warning threshold of ${RX_POWER_WARN_DBM} dBm.`,
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
      message: `${label} transceiver temperature is ${onu.temperature}°C, above the ${ONU_TEMP_WARN_C}°C threshold.`,
    });
  }

  // Note: "traffic unavailable" info alarm intentionally omitted —
  // the EasyPath adapter does not provide per-ONU traffic counters, so it
  // would fire for every online ONU (~274 entries) and add no actionable value.

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

// ─── Live-cache based detection (single source of truth) ───────────────────
//
// These functions work directly with the OLT health cache and ONU discovery
// cache data from olt.routes.ts. They are the PRIMARY detection path and
// replace the UniversalOLT/ONU path for real devices.
//
// ONU offline alarms are GROUPED by OLT (one alarm per OLT, not per ONU)
// to avoid flooding 213+ individual alarms when a fiber cut occurs.

/**
 * Detect OLT health alarms (temperature, CPU, memory) from a fresh health poll.
 * Does NOT create an "OLT offline" alarm — that requires a dedicated failed-poll
 * signal which is not in scope (no OLT health modification allowed).
 */
export function detectOltHealthAlarms(
  oltId: string,
  ip: string,
  health: OltHealthResult,
): DetectedAlarm[] {
  const out: DetectedAlarm[] = [];
  const base = {
    oltId,
    onuId: null,
    deviceName: oltId,
    source: "read-only" as const,
    createdAt: health.polledAt,
  };

  if (health.temperatureC !== null) {
    if (health.temperatureC > OLT_TEMP_CRIT_C) {
      out.push({
        ...base,
        id: `olt-${oltId}-high-temp`,
        type: "high-temp" as AlarmType,
        severity: "critical" as const,
        title: "OLT Critical Temperature",
        message: `OLT ${ip} chassis is at ${health.temperatureC}°C — above critical threshold of ${OLT_TEMP_CRIT_C}°C. Check rack airflow.`,
      });
    } else if (health.temperatureC > OLT_TEMP_WARN_C) {
      out.push({
        ...base,
        id: `olt-${oltId}-high-temp`,
        type: "high-temp" as AlarmType,
        severity: "warning" as const,
        title: "OLT High Temperature",
        message: `OLT ${ip} chassis is at ${health.temperatureC}°C — above warning threshold of ${OLT_TEMP_WARN_C}°C.`,
      });
    }
  }

  if (health.cpuPct !== null && health.cpuPct >= CPU_OVERLOAD_PCT) {
    out.push({
      ...base,
      id: `olt-${oltId}-cpu-overload`,
      type: "cpu-overload" as AlarmType,
      severity: "warning" as const,
      title: "OLT CPU Overload",
      message: `OLT ${ip} CPU usage is ${health.cpuPct}%, above the ${CPU_OVERLOAD_PCT}% threshold.`,
    });
  }

  if (health.memPct !== null && health.memPct >= MEM_OVERLOAD_PCT) {
    out.push({
      ...base,
      id: `olt-${oltId}-mem-overload`,
      type: "mem-overload" as AlarmType,
      severity: "warning" as const,
      title: "OLT Memory Overload",
      message: `OLT ${ip} memory usage is ${health.memPct}%, above the ${MEM_OVERLOAD_PCT}% threshold.`,
    });
  }

  return out;
}

/**
 * Detect ONU alarms from a discovery result.
 *
 * Offline alarm strategy — ONE grouped alarm per OLT (never one per ONU):
 *   "CDATA-01: 213 ONUs Offline (42 online, 255 total)"
 *
 * Individual threshold alarms (RX power, temperature) are still raised
 * per ONU since they are actionable and don't cause flooding.
 */
export function detectOnuGroupAlarms(
  oltId: string,
  oltLabel: string,
  discovery: OnuDiscoveryResult,
): DetectedAlarm[] {
  const out: DetectedAlarm[] = [];
  const ts = discovery.discoveredAt;

  // ── Grouped offline alarm (ONE per OLT, not per ONU) ──────────────────
  if (discovery.offlineOnus > 0) {
    const count = discovery.offlineOnus;
    out.push({
      id: `olt-${oltId}-onus-offline`,
      oltId,
      onuId: null,
      deviceName: oltLabel,
      type: "link-down" as AlarmType,
      severity: "critical" as const,
      title: `${count} ONU${count > 1 ? "s" : ""} Offline`,
      message: `${oltLabel}: ${count} ONU${count > 1 ? "s" : ""} offline out of ${discovery.totalOnus} total (${discovery.onlineOnus} online).`,
      createdAt: ts,
      source: "read-only",
    });
  }

  // ── Individual threshold alarms (RX power, temperature) ───────────────
  for (const onu of discovery.onus) {
    const label = onu.name ?? onu.serial ?? `ONU ${onu.ponPort}/${onu.onuId}`;
    const onuFullId = `${oltId}-${onu.ponPort}-${onu.onuId}`;
    const base = {
      oltId,
      onuId: onuFullId,
      deviceName: label,
      source: "read-only" as const,
      createdAt: ts,
    };

    if (onu.rxPowerDbm !== null) {
      if (onu.rxPowerDbm < RX_POWER_CRIT_DBM) {
        out.push({
          ...base,
          id: `onu-${onuFullId}-low-rx-power`,
          type: "low-rx-power" as AlarmType,
          severity: "critical" as const,
          title: "ONU RX Power Critical",
          message: `${label} RX power is ${onu.rxPowerDbm} dBm, below critical threshold of ${RX_POWER_CRIT_DBM} dBm.`,
        });
      } else if (onu.rxPowerDbm < RX_POWER_WARN_DBM) {
        out.push({
          ...base,
          id: `onu-${onuFullId}-low-rx-power`,
          type: "low-rx-power" as AlarmType,
          severity: "warning" as const,
          title: "ONU RX Power Low",
          message: `${label} RX power is ${onu.rxPowerDbm} dBm, below warning threshold of ${RX_POWER_WARN_DBM} dBm.`,
        });
      }
    }

    if (onu.temperatureCelsius !== null && onu.temperatureCelsius > ONU_TEMP_WARN_C) {
      out.push({
        ...base,
        id: `onu-${onuFullId}-high-temp`,
        type: "high-temp" as AlarmType,
        severity: "warning" as const,
        title: "ONU High Temperature",
        message: `${label} transceiver temperature is ${onu.temperatureCelsius}°C, above the ${ONU_TEMP_WARN_C}°C threshold.`,
      });
    }
  }

  return out;
}
