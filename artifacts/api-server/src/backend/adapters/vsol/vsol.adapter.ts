import type { VendorAdapter, AdapterCapabilities } from "../../core/adapter-registry";
import type { OltNormalized, OltPollRequest } from "../../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../../types/onu.types";
import type { AlarmNormalized } from "../../types/alarm.types";

/**
 * VSOL OLT Adapter
 *
 * Supported models: V1600G, V1600D, V1600G4, V1600G8
 * Protocol: SNMP v2c + HTTP API (future)
 * MIB: VSOL-GPON-MIB
 *
 * Note: VSOL firmware varies significantly between hardware revisions.
 * MIB OIDs may differ — always validate against the target firmware version.
 *
 * TODO:
 *  - Implement SNMP walk for VSOL OLT system MIB
 *  - Implement ONU list poll (vsolGponOnuTable)
 *  - Implement optical power readings
 *  - Implement HTTP REST API polling (newer V1600G4/G8 models)
 */
export class VsolAdapter implements VendorAdapter {
  readonly vendor = "vsol" as const;

  capabilities(): AdapterCapabilities {
    return {
      oltInfo: true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: false,
      alarmPolling: false, // trap-based only; REST planned
      configRead: false,
      configWrite: false,
    };
  }

  async pollOlt(_request: OltPollRequest): Promise<OltNormalized> {
    // TODO: SNMP walk VSOL-GPON-MIB system table
    throw new Error("VsolAdapter.pollOlt — not yet implemented");
  }

  async pollOnu(_request: OnuPollRequest): Promise<OnuNormalized> {
    // TODO: SNMP walk vsolGponOnuTable + optical table
    throw new Error("VsolAdapter.pollOnu — not yet implemented");
  }

  async pollAlarms(_oltRequest: OltPollRequest): Promise<AlarmNormalized[]> {
    // TODO: SNMP trap listener (vsolGponOnuLOSAlarm, etc.)
    throw new Error("VsolAdapter.pollAlarms — not yet implemented");
  }
}
