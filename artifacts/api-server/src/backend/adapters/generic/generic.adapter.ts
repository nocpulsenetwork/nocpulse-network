import type { VendorAdapter, AdapterCapabilities } from "../../core/adapter-registry";
import type { OltNormalized, OltPollRequest } from "../../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../../types/onu.types";
import type { AlarmNormalized } from "../../types/alarm.types";
import type { OnuDiscoveryResult } from "../../types/onu-discovery.types";

/**
 * Generic OLT Adapter — RFC-compliant SNMP fallback
 *
 * Used when no vendor-specific adapter matches.
 * Relies on standard RFC MIBs only:
 *   - IF-MIB (ifTable, ifXTable)
 *   - ENTITY-MIB (entPhysicalTable)
 *   - BRIDGE-MIB (dot1dBridge)
 *   - RFC 2674 (Q-BRIDGE-MIB)
 *
 * Limitations:
 *  - No ONU-specific optical data (vendor MIB required)
 *  - No ONU registration/auth info (vendor MIB required)
 *  - Alarm detection limited to link-down traps
 *  - ONU discovery not possible without vendor MIB
 *
 * TODO:
 *  - Implement IF-MIB walk for port stats
 *  - Implement ENTITY-MIB walk for hardware inventory
 *  - Implement link-down trap listener
 */
export class GenericAdapter implements VendorAdapter {
  readonly vendor = "generic" as const;

  capabilities(): AdapterCapabilities {
    return {
      oltInfo:      true,
      onuDiscovery: false,
      opticalPower: false,
      trafficStats: true,
      alarmPolling: false,
      configRead:   false,
      configWrite:  false,
    };
  }

  async pollOlt(_request: OltPollRequest): Promise<OltNormalized> {
    throw new Error("GenericAdapter.pollOlt — not yet implemented");
  }

  async pollOnu(_request: OnuPollRequest): Promise<OnuNormalized> {
    throw new Error("GenericAdapter.pollOnu — not supported without vendor MIB");
  }

  async pollAlarms(_oltRequest: OltPollRequest): Promise<AlarmNormalized[]> {
    throw new Error("GenericAdapter.pollAlarms — not yet implemented");
  }

  async discoverOnus(_request: OltPollRequest): Promise<OnuDiscoveryResult> {
    // ONU discovery requires a vendor-specific GPON/EPON MIB.
    // The generic adapter only uses standard RFC MIBs and cannot discover ONUs.
    throw new Error(
      "GenericAdapter.discoverOnus — not supported. " +
      "ONU discovery requires a vendor-specific GPON/EPON MIB. " +
      "Use a vendor-specific adapter (CDATA, Huawei, ZTE, BDCOM, VSOL)."
    );
  }
}
