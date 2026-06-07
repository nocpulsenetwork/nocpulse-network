import type { VendorAdapter, AdapterCapabilities } from "../../core/adapter-registry";
import type { OltNormalized, OltPollRequest } from "../../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../../types/onu.types";
import type { AlarmNormalized } from "../../types/alarm.types";
import type { OnuDiscoveryResult } from "../../types/onu-discovery.types";

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
      oltInfo:      true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: false,
      alarmPolling: true,
      configRead:   false,
      configWrite:  false,
    };
  }

  async pollOlt(_request: OltPollRequest): Promise<OltNormalized> {
    throw new Error("BdcomAdapter.pollOlt — not yet implemented");
  }

  async pollOnu(_request: OnuPollRequest): Promise<OnuNormalized> {
    throw new Error("BdcomAdapter.pollOnu — not yet implemented");
  }

  async pollAlarms(_oltRequest: OltPollRequest): Promise<AlarmNormalized[]> {
    throw new Error("BdcomAdapter.pollAlarms — not yet implemented");
  }

  async discoverOnus(_request: OltPollRequest): Promise<OnuDiscoveryResult> {
    // TODO: walk bdcomGponOnuTable once OIDs are confirmed on target hardware
    throw new Error("BdcomAdapter.discoverOnus — not yet implemented");
  }
}
