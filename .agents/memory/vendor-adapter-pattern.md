---
name: Vendor adapter pattern
description: VendorAdapter interface shape and which adapters are implemented vs stubs
---

## Rule
`VendorAdapter` interface (in `core/adapter-registry.ts`) requires: `pollOlt`, `pollOnu`, `pollAlarms`, `discoverOnus`. All methods return Promises and throw "not yet implemented" if not ready.

**Why:** Uniform interface lets the router call any vendor without branching. Unimplemented methods throw explicitly — never silently succeed with wrong data.

**How to apply:**
- CDATA: `discoverOnus()` is fully implemented via `RealSnmpClient.readOnuTable("CDATA", 50)`.
- Huawei, ZTE, BDCOM, VSOL: all methods throw "not yet implemented".
- Generic: `discoverOnus()` throws with a specific message that ONU discovery requires vendor MIB.
- ECOM, HSGQ: new placeholders, all methods throw "pending MIB validation".
- `OltVendor` union type includes: "huawei" | "zte" | "bdcom" | "vsol" | "cdata" | "ecom" | "hsgq" | "generic".
- The `adapterRegistry` singleton exists but is NOT yet populated. The discover-onus endpoint calls `RealSnmpClient` directly (same as test-onu-list).
