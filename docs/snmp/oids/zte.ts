/**
 * NOCpulse — ZTE OLT SNMP OID Map (Planning Document)
 *
 * PLANNING ONLY — not compiled, not imported by the running app.
 *
 * Target hardware : ZXA10 C300, ZXA10 C600, ZXA10 C320
 * MIB files       : ZTE-AN-GPON-MIB, ZTE-AN-EPON-MIB, ZTE-AN-ALARM-MIB,
 *                   ZTE-AN-DEVICE-MIB, ZTE-AN-IF-MIB
 * Enterprise OID  : 1.3.6.1.4.1.3902
 *
 * ⚠ READ ONLY — no SET OIDs listed. No reboot, no config writes.
 */

import { GenericAdapter } from "./generic";
import type { ISnmpSession, OltSnapshot, OnuSnapshot, SnmpAlarm } from "../ADAPTER_INTERFACE";

// ---------------------------------------------------------------------------
// ZTE enterprise prefix
// ---------------------------------------------------------------------------

const ZTE = "1.3.6.1.4.1.3902" as const;

// ---------------------------------------------------------------------------
// Device / system OIDs (ZTE-AN-DEVICE-MIB)
// ---------------------------------------------------------------------------

export const ZTE_DEVICE_OIDs = {
  /** CPU usage — main control board */
  zxAnDevCpuUsage:    `${ZTE}.3.103.1.2.1.2.1`,  // % integer

  /** Memory usage — main control board */
  zxAnDevMemUsage:    `${ZTE}.3.103.1.2.2.2.1`,  // % integer

  /** Fan state table */
  zxAnDevFanTable:    `${ZTE}.3.103.1.2.5.1.1`,

  /** Temperature sensor table */
  zxAnDevTempTable:   `${ZTE}.3.103.1.2.4.1.1`,
  zxAnDevTempValue:   `${ZTE}.3.103.1.2.4.1.1.1.3`,  // °C
} as const;

// ---------------------------------------------------------------------------
// GPON ONU table (ZTE-AN-GPON-MIB)
// ---------------------------------------------------------------------------

export const ZTE_GPON_OIDs = {
  /** Walk this table to enumerate all GPON ONUs */
  zxAnGponOnuTable:            `${ZTE}.3.101.13.10.1.1`,

  /** Per-ONU columns */
  zxAnGponOnuMacAddr:          `${ZTE}.3.101.13.10.1.1.1.4`,
  zxAnGponOnuAdminState:       `${ZTE}.3.101.13.10.1.1.1.3`,  // 1=enabled 2=disabled
  zxAnGponOnuOperState:        `${ZTE}.3.101.13.10.1.1.1.5`,  // 1=up 2=down

  /** Optical power (ZTE-AN-GPON-MIB optics table) */
  zxAnGponOnuOpticsTable:      `${ZTE}.3.101.13.10.3.1.1`,
  zxAnGponOnuRxPower:          `${ZTE}.3.101.13.10.3.1.1.1.3`,  // units: 0.01 dBm
  zxAnGponOnuTxPower:          `${ZTE}.3.101.13.10.3.1.1.1.4`,  // units: 0.01 dBm

  /** Distance in metres */
  zxAnGponOnuDistance:         `${ZTE}.3.101.13.10.1.1.1.20`,

  /** ONU description / name */
  zxAnGponOnuName:             `${ZTE}.3.101.13.10.1.1.1.2`,
} as const;

// ---------------------------------------------------------------------------
// EPON ONU table (ZTE-AN-EPON-MIB)
// ---------------------------------------------------------------------------

export const ZTE_EPON_OIDs = {
  zxAnEponOnuTable:            `${ZTE}.3.101.7.1.1.1.1`,

  zxAnEponOnuMacAddr:          `${ZTE}.3.101.7.1.1.1.1.1.3`,
  zxAnEponOnuOperState:        `${ZTE}.3.101.7.1.1.1.1.1.7`,  // 1=online 0=offline
  zxAnEponOnuRxPower:          `${ZTE}.3.101.7.1.1.2.1.1.3`,  // 0.01 dBm
  zxAnEponOnuTxPower:          `${ZTE}.3.101.7.1.1.2.1.1.4`,  // 0.01 dBm
} as const;

// ---------------------------------------------------------------------------
// PON port table
// ---------------------------------------------------------------------------

export const ZTE_PON_PORT_OIDs = {
  zxAnPonPortTable:            `${ZTE}.3.101.13.1.1.1`,
  zxAnPonPortAdminState:       `${ZTE}.3.101.13.1.1.1.1.3`,  // READ ONLY: 1=up 2=down
  zxAnPonPortOperState:        `${ZTE}.3.101.13.1.1.1.1.4`,
  zxAnPonPortOnuCount:         `${ZTE}.3.101.13.1.1.1.1.10`,
} as const;

// ---------------------------------------------------------------------------
// Alarm table (ZTE-AN-ALARM-MIB)
// ---------------------------------------------------------------------------

export const ZTE_ALARM_OIDs = {
  zxAnAlarmTable:              `${ZTE}.3.103.3.1.1`,
  zxAnAlarmSeverity:           `${ZTE}.3.103.3.1.1.1.4`,  // 1=crit 2=major 3=minor 4=warn
  zxAnAlarmDescription:        `${ZTE}.3.103.3.1.1.1.7`,
  zxAnAlarmTime:               `${ZTE}.3.103.3.1.1.1.5`,
} as const;

// ---------------------------------------------------------------------------
// ZTE adapter stub
// ---------------------------------------------------------------------------

/**
 * ZteAdapter — extends GenericAdapter with ZTE GPON/EPON proprietary MIBs.
 *
 * TODO (implementation):
 *   1. GET zxAnDevCpuUsage and zxAnDevMemUsage for OLT metrics
 *   2. Walk zxAnDevTempTable and take max temperature reading
 *   3. Detect mode (GPON/EPON) from sysDescr string ("C300" → GPON, "C600" → EPON)
 *   4. Walk zxAnGponOnuTable or zxAnEponOnuTable
 *   5. Parse optical power: rawInt / 100 → dBm (may need sign extension for negatives)
 *   6. Map operState 1 → "Online", 2 → "Offline"
 *   7. Validate OIDs against ZTE MIB release for C300 v4.01.10 or later
 *   8. Note: some C300 firmware versions shift OID subtrees — add model detection
 */
export class ZteAdapter extends GenericAdapter {
  override readonly vendor = "ZTE";

  override async getOltSnapshot(session: ISnmpSession, ip: string): Promise<OltSnapshot> {
    // TODO: get ZTE_DEVICE_OIDs.zxAnDevCpuUsage and zxAnDevMemUsage
    const base = await super.getOltSnapshot(session, ip);
    return base;
  }

  override async getOnuList(session: ISnmpSession): Promise<OnuSnapshot[]> {
    // TODO:
    //   const rawGpon = await session.walk(ZTE_GPON_OIDs.zxAnGponOnuTable);
    //   return parseZteOnuRows(rawGpon);
    return [];
  }

  override async getAlarms(session: ISnmpSession): Promise<SnmpAlarm[]> {
    // TODO: const raw = await session.walk(ZTE_ALARM_OIDs.zxAnAlarmTable);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Parse helpers (stubs)
// ---------------------------------------------------------------------------

/**
 * TODO: Convert raw ZTE GPON ONU table rows into OnuSnapshot[]
 * Key notes:
 *   - Optical power values are signed integers × 100 (e.g. -1850 = -18.50 dBm)
 *   - Row index encodes chassis.slot.port.onuId
 *   - operState 1 = Online, anything else = Offline
 */
function _parseZteOnuRows(_raw: unknown[]): OnuSnapshot[] {
  return []; // TODO
}

function _parseZteAlarms(_raw: unknown[]): SnmpAlarm[] {
  return []; // TODO
}
