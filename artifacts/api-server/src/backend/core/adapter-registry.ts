import type { OltVendor } from "../types/olt.types";
import type { OltNormalized, OltPollRequest } from "../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../types/onu.types";
import type { AlarmNormalized } from "../types/alarm.types";
import type { OnuDiscoveryResult } from "../types/onu-discovery.types";

export interface AdapterCapabilities {
  oltInfo: boolean;
  onuDiscovery: boolean;
  opticalPower: boolean;
  trafficStats: boolean;
  alarmPolling: boolean;
  configRead: boolean;
  configWrite: boolean;
}

export interface VendorAdapter {
  readonly vendor: OltVendor;
  capabilities(): AdapterCapabilities;
  pollOlt(request: OltPollRequest): Promise<OltNormalized>;
  pollOnu(request: OnuPollRequest): Promise<OnuNormalized>;
  pollAlarms(oltRequest: OltPollRequest): Promise<AlarmNormalized[]>;

  /**
   * Discover all ONUs on this OLT using read-only SNMP.
   *
   * Returns counts (total, online, offline), per-PON-port breakdown, and a
   * simplified ONU list (at most 50 entries). Never issues an SNMP SET.
   *
   * Implementations that do not yet have confirmed MIB OIDs should throw
   * with a clear "not yet implemented" message so the API returns a useful error.
   */
  discoverOnus(request: OltPollRequest): Promise<OnuDiscoveryResult>;
}

/**
 * AdapterRegistry — maps vendor names to their adapter implementations.
 *
 * Usage:
 *   const registry = new AdapterRegistry();
 *   registry.register(new HuaweiAdapter());
 *   const adapter = registry.get("huawei");
 */
export class AdapterRegistry {
  private readonly adapters = new Map<OltVendor, VendorAdapter>();

  register(adapter: VendorAdapter): void {
    this.adapters.set(adapter.vendor, adapter);
  }

  get(vendor: OltVendor): VendorAdapter {
    const adapter = this.adapters.get(vendor);
    if (!adapter) {
      throw new Error(
        `No adapter registered for vendor "${vendor}". ` +
        `Registered: [${[...this.adapters.keys()].join(", ")}]`
      );
    }
    return adapter;
  }

  has(vendor: OltVendor): boolean {
    return this.adapters.has(vendor);
  }

  listVendors(): OltVendor[] {
    return [...this.adapters.keys()];
  }

  /** Returns capability matrix for all registered adapters. */
  capabilityMatrix(): Record<string, AdapterCapabilities> {
    const result: Record<string, AdapterCapabilities> = {};
    for (const [vendor, adapter] of this.adapters) {
      result[vendor] = adapter.capabilities();
    }
    return result;
  }
}

/** Singleton registry — import and use across services. */
export const adapterRegistry = new AdapterRegistry();
