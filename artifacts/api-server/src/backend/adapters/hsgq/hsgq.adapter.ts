import type { VendorAdapter, AdapterCapabilities } from "../../core/adapter-registry";
import type { OltNormalized, OltPollRequest } from "../../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../../types/onu.types";
import type { AlarmNormalized } from "../../types/alarm.types";
import type { OnuDiscoveryResult } from "../../types/onu-discovery.types";

/**
 * HSGQ OLT Adapter
 *
 * Supported models: TBD (pending hardware access for MIB validation)
 * Protocol: SNMP v2c
 *
 * TODO:
 *  - Obtain HSGQ MIB files and validate OIDs against production hardware
 *  - Implement OLT system info poll
 *  - Implement ONU discovery
 *  - Implement optical power table poll
 */
export class HsgqAdapter implements VendorAdapter {
  readonly vendor = "hsgq" as const;

  capabilities(): AdapterCapabilities {
    return {
      oltInfo: false,
      onuDiscovery: false,
      opticalPower: false,
      trafficStats: false,
      alarmPolling: false,
      configRead: false,
      configWrite: false,
    };
  }

  async pollOlt(_request: OltPollRequest): Promise<OltNormalized> {
    throw new Error("HsgqAdapter.pollOlt — not yet implemented (pending MIB validation)");
  }

  async pollOnu(_request: OnuPollRequest): Promise<OnuNormalized> {
    throw new Error("HsgqAdapter.pollOnu — not yet implemented (pending MIB validation)");
  }

  async pollAlarms(_oltRequest: OltPollRequest): Promise<AlarmNormalized[]> {
    throw new Error("HsgqAdapter.pollAlarms — not yet implemented (pending MIB validation)");
  }

  async discoverOnus(_request: OltPollRequest): Promise<OnuDiscoveryResult> {
    throw new Error("HsgqAdapter.discoverOnus — not yet implemented (pending MIB validation)");
  }
}
