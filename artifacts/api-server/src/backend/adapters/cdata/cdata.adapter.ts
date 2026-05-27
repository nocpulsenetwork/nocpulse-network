import type { VendorAdapter, AdapterCapabilities } from "../../core/adapter-registry";
import type { OltNormalized, OltPollRequest } from "../../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../../types/onu.types";
import type { AlarmNormalized } from "../../types/alarm.types";

/**
 * C-DATA OLT Adapter
 *
 * Supported models: FD1616GS, FD8920, FD1104S, FD1204S
 * Protocol: SNMP v2c
 * MIB: CDATA-GPON-MIB, CDATA-EPON-MIB
 *
 * TODO:
 *  - Implement SNMP walk for C-DATA OLT system info table
 *  - Implement ONU registration + status (cdataGponOnuInfoEntry)
 *  - Implement optical power (cdataGponOnuOpticalEntry)
 *  - Implement alarm event table poll
 */
export class CdataAdapter implements VendorAdapter {
  readonly vendor = "cdata" as const;

  capabilities(): AdapterCapabilities {
    return {
      oltInfo: true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: false,
      alarmPolling: true,
      configRead: false,
      configWrite: false,
    };
  }

  async pollOlt(_request: OltPollRequest): Promise<OltNormalized> {
    // TODO: SNMP walk CDATA-GPON-MIB system table
    throw new Error("CdataAdapter.pollOlt — not yet implemented");
  }

  async pollOnu(_request: OnuPollRequest): Promise<OnuNormalized> {
    // TODO: SNMP walk cdataGponOnuInfoEntry, cdataGponOnuOpticalEntry
    throw new Error("CdataAdapter.pollOnu — not yet implemented");
  }

  async pollAlarms(_oltRequest: OltPollRequest): Promise<AlarmNormalized[]> {
    // TODO: SNMP walk cdataAlarmTable
    throw new Error("CdataAdapter.pollAlarms — not yet implemented");
  }
}
