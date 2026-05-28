/**
 * NOCpulse — Mock SNMP Adapter Layer
 *
 * Public barrel export for the mock SNMP adapter package.
 *
 * ─── What this module provides ───────────────────────────────────────────
 *
 *   mockAdapterRegistry   — Singleton registry with all 6 vendor adapters
 *                           pre-registered. Import and call get(vendor) or
 *                           getForOlt(oltId) to resolve the right adapter.
 *
 *   BaseMockSnmpAdapter   — Abstract base class. Extend to create new vendor
 *                           adapters or to write tests.
 *
 *   MockSnmpSession       — Simulated SNMP session (no real network I/O).
 *                           Can be instantiated directly for unit testing.
 *
 *   View types:
 *     OnuOpticalPower     — Returned by adapter.getOnuOpticalPower()
 *     OnuStatusView       — Returned by adapter.getOnuStatus()
 *
 *   Error types:
 *     OltNotFoundError    — Thrown when an OLT ID is not in the mock dataset.
 *     UnsupportedOperationError — Documenting the write-operation guard.
 *
 * ─── Read-only contract ───────────────────────────────────────────────────
 *
 *   Every adapter in this package is read-only. Write operations (reboot,
 *   disable, config push, SNMP SET) are structurally absent from the API.
 *   Adding them requires a separate write-capable adapter with safety review.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────
 *
 *   import { mockAdapterRegistry } from "@/backend/snmp";
 *
 *   const adapter = mockAdapterRegistry.get("huawei");
 *   await adapter.connect({ host: "192.168.1.1" });
 *   try {
 *     const olt    = await adapter.getOltInfo("olt-001");
 *     const ports  = await adapter.getPonPorts("olt-001");
 *     const onus   = await adapter.getOnuList("olt-001");
 *     const optics = await adapter.getOnuOpticalPower("olt-001");
 *     const status = await adapter.getOnuStatus("olt-001");
 *     const alarms = await adapter.getAlarms("olt-001");
 *   } finally {
 *     adapter.disconnect();
 *   }
 */

// Registry
export { mockAdapterRegistry, MockAdapterRegistry } from "./mock-adapter-registry";

// Base class (for extending and testing)
export { BaseMockSnmpAdapter }  from "./base-mock-adapter";
export type { MockAdapterCapabilities } from "./base-mock-adapter";

// Session (for low-level testing)
export { MockSnmpSession, simulatedDelay } from "./mock-snmp-session";
export type { ISnmpSession, RawOidEntry }  from "./mock-snmp-session";

// Vendor adapters (exported individually for direct use or testing)
export { HuaweiMockAdapter }  from "./vendors/huawei.mock";
export { ZteMockAdapter }     from "./vendors/zte.mock";
export { BdcomMockAdapter }   from "./vendors/bdcom.mock";
export { VsolMockAdapter }    from "./vendors/vsol.mock";
export { CdataMockAdapter }   from "./vendors/cdata.mock";
export { GenericMockAdapter } from "./vendors/generic.mock";

// Shared types and errors
export type {
  OnuOpticalPower,
  OnuStatusView,
  MockSnmpConnectConfig,
  UniversalOLT,
  UniversalONU,
  UniversalAlarm,
  PonPort,
  Vendor,
  DeviceStatus,
} from "./types";
export { OltNotFoundError, UnsupportedOperationError } from "./types";
