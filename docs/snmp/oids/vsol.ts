/**
 * NOCpulse — VSOL OLT SNMP OID Map (Planning Document)
 *
 * PLANNING ONLY — not compiled, not imported by the running app.
 *
 * Target hardware : VSOL V1600G4, V2801F, V2802RH, V2804RGW
 * MIB files       : Limited public MIB documentation; mostly standard MIBs
 *                   supplemented by community-contributed OID tables.
 * Enterprise OID  : 1.3.6.1.4.1.37950 (tentative — verify against sysObjectID)
 *
 * ⚠ READ ONLY — no SET OIDs listed. No reboot, no config writes.
 *
 * NOTE: VSOL has minimal public SNMP documentation. All OIDs below are
 * TENTATIVE and must be confirmed against a live device before use.
 * Fall back to GenericAdapter (standard MIBs) if proprietary OIDs fail.
 */

import { GenericAdapter } from "./generic";
import type { ISnmpSession, OltSnapshot, OnuSnapshot, SnmpAlarm } from "../ADAPTER_INTERFACE";

// ---------------------------------------------------------------------------
// VSOL enterprise prefix (tentative)
// ---------------------------------------------------------------------------

const VSOL = "1.3.6.1.4.1.37950" as const;  // VERIFY with sysObjectID on live device

// ---------------------------------------------------------------------------
// System OIDs
// ---------------------------------------------------------------------------

export const VSOL_SYSTEM_OIDs = {
  /**
   * VSOL devices typically respond to standard SNMPv2-MIB system group.
   * Proprietary CPU/memory OIDs are unconfirmed — use HOST-RESOURCES-MIB instead.
   */
  vsolCpuUsage:     `${VSOL}.1.1.1.0`,   // TENTATIVE — verify
  vsolMemUsage:     `${VSOL}.1.1.2.0`,   // TENTATIVE — verify
  vsolTemperature:  `${VSOL}.1.1.3.0`,   // TENTATIVE — verify
} as const;

// ---------------------------------------------------------------------------
// GPON ONU table (TENTATIVE — community-sourced)
// ---------------------------------------------------------------------------

export const VSOL_GPON_OIDs = {
  /**
   * VSOL GPON ONU table.
   * WARNING: These OID paths are unverified. They are placeholders based on
   * community forum reports and must be tested against a real VSOL device.
   */
  vsolGponOnuTable:       `${VSOL}.2.1.1.1`,   // TENTATIVE

  vsolGponOnuMacAddr:     `${VSOL}.2.1.1.1.1.3`, // TENTATIVE
  vsolGponOnuOperState:   `${VSOL}.2.1.1.1.1.4`, // TENTATIVE: 1=online 2=offline
  vsolGponOnuRxPower:     `${VSOL}.2.1.2.1.1.2`, // TENTATIVE: units unknown
  vsolGponOnuTxPower:     `${VSOL}.2.1.2.1.1.3`, // TENTATIVE: units unknown
  vsolGponOnuDistance:    `${VSOL}.2.1.1.1.1.8`, // TENTATIVE: metres
} as const;

// ---------------------------------------------------------------------------
// VSOL adapter stub
// ---------------------------------------------------------------------------

/**
 * VsolAdapter — extends GenericAdapter. Most logic falls through to standard MIBs.
 *
 * TODO (implementation):
 *   1. Issue a sysObjectID GET first to confirm enterprise OID = 37950
 *   2. Attempt proprietary OIDs in vsolGponOnuTable with a try/catch
 *   3. If proprietary walk returns no results, log a warning and return []
 *   4. For CPU/memory, fall back to HOST-RESOURCES-MIB (hrProcessorLoad, hrStorageUsed)
 *   5. Document actual OID paths after testing against a real VSOL V1600G4
 *   6. Consider contacting VSOL support for official MIB download (vsol.com.cn)
 *
 * FALLBACK STRATEGY:
 *   If VSOL SNMP responses are empty or error, use GenericAdapter entirely.
 *   VSOL ONU list may only be obtainable via CLI/Telnet for some firmware versions.
 */
export class VsolAdapter extends GenericAdapter {
  override readonly vendor = "VSOL";

  override async getOltSnapshot(session: ISnmpSession, ip: string): Promise<OltSnapshot> {
    // Falls through to standard MIBs for now
    // TODO: try VSOL_SYSTEM_OIDs — catch timeout and fall back
    return super.getOltSnapshot(session, ip);
  }

  override async getOnuList(session: ISnmpSession): Promise<OnuSnapshot[]> {
    // TODO:
    //   try {
    //     const raw = await session.walk(VSOL_GPON_OIDs.vsolGponOnuTable);
    //     if (raw.length === 0) return []; // no SNMP ONU table — needs CLI fallback
    //     return parseVsolOnuRows(raw);
    //   } catch {
    //     return [];
    //   }
    return [];
  }

  override async getAlarms(_session: ISnmpSession): Promise<SnmpAlarm[]> {
    // VSOL alarm MIB: unknown. Fall back to standard RFC 3877 alarmActiveMIB if needed.
    return [];
  }
}

// ---------------------------------------------------------------------------
// Parse helpers (stubs)
// ---------------------------------------------------------------------------

/**
 * TODO: Parse raw VSOL ONU table rows — OID structure and value encoding
 * must be confirmed against a real device before this can be implemented.
 *
 * Until confirmed:
 *   - Do not assume 0.01 dBm optical power units (VSOL may use different scale)
 *   - Do not assume operState encoding matches Huawei (1=online)
 */
function _parseVsolOnuRows(_raw: unknown[]): OnuSnapshot[] {
  return []; // TODO — needs live device validation first
}
