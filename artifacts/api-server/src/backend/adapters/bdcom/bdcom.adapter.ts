import type { VendorAdapter, AdapterCapabilities } from "../../core/adapter-registry";
import type { OltNormalized, OltPollRequest } from "../../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../../types/onu.types";
import type { AlarmNormalized } from "../../types/alarm.types";

/**
 * BDCOM OLT Adapter
 *
 * Supported models: P3310C, P3608, P3310B, GP3600
 * Protocol: SNMP v2c
 * MIB: BDCOM-GPON-MIB
 *
 * TODO:
 *  - Implement SNMP walk for BDCOM OLT system info
 *  - Implement ONU registration table poll
 *  - Implement optical power table (bdcomGponOnuOptical)
 *  - Implement alarm/event poll via SNMP trap or table walk
 */
export class BdcomAdapter implements VendorAdapter {
  readonly vendor = "bdcom" as const;

  capabilities(): AdapterCapabilities {
    return {
      oltInfo: true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: false, // limited on most BDCOM models via SNMP
      alarmPolling: true,
      configRead: false,
      configWrite: false,
    };
  }

  async pollOlt(_request: OltPollRequest): Promise<OltNormalized> {
    // TODO: SNMP walk BDCOM-GPON-MIB OLT info tables
    throw new Error("BdcomAdapter.pollOlt — not yet implemented");
  }

  async pollOnu(_request: OnuPollRequest): Promise<OnuNormalized> {
    // TODO: SNMP walk bdcomGponOnuInfoTable, bdcomGponOnuOptical
    throw new Error("BdcomAdapter.pollOnu — not yet implemented");
  }

  async pollAlarms(_oltRequest: OltPollRequest): Promise<AlarmNormalized[]> {
    // TODO: SNMP trap receiver + event table walk
    throw new Error("BdcomAdapter.pollAlarms — not yet implemented");
  }
}
