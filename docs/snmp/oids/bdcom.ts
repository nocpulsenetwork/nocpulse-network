/**
 * NOCpulse — BDCOM OLT SNMP OID Map (Planning Document)
 *
 * PLANNING ONLY — not compiled, not imported by the running app.
 *
 * Target hardware : BDCOM P3310C, P3608, P3310B, GP3600
 * MIB files       : BDCOM-EPON-MIB, BDCOM-GPON-MIB, BDCOM-SYSTEM-MIB,
 *                   BDCOM-INTERFACE-MIB
 * Enterprise OID  : 1.3.6.1.4.1.3320
 *
 * ⚠ READ ONLY — no SET OIDs listed. No reboot, no config writes.
 *
 * NOTE: BDCOM MIB documentation is less standardised than Huawei/ZTE.
 * OID paths below are based on community-documented values and may need
 * verification against the specific firmware version in use.
 */

import { GenericAdapter } from "./generic";
import type { ISnmpSession, OltSnapshot, OnuSnapshot, SnmpAlarm } from "../ADAPTER_INTERFACE";

// ---------------------------------------------------------------------------
// BDCOM enterprise prefix
// ---------------------------------------------------------------------------

const BDCOM = "1.3.6.1.4.1.3320" as const;

// ---------------------------------------------------------------------------
// System / device OIDs (BDCOM-SYSTEM-MIB)
// ---------------------------------------------------------------------------

export const BDCOM_SYSTEM_OIDs = {
  /** CPU usage — 1 minute average (%) */
  bdCpuUsage5Sec:  `${BDCOM}.11.2.1.0`,  // 5-second CPU sample
  bdCpuUsage1Min:  `${BDCOM}.11.2.2.0`,  // 1-minute CPU avg
  bdCpuUsage5Min:  `${BDCOM}.11.2.3.0`,  // 5-minute CPU avg (prefer this)

  /** Memory */
  bdMemFree:       `${BDCOM}.11.1.1.0`,  // bytes free
  bdMemUsed:       `${BDCOM}.11.1.2.0`,  // bytes used

  /** Temperature — may not be available on all models */
  bdTemperature:   `${BDCOM}.18.1.0`,    // °C (CHECK against actual MIB)
} as const;

// ---------------------------------------------------------------------------
// EPON ONU table (BDCOM-EPON-MIB)
// ---------------------------------------------------------------------------

export const BDCOM_EPON_OIDs = {
  /** ONU MAC address table root — walk to enumerate all ONUs */
  bdEponOnuTable:         `${BDCOM}.9.1.3.3.1`,

  /** Per-ONU columns */
  bdEponOnuMacAddr:       `${BDCOM}.9.1.3.3.1.1.3`,
  bdEponOnuOperState:     `${BDCOM}.9.1.3.3.1.1.5`,  // 1=online 2=offline
  bdEponOnuDescription:   `${BDCOM}.9.1.3.3.1.1.7`,

  /** Optical power table */
  bdEponOpticsTable:      `${BDCOM}.9.1.3.4.1`,
  bdEponOnuRxPower:       `${BDCOM}.9.1.3.4.1.1.2`,  // 0.1 dBm (CHECK units)
  bdEponOnuTxPower:       `${BDCOM}.9.1.3.4.1.1.3`,  // 0.1 dBm (CHECK units)
} as const;

// ---------------------------------------------------------------------------
// GPON ONU table (BDCOM-GPON-MIB — if applicable)
// ---------------------------------------------------------------------------

export const BDCOM_GPON_OIDs = {
  /** GPON ONU index table root */
  bdGponOnuTable:         `${BDCOM}.9.2.1.1.1`,

  bdGponOnuMacAddr:       `${BDCOM}.9.2.1.1.1.1.4`,
  bdGponOnuOperState:     `${BDCOM}.9.2.1.1.1.1.5`,  // 1=online 0=offline
  bdGponOnuRxPower:       `${BDCOM}.9.2.1.2.1.1.3`,  // 0.01 dBm
  bdGponOnuTxPower:       `${BDCOM}.9.2.1.2.1.1.4`,  // 0.01 dBm
} as const;

// ---------------------------------------------------------------------------
// Alarm table (BDCOM — check availability per model)
// ---------------------------------------------------------------------------

export const BDCOM_ALARM_OIDs = {
  /** No dedicated alarm MIB confirmed for BDCOM — use standard IF-MIB traps */
  bdAlarmTable:           `${BDCOM}.18.10.1`,  // PLACEHOLDER — verify
  bdAlarmSeverity:        `${BDCOM}.18.10.1.1.2`,
  bdAlarmDescription:     `${BDCOM}.18.10.1.1.4`,
} as const;

// ---------------------------------------------------------------------------
// BDCOM adapter stub
// ---------------------------------------------------------------------------

/**
 * BdcomAdapter — extends GenericAdapter with BDCOM EPON/GPON MIBs.
 *
 * TODO (implementation):
 *   1. GET bdCpuUsage5Min for CPU, compute memory % from bdMemFree + bdMemUsed
 *   2. Walk bdEponOnuTable (EPON) or bdGponOnuTable (GPON)
 *   3. Optical power units for EPON may be 0.1 dBm (not 0.01) — VERIFY
 *   4. Check if bdTemperature OID exists for the target model before using it
 *   5. BDCOM MIBs may differ significantly between P3310C and P3608 firmware
 *      — add a model detection step using sysDescr or sysObjectID
 *   6. Consider falling back to standard IF-MIB for port-level stats
 */
export class BdcomAdapter extends GenericAdapter {
  override readonly vendor = "BDCOM";

  override async getOltSnapshot(session: ISnmpSession, ip: string): Promise<OltSnapshot> {
    // TODO: get BDCOM_SYSTEM_OIDs.bdCpuUsage5Min + bdMemFree + bdMemUsed
    const base = await super.getOltSnapshot(session, ip);
    return base;
  }

  override async getOnuList(session: ISnmpSession): Promise<OnuSnapshot[]> {
    // TODO: walk BDCOM_EPON_OIDs.bdEponOnuTable or BDCOM_GPON_OIDs.bdGponOnuTable
    return [];
  }

  override async getAlarms(_session: ISnmpSession): Promise<SnmpAlarm[]> {
    // TODO: BDCOM alarm MIB path needs verification — use standard trap log as fallback
    return [];
  }
}

// ---------------------------------------------------------------------------
// Parse helpers (stubs)
// ---------------------------------------------------------------------------

/**
 * TODO: Convert raw BDCOM EPON/GPON ONU rows into OnuSnapshot[]
 * Key notes:
 *   - Optical power units may differ between EPON (0.1) and GPON (0.01) — check MIB
 *   - operState encoding is model/firmware-dependent — test before assuming 1=online
 *   - BDCOM row indices do not always follow a predictable pattern
 */
function _parseBdcomOnuRows(_raw: unknown[]): OnuSnapshot[] {
  return []; // TODO
}
