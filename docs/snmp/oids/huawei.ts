/**
 * NOCpulse — Huawei OLT SNMP OID Map (Planning Document)
 *
 * PLANNING ONLY — not compiled, not imported by the running app.
 *
 * Target hardware : MA5800-X15, MA5800-X7, MA5600T, MA5680T
 * MIB files       : HUAWEI-GPON-MIB, HUAWEI-EPON-MIB, HUAWEI-OLT-MIB,
 *                   HUAWEI-DEVICE-MIB, HUAWEI-PORT-MIB
 * Enterprise OID  : 1.3.6.1.4.1.2011
 *
 * ⚠ READ ONLY — no SET OIDs are listed here. Any future write OIDs must
 * live in a separate `huawei_write.ts` file behind a feature flag.
 */

import { GenericAdapter } from "./generic";
import type { ISnmpSession, OltSnapshot, OnuSnapshot, SnmpAlarm } from "../ADAPTER_INTERFACE";

// ---------------------------------------------------------------------------
// Huawei enterprise prefix
// ---------------------------------------------------------------------------

const HW = "1.3.6.1.4.1.2011" as const;

// ---------------------------------------------------------------------------
// Device / system OIDs (hwDeviceMIB)
// ---------------------------------------------------------------------------

export const HW_DEVICE_OIDs = {
  /** Board CPU usage table — walk to get all boards */
  hwCpuDevTable:        `${HW}.6.3.9.1.1`,
  hwCpuUsage:           `${HW}.6.3.9.1.1.1.3`,  // % CPU per board

  /** Memory usage table */
  hwMemTable:           `${HW}.6.3.9.1.2`,
  hwMemUsage:           `${HW}.6.3.9.1.2.1.4`,  // % memory per board

  /** Temperature — chassis sensor */
  hwEntityTemperature:  `${HW}.10.2.1.3.1.1.8`,  // degrees C (may vary by model)
} as const;

// ---------------------------------------------------------------------------
// GPON ONU table (HUAWEI-GPON-MIB hwGponDeviceMibObjects)
// ---------------------------------------------------------------------------

export const HW_GPON_OIDs = {
  /** ONU index table root — walk this to enumerate all ONUs */
  hwGponOnuTable:          `${HW}.6.139.9.3.8.100.1.1`,

  /** Per-ONU columns (indexed by frame/slot/port/onuId) */
  hwGponOnuMacAddr:        `${HW}.6.139.9.3.8.100.1.1.1.6`,
  hwGponOnuDescription:    `${HW}.6.139.9.3.8.100.1.1.1.7`,
  hwGponOnuOperState:      `${HW}.6.139.9.3.8.100.1.1.1.24`,  // 1=online 2=offline
  hwGponOnuDistance:       `${HW}.6.139.9.3.8.100.1.1.1.26`,  // metres
  hwGponOnuEquipmentId:    `${HW}.6.139.9.3.8.100.1.1.1.9`,

  /** Optical power — per ONU (hwGponOnuRxOpticalPower) */
  hwGponOnuRxOpticalPower: `${HW}.6.139.9.3.8.100.2.1.1.3`,  // units: 0.01 dBm

  /** TX power from OLT side (hwGponOnuTxOpticalPower) */
  hwGponOnuTxOpticalPower: `${HW}.6.139.9.3.8.100.2.1.1.4`,  // units: 0.01 dBm
} as const;

// ---------------------------------------------------------------------------
// EPON ONU table (HUAWEI-EPON-MIB)
// ---------------------------------------------------------------------------

export const HW_EPON_OIDs = {
  /** EPON ONU index table */
  hwEponOnuTable:          `${HW}.6.139.9.3.3.6.1.1`,

  hwEponOnuMacAddr:        `${HW}.6.139.9.3.3.6.1.1.1.3`,
  hwEponOnuOperState:      `${HW}.6.139.9.3.3.6.1.1.1.11`,  // 1=online 0=offline
  hwEponOnuRxOpticalPower: `${HW}.6.139.9.3.3.6.2.1.1.4`,   // 0.01 dBm
  hwEponOnuTxOpticalPower: `${HW}.6.139.9.3.3.6.2.1.1.5`,   // 0.01 dBm
} as const;

// ---------------------------------------------------------------------------
// PON port table
// ---------------------------------------------------------------------------

export const HW_PON_PORT_OIDs = {
  /** Interface table for PON ports (use standard IF-MIB on top) */
  hwGponIfTable:     `${HW}.6.139.9.3.7.1.1`,
  hwGponPortDescr:   `${HW}.6.139.9.3.7.1.1.1.2`,
  hwGponPortState:   `${HW}.6.139.9.3.7.1.1.1.4`,  // 1=up 2=down
  hwGponOnuCount:    `${HW}.6.139.9.3.7.1.1.1.5`,  // active ONUs on this port
} as const;

// ---------------------------------------------------------------------------
// Alarm table (HUAWEI-ALARM-MIB)
// ---------------------------------------------------------------------------

export const HW_ALARM_OIDs = {
  hwAlarmActiveTable:    `${HW}.2.6.13.1.2.1`,
  hwAlarmActiveSeverity: `${HW}.2.6.13.1.2.1.1.2`,  // 1=crit 2=major 3=minor 4=warning
  hwAlarmActiveDesc:     `${HW}.2.6.13.1.2.1.1.7`,
  hwAlarmActiveTime:     `${HW}.2.6.13.1.2.1.1.3`,
} as const;

// ---------------------------------------------------------------------------
// Huawei adapter stub
// ---------------------------------------------------------------------------

/**
 * HuaweiAdapter — extends GenericAdapter with Huawei GPON/EPON proprietary MIBs.
 *
 * TODO (implementation):
 *   1. Detect GPON vs EPON from sysDescr (or a separate device-type OID)
 *   2. Walk hwGponOnuTable or hwEponOnuTable based on type
 *   3. Parse optical power: divide raw int by 100 to get dBm (signed)
 *   4. Map hwGponOnuOperState 1 → "Online", 2 → "Offline"
 *   5. Parse CPU from hwCpuUsage (max across boards)
 *   6. Parse memory from hwMemUsage (max across boards)
 *   7. Parse temperature from hwEntityTemperature (model-dependent)
 *   8. Confirm OID paths against HUAWEI-GPON-MIB r013 or later
 */
export class HuaweiAdapter extends GenericAdapter {
  override readonly vendor = "Huawei";

  override async getOltSnapshot(session: ISnmpSession, ip: string): Promise<OltSnapshot> {
    // TODO: walk HW_DEVICE_OIDs to get CPU, memory, temperature
    // Merge with base generic snapshot (sysDescr, sysUpTime, etc.)
    const base = await super.getOltSnapshot(session, ip);
    return base; // placeholder — replace with real parse
  }

  override async getOnuList(session: ISnmpSession): Promise<OnuSnapshot[]> {
    // TODO:
    //   const rawGpon = await session.walk(HW_GPON_OIDs.hwGponOnuTable);
    //   const rawEpon = await session.walk(HW_EPON_OIDs.hwEponOnuTable);
    //   return parseHuaweiOnuRows(rawGpon, rawEpon);
    return [];
  }

  override async getAlarms(session: ISnmpSession): Promise<SnmpAlarm[]> {
    // TODO: const raw = await session.walk(HW_ALARM_OIDs.hwAlarmActiveTable);
    //       return parseHuaweiAlarms(raw);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Parse helpers (stubs)
// ---------------------------------------------------------------------------

/**
 * TODO: Convert raw Huawei GPON ONU table rows into OnuSnapshot[]
 * Key conversions:
 *   - operState 1 → "Online", 2 → "Offline"
 *   - optical power: rawInt / 100 → dBm (signed int16, big-endian)
 *   - distance: metres integer → "X.XX km"
 *   - index format: frame.slot.port.onuId → "frame/slot/port:onuId"
 */
function _parseHuaweiOnuRows(_raw: unknown[]): OnuSnapshot[] {
  return []; // TODO
}

/**
 * TODO: Convert raw Huawei alarm table into SnmpAlarm[]
 * Severity map: 1=Critical 2=Major 3=Minor 4=Info
 */
function _parseHuaweiAlarms(_raw: unknown[]): SnmpAlarm[] {
  return []; // TODO
}
