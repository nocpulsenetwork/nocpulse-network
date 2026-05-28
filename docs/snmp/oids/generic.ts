/**
 * NOCpulse — Generic SNMP OID Map (Planning Document)
 *
 * PLANNING ONLY — not compiled, not imported by the running app.
 *
 * These OIDs are standard MIBs defined by IETF RFCs and are vendor-neutral.
 * They form the base class / fallback for all vendor adapters.
 *
 * MIB sources:
 *   - RFC 1213  (MIB-II / SNMPv1)
 *   - RFC 2863  (IF-MIB)
 *   - RFC 2737  (ENTITY-MIB)
 *   - RFC 4133  (ENTITY-MIB v3)
 *   - RFC 3418  (SNMPv2-MIB)
 */

// ---------------------------------------------------------------------------
// SNMPv2-MIB — system group (RFC 3418)
// ---------------------------------------------------------------------------

export const SYSTEM_OIDs = {
  /** Textual description of the entity — vendor/firmware info */
  sysDescr:     "1.3.6.1.2.1.1.1.0",
  /** OID of the object type that best characterises this entity */
  sysObjectID:  "1.3.6.1.2.1.1.2.0",
  /** Time (centiseconds) since last re-initialisation */
  sysUpTime:    "1.3.6.1.2.1.1.3.0",
  /** Contact person for this node */
  sysContact:   "1.3.6.1.2.1.1.4.0",
  /** Admin-assigned name of this node */
  sysName:      "1.3.6.1.2.1.1.5.0",
  /** Physical location of this node */
  sysLocation:  "1.3.6.1.2.1.1.6.0",
} as const;

// ---------------------------------------------------------------------------
// IF-MIB — interfaces table (RFC 2863)
// ---------------------------------------------------------------------------

export const IF_TABLE_OIDs = {
  /** Table of interface entries */
  ifTable:         "1.3.6.1.2.1.2.2",

  /** Per-interface columns */
  ifIndex:         "1.3.6.1.2.1.2.2.1.1",
  ifDescr:         "1.3.6.1.2.1.2.2.1.2",
  ifType:          "1.3.6.1.2.1.2.2.1.3",
  ifSpeed:         "1.3.6.1.2.1.2.2.1.5",
  /** READ ONLY: do not attempt to SET ifAdminStatus */
  ifAdminStatus:   "1.3.6.1.2.1.2.2.1.7",  // 1=up 2=down 3=testing
  ifOperStatus:    "1.3.6.1.2.1.2.2.1.8",  // 1=up 2=down 3=testing
  ifLastChange:    "1.3.6.1.2.1.2.2.1.9",
  ifInOctets:      "1.3.6.1.2.1.2.2.1.10",
  ifOutOctets:     "1.3.6.1.2.1.2.2.1.16",
  ifInErrors:      "1.3.6.1.2.1.2.2.1.14",
  ifOutErrors:     "1.3.6.1.2.1.2.2.1.20",

  /** 64-bit counters (ifXTable, RFC 2863) */
  ifHCInOctets:    "1.3.6.1.2.1.31.1.1.1.6",
  ifHCOutOctets:   "1.3.6.1.2.1.31.1.1.1.10",
  ifAlias:         "1.3.6.1.2.1.31.1.1.1.18",
} as const;

// ---------------------------------------------------------------------------
// ENTITY-MIB — physical components (RFC 4133)
// ---------------------------------------------------------------------------

export const ENTITY_OIDs = {
  entPhysicalTable:       "1.3.6.1.2.1.47.1.1.1",
  entPhysicalDescr:       "1.3.6.1.2.1.47.1.1.1.1.2",
  entPhysicalName:        "1.3.6.1.2.1.47.1.1.1.1.7",
  entPhysicalSoftwareRev: "1.3.6.1.2.1.47.1.1.1.1.10",
  entPhysicalSerialNum:   "1.3.6.1.2.1.47.1.1.1.1.11",
  entPhysicalModelName:   "1.3.6.1.2.1.47.1.1.1.1.13",
} as const;

// ---------------------------------------------------------------------------
// HOST-RESOURCES-MIB — CPU and storage (RFC 2790)
// ---------------------------------------------------------------------------

export const HOST_RESOURCES_OIDs = {
  hrProcessorTable: "1.3.6.1.2.1.25.3.3",
  hrProcessorLoad:  "1.3.6.1.2.1.25.3.3.1.2",  // CPU load % (1 min avg)

  hrStorageTable:   "1.3.6.1.2.1.25.2.3",
  hrStorageDescr:   "1.3.6.1.2.1.25.2.3.1.3",
  hrStorageSize:    "1.3.6.1.2.1.25.2.3.1.5",
  hrStorageUsed:    "1.3.6.1.2.1.25.2.3.1.6",
} as const;

// ---------------------------------------------------------------------------
// Generic adapter stub
// ---------------------------------------------------------------------------

import type {
  ISnmpAdapter, ISnmpSession, OltSnapshot, OnuSnapshot, SnmpAlarm,
} from "../ADAPTER_INTERFACE";

/**
 * GenericAdapter — fallback adapter using only standard MIBs.
 *
 * STUB: parse* methods return zeroed/default values until implemented.
 * Vendor-specific adapters override the OID maps and parse methods.
 *
 * TODO (implementation):
 *   1. Implement parseOltSnapshot() using SYSTEM_OIDs and IF_TABLE_OIDs
 *   2. Implement parseCpuMemory() using HOST_RESOURCES_OIDs
 *   3. Extend per-vendor with proprietary OLT/ONU tables
 */
export class GenericAdapter implements ISnmpAdapter {
  readonly vendor = "Generic";

  async getOltSnapshot(session: ISnmpSession, ip: string): Promise<OltSnapshot> {
    // TODO: call session.get([...Object.values(SYSTEM_OIDs)]) and parse result
    const _raw = await session.get(Object.values(SYSTEM_OIDs));
    return buildDefaultOltSnapshot(ip);
  }

  async getOnuList(_session: ISnmpSession): Promise<OnuSnapshot[]> {
    // Generic MIBs have no standard ONU table — return empty
    // Vendor adapters will override this with proprietary ONU index walks
    return [];
  }

  async getAlarms(_session: ISnmpSession): Promise<SnmpAlarm[]> {
    // TODO: walk alarmActiveTable (ITU-ALARM-MIB, 1.3.6.1.2.1.118.1.2.2)
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Zero-filled OltSnapshot used as default before real parsing is built */
function buildDefaultOltSnapshot(ip: string): OltSnapshot {
  return {
    id: "",
    name: "",
    ip,
    sysDescr: "",
    sysUpTimeSecs: 0,
    cpu: 0,
    memory: 0,
    temperatureCelsius: 0,
    uplinkStatus: "Down",
    uplinkPort: "",
    ponPortCount: 0,
    activeOnus: 0,
    status: "Offline",
    polledAt: new Date().toISOString(),
  };
}

// Re-export types for downstream adapters
export type { OltSnapshot, OnuSnapshot, SnmpAlarm, ISnmpSession };
