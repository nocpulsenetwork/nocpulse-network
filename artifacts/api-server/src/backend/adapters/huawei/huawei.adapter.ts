import type { VendorAdapter, AdapterCapabilities } from "../../core/adapter-registry";
import type { OltNormalized, OltPollRequest } from "../../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../../types/onu.types";
import type { AlarmNormalized } from "../../types/alarm.types";

/**
 * Huawei OLT Adapter
 *
 * Supported models: MA5800 series, MA5600T, MA5683T
 * Protocol: SNMP v2c/v3 + SSH CLI (future)
 * MIB: HUAWEI-XPON-MIB, HUAWEI-GPON-MIB
 *
 * TODO:
 *  - Implement SNMP walk for huawei OLT table (hwGponOltTable)
 *  - Implement ONU discovery via hwGponDeviceONUTable
 *  - Implement optical power via hwGponONURxOpticalPower
 *  - Implement alarm trap handling (hwGponDeviceONULOS, hwGponDeviceONUDying)
 */
export class HuaweiAdapter implements VendorAdapter {
  readonly vendor = "huawei" as const;

  capabilities(): AdapterCapabilities {
    return {
      oltInfo: true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: true,
      alarmPolling: true,
      configRead: false,  // SSH CLI not yet implemented
      configWrite: false,
    };
  }

  async pollOlt(_request: OltPollRequest): Promise<OltNormalized> {
    // TODO: SNMP walk hwGponOltTable / hwMPUInfoTable
    throw new Error("HuaweiAdapter.pollOlt — not yet implemented");
  }

  async pollOnu(_request: OnuPollRequest): Promise<OnuNormalized> {
    // TODO: SNMP walk hwGponDeviceONUTable, hwGponONUOpticalInfoTable
    throw new Error("HuaweiAdapter.pollOnu — not yet implemented");
  }

  async pollAlarms(_oltRequest: OltPollRequest): Promise<AlarmNormalized[]> {
    // TODO: SNMP walk hwGponAlarmTable, trap listener
    throw new Error("HuaweiAdapter.pollAlarms — not yet implemented");
  }
}
