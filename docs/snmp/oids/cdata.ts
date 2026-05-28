/**
 * NOCpulse — CDATA OLT SNMP OID Map (Planning Document)
 *
 * PLANNING ONLY — not compiled, not imported by the running app.
 *
 * Target hardware : CDATA FD1616GS, FD8920, FD1204SN, FD7920E
 * MIB files       : CDATA-GPON-MIB, CDATA-EPON-MIB, CDATA-SYSTEM-MIB
 * Enterprise OID  : 1.3.6.1.4.1.34592
 *
 * ⚠ READ ONLY — no SET OIDs listed. No reboot, no config writes.
 *
 * NOTE: CDATA (also known as FiberDesk / C-Data) provides MIB files with their
 * device firmware. OIDs below are based on publicly available CDATA MIBs and
 * community documentation. Verify against your specific firmware version.
 */

import { GenericAdapter } from "./generic";
import type { ISnmpSession, OltSnapshot, OnuSnapshot, SnmpAlarm } from "../ADAPTER_INTERFACE";

// ---------------------------------------------------------------------------
// CDATA enterprise prefix
// ---------------------------------------------------------------------------

const CDATA = "1.3.6.1.4.1.34592" as const;

// ---------------------------------------------------------------------------
// System OIDs (CDATA-SYSTEM-MIB)
// ---------------------------------------------------------------------------

export const CDATA_SYSTEM_OIDs = {
  /** CPU usage — percent */
  cdataCpuUsage:       `${CDATA}.1.2.1.1.4.0`,  // primary board CPU %

  /** Memory — total and used (bytes) */
  cdataMemTotal:       `${CDATA}.1.2.1.1.5.0`,
  cdataMemUsed:        `${CDATA}.1.2.1.1.6.0`,

  /** Temperature (°C) — main chassis */
  cdataTemperature:    `${CDATA}.1.2.1.1.7.0`,

  /** Uptime (seconds) — supplement sysUpTime */
  cdataDeviceUptime:   `${CDATA}.1.2.1.1.2.0`,

  /** Software version */
  cdataSoftwareVer:    `${CDATA}.1.2.1.1.3.0`,
} as const;

// ---------------------------------------------------------------------------
// GPON ONU table (CDATA-GPON-MIB)
// ---------------------------------------------------------------------------

export const CDATA_GPON_OIDs = {
  /** ONU configuration table — walk to enumerate all GPON ONUs */
  cdataGponOnuTable:          `${CDATA}.5.1.3.1`,

  /** Per-ONU columns (indexed by slot.port.onuId) */
  cdataGponOnuMacAddr:        `${CDATA}.5.1.3.1.1.4`,
  cdataGponOnuAdminState:     `${CDATA}.5.1.3.1.1.3`,  // READ ONLY: 1=enable 2=disable
  cdataGponOnuOperState:      `${CDATA}.5.1.3.1.1.5`,  // 1=online 2=offline
  cdataGponOnuDescription:    `${CDATA}.5.1.3.1.1.7`,
  cdataGponOnuDistance:       `${CDATA}.5.1.3.1.1.22`, // metres

  /** Optical power table (CDATA-GPON-MIB optics subtable) */
  cdataGponOpticsTable:       `${CDATA}.5.1.4.1`,
  cdataGponOnuRxPower:        `${CDATA}.5.1.4.1.1.3`,  // units: 0.01 dBm (signed)
  cdataGponOnuTxPower:        `${CDATA}.5.1.4.1.1.4`,  // units: 0.01 dBm (signed)
} as const;

// ---------------------------------------------------------------------------
// EPON ONU table (CDATA-EPON-MIB)
// ---------------------------------------------------------------------------

export const CDATA_EPON_OIDs = {
  cdataEponOnuTable:          `${CDATA}.4.1.3.1`,

  cdataEponOnuMacAddr:        `${CDATA}.4.1.3.1.1.3`,
  cdataEponOnuOperState:      `${CDATA}.4.1.3.1.1.5`,  // 1=online 0=offline
  cdataEponOnuRxPower:        `${CDATA}.4.1.4.1.1.3`,  // 0.1 dBm (EPON often 0.1 scale)
  cdataEponOnuTxPower:        `${CDATA}.4.1.4.1.1.4`,  // 0.1 dBm
} as const;

// ---------------------------------------------------------------------------
// PON port table
// ---------------------------------------------------------------------------

export const CDATA_PON_PORT_OIDs = {
  cdataPonPortTable:          `${CDATA}.5.1.1.1`,
  cdataPonPortOperState:      `${CDATA}.5.1.1.1.1.4`,  // 1=up 2=down
  cdataPonPortOnuCount:       `${CDATA}.5.1.1.1.1.7`,  // active ONU count
} as const;

// ---------------------------------------------------------------------------
// Alarm table (CDATA — use syslog or trap receiver if MIB not available)
// ---------------------------------------------------------------------------

export const CDATA_ALARM_OIDs = {
  cdataAlarmTable:            `${CDATA}.1.4.1.1`,  // CHECK per firmware
  cdataAlarmSeverity:         `${CDATA}.1.4.1.1.1.3`,
  cdataAlarmDescription:      `${CDATA}.1.4.1.1.1.5`,
  cdataAlarmRaisedTime:       `${CDATA}.1.4.1.1.1.6`,
} as const;

// ---------------------------------------------------------------------------
// CDATA adapter stub
// ---------------------------------------------------------------------------

/**
 * CdataAdapter — extends GenericAdapter with CDATA GPON/EPON proprietary MIBs.
 *
 * TODO (implementation):
 *   1. GET cdataCpuUsage, cdataMemTotal, cdataMemUsed → compute memory %
 *   2. GET cdataTemperature (fallback to 0 if OID absent on older models)
 *   3. Walk cdataGponOnuTable or cdataEponOnuTable based on device type
 *   4. GPON optical: divide raw by 100 for dBm; EPON: divide by 10 — VERIFY per model
 *   5. Fetch CDATA MIB bundle from device HTTP UI (/mib/) if available
 *   6. FD8920 and FD1616GS have different ONU table depths — test both
 *   7. CDATA FD7920E may use a different enterprise OID subtree — CHECK sysObjectID
 */
export class CdataAdapter extends GenericAdapter {
  override readonly vendor = "CDATA";

  override async getOltSnapshot(session: ISnmpSession, ip: string): Promise<OltSnapshot> {
    // TODO: get CDATA_SYSTEM_OIDs.cdataCpuUsage + memory + temperature
    const base = await super.getOltSnapshot(session, ip);
    return base;
  }

  override async getOnuList(session: ISnmpSession): Promise<OnuSnapshot[]> {
    // TODO:
    //   const rawGpon = await session.walk(CDATA_GPON_OIDs.cdataGponOnuTable);
    //   return parseCdataOnuRows(rawGpon);
    return [];
  }

  override async getAlarms(session: ISnmpSession): Promise<SnmpAlarm[]> {
    // TODO: const raw = await session.walk(CDATA_ALARM_OIDs.cdataAlarmTable);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Parse helpers (stubs)
// ---------------------------------------------------------------------------

/**
 * TODO: Convert raw CDATA GPON ONU rows into OnuSnapshot[]
 * Key notes:
 *   - GPON optical: raw / 100 → dBm (e.g. -1842 → -18.42 dBm)
 *   - EPON optical: raw / 10 → dBm (e.g. -185 → -18.5 dBm)
 *   - operState: 1 = Online, 2 = Offline (GPON); 1 = Online, 0 = Offline (EPON)
 *   - Row index encodes slot.port.onuId (GPON) or port.onuId (EPON)
 */
function _parseCdataOnuRows(_raw: unknown[]): OnuSnapshot[] {
  return []; // TODO
}

function _parseCdataAlarms(_raw: unknown[]): SnmpAlarm[] {
  return []; // TODO
}
