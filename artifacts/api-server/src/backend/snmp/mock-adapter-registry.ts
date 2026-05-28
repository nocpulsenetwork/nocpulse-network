/**
 * MockAdapterRegistry — maps OLT vendor strings to their mock SNMP adapters.
 *
 * All six vendor adapters are registered at module initialisation time.
 * Callers use get(vendor) to resolve the correct adapter, or getForOlt(oltId)
 * to resolve based on an OLT object's vendor field.
 *
 * Fallback behaviour:
 *   If no adapter is registered for a vendor, get() returns the GenericMockAdapter
 *   rather than throwing. This ensures unknown or future vendors always have a
 *   working (if limited) adapter available.
 *
 * Usage example:
 *   const adapter = mockAdapterRegistry.get("huawei");
 *   await adapter.connect({ host: "192.168.1.1", community: "public" });
 *   try {
 *     const oltInfo  = await adapter.getOltInfo("olt-001");
 *     const onuList  = await adapter.getOnuList("olt-001");
 *     const optical  = await adapter.getOnuOpticalPower("olt-001");
 *     const status   = await adapter.getOnuStatus("olt-001");
 *     const ports    = await adapter.getPonPorts("olt-001");
 *     const alarms   = await adapter.getAlarms("olt-001");
 *   } finally {
 *     adapter.disconnect();
 *   }
 */

import type { Vendor } from "./types";
import type { BaseMockSnmpAdapter } from "./base-mock-adapter";
import { HuaweiMockAdapter } from "./vendors/huawei.mock";
import { ZteMockAdapter }    from "./vendors/zte.mock";
import { BdcomMockAdapter }  from "./vendors/bdcom.mock";
import { VsolMockAdapter }   from "./vendors/vsol.mock";
import { CdataMockAdapter }  from "./vendors/cdata.mock";
import { GenericMockAdapter } from "./vendors/generic.mock";
import { MOCK_OLTS } from "../mock/mock-data";

// ─── Registry class ────────────────────────────────────────────────────────

export class MockAdapterRegistry {
  private readonly adapters = new Map<Vendor, BaseMockSnmpAdapter>();
  private generic: GenericMockAdapter;

  constructor() {
    this.generic = new GenericMockAdapter();
  }

  /**
   * Register a vendor adapter. If an adapter for this vendor is already
   * registered it is silently replaced (allows hot-swap in tests).
   */
  register(adapter: BaseMockSnmpAdapter): void {
    this.adapters.set(adapter.vendor, adapter);
  }

  /**
   * Resolve the mock adapter for the given vendor string.
   * Falls back to GenericMockAdapter for unrecognised vendors.
   */
  get(vendor: Vendor | string): BaseMockSnmpAdapter {
    return this.adapters.get(vendor as Vendor) ?? this.generic;
  }

  /**
   * Resolve the mock adapter for a specific OLT by ID.
   * Looks up the vendor from MOCK_OLTS, then delegates to get(vendor).
   * Returns GenericMockAdapter if the OLT is not found in the mock dataset.
   */
  getForOlt(oltId: string): BaseMockSnmpAdapter {
    const olt = MOCK_OLTS.find((o) => o.id === oltId);
    if (!olt) return this.generic;
    return this.get(olt.vendor);
  }

  /**
   * Returns the list of all registered vendor identifiers, including "generic".
   */
  listVendors(): Vendor[] {
    return [...this.adapters.keys(), "generic" as Vendor];
  }

  /**
   * Returns the capability matrix for every registered adapter.
   * Useful for the /api/polling/status endpoint.
   */
  capabilityMatrix(): Record<string, ReturnType<BaseMockSnmpAdapter["capabilities"]>> {
    const result: Record<string, ReturnType<BaseMockSnmpAdapter["capabilities"]>> = {};
    for (const [vendor, adapter] of this.adapters) {
      result[vendor] = adapter.capabilities();
    }
    result["generic"] = this.generic.capabilities();
    return result;
  }
}

// ─── Singleton instance — pre-populated with all six vendor adapters ────────

export const mockAdapterRegistry = new MockAdapterRegistry();

mockAdapterRegistry.register(new HuaweiMockAdapter());
mockAdapterRegistry.register(new ZteMockAdapter());
mockAdapterRegistry.register(new BdcomMockAdapter());
mockAdapterRegistry.register(new VsolMockAdapter());
mockAdapterRegistry.register(new CdataMockAdapter());
// GenericMockAdapter is the built-in fallback — no need to register explicitly,
// but we register it so it shows up in capabilityMatrix() under "generic".
mockAdapterRegistry.register(new GenericMockAdapter());
