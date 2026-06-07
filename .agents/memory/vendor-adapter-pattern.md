---
name: Vendor adapter pattern
description: VendorAdapter interface shape and which adapters are implemented vs stubs
---

## Rule
`VendorAdapter` interface (in `core/adapter-registry.ts`) requires: `pollOlt`, `pollOnu`, `pollAlarms`, `discoverOnus`. All methods return Promises and throw "not yet implemented" if not ready.

**Why:** Uniform interface lets the router call any vendor without branching. Unimplemented methods throw explicitly — never silently succeed with wrong data.

**How to apply:**
- CDATA: `discoverOnus()` detects PON type (EPON/GPON) from sysDescr first, then reads the correct MIB table. Do NOT assume GPON for all C-DATA devices.
- Huawei, ZTE, BDCOM, VSOL: all methods throw "not yet implemented".
- Generic: `discoverOnus()` throws with a specific message that ONU discovery requires vendor MIB.
- ECOM, HSGQ: new placeholders, all methods throw "pending MIB validation".
- `OltVendor` union type includes: "huawei" | "zte" | "bdcom" | "vsol" | "cdata" | "ecom" | "hsgq" | "generic".
- The `adapterRegistry` singleton exists but is NOT yet populated. The discover-onus endpoint calls the adapter directly.

## C-DATA PON type dispatch (critical)

C-DATA makes both EPON and GPON OLTs on the same enterprise OID (1.3.6.1.4.1.34592).
The MIB tree splits at the second level:
- `.1.x.x` = EPON (FD1208S, FD1104S, FD1204S, FD8000-EPON)
- `.5.x.x` = GPON (FD1616GS, FD8920, FD1204SN)

`detectCdataPonType(sysDescr)` (exported from `real-snmp-client.ts`) detects EPON/GPON from sysDescr:
- "EPON" or "GPON" keywords → direct match
- FD1616GS / FD8920 / FD1204SN model patterns → GPON
- FD1208S- / FD1204S- / FD1104S- patterns → EPON
- Returns "unknown" if unrecognised → caller tries GPON first, EPON as fallback

`VENDOR_ONU_MIBS` keys: `"CDATA"` (GPON compat alias), `"CDATA-GPON"`, `"CDATA-EPON"`.
Both the CdataAdapter and `test-onu-list` route do this dispatch.
