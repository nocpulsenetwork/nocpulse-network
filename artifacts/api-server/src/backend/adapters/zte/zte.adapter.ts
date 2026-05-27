import type { VendorAdapter, AdapterCapabilities } from "../../core/adapter-registry";
import type { OltNormalized, OltPollRequest } from "../../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../../types/onu.types";
import type { AlarmNormalized } from "../../types/alarm.types";

/**
 * ZTE OLT Adapter
 *
 * Supported models: C300, C320, C600, C650
 * Protocol: SNMP v2c/v3 + NETCONF (future)
 * MIB: ZTE-AN-GPON-MIB, ZTE-AN-EPON-MIB
 *
 * TODO:
 *  - Implement SNMP walk for ZTE OLT base info (zxAnGponOltEntry)
 *  - Implement ONU table poll (zxAnGponOnuInfoEntry)
 *  - Implement optical RX/TX (zxAnGponOnuOpticalEntry)
 *  - Implement ZTE alarm event table (zxAnAlarmTable)
 */
export class ZteAdapter implements VendorAdapter {
  readonly vendor = "zte" as const;

  capabilities(): AdapterCapabilities {
    return {
      oltInfo: true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: true,
      alarmPolling: true,
      configRead: false,
      configWrite: false,
    };
  }

  async pollOlt(_request: OltPollRequest): Promise<OltNormalized> {
    // TODO: SNMP walk zxAnGponOltEntry
    throw new Error("ZteAdapter.pollOlt — not yet implemented");
  }

  async pollOnu(_request: OnuPollRequest): Promise<OnuNormalized> {
    // TODO: SNMP walk zxAnGponOnuInfoEntry, zxAnGponOnuOpticalEntry
    throw new Error("ZteAdapter.pollOnu — not yet implemented");
  }

  async pollAlarms(_oltRequest: OltPollRequest): Promise<AlarmNormalized[]> {
    // TODO: SNMP walk zxAnAlarmTable
    throw new Error("ZteAdapter.pollAlarms — not yet implemented");
  }
}
