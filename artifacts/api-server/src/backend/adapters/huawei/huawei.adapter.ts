import type { VendorAdapter, AdapterCapabilities } from "../../core/adapter-registry";
import type { OltNormalized, OltPollRequest } from "../../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../../types/onu.types";
import type { AlarmNormalized } from "../../types/alarm.types";
import type { OnuDiscoveryResult } from "../../types/onu-discovery.types";

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
      oltInfo:      true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: true,
      alarmPolling: true,
      configRead:   false,
      configWrite:  false,
    };
  }

  async pollOlt(_request: OltPollRequest): Promise<OltNormalized> {
    throw new Error("HuaweiAdapter.pollOlt — not yet implemented");
  }

  async pollOnu(_request: OnuPollRequest): Promise<OnuNormalized> {
    throw new Error("HuaweiAdapter.pollOnu — not yet implemented");
  }

  async pollAlarms(_oltRequest: OltPollRequest): Promise<AlarmNormalized[]> {
    throw new Error("HuaweiAdapter.pollAlarms — not yet implemented");
  }

  async discoverOnus(_request: OltPollRequest): Promise<OnuDiscoveryResult> {
    // TODO: walk hwGponDeviceONUTable (1.3.6.1.4.1.2011.6.128.1.1.2.43.1)
    throw new Error("HuaweiAdapter.discoverOnus — not yet implemented");
  }
}
