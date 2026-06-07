---
name: Vendor adapter pattern
description: VendorAdapter interface shape and which adapters are implemented vs stubs
---

## Rule
`VendorAdapter` interface (in `core/adapter-registry.ts`) requires: `pollOlt`, `pollOnu`, `pollAlarms`, `discoverOnus`. All methods return Promises and throw "not yet implemented" if not ready.

**Why:** Uniform interface lets the router call any vendor without branching. Unimplemented methods throw explicitly — never silently succeed with wrong data.

**How to apply:**
- CDATA: `discoverOnus()` uses a 3-layer fallback chain (see below).
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

## C-DATA EPON 3-layer discovery fallback chain

The exact ONU table OID varies across C-DATA firmware versions. `discoverOnus()` in CdataAdapter chains 3 strategies:

1. **Static table** — `readOnuTable("CDATA-EPON", 50)` using `cdataEponOnuTable` at `1.3.6.1.4.1.34592.1.1.3.1`. Quick, 2 PDUs.
2. **Dynamic probe** — `readCdataEponOnusProbe(50)` on `RealSnmpClient` when layer 1 returns 0. Walks candidate subtrees (`1.3.6.1.4.1.34592.1.1.3`, then `.1.1`, then `.1`), finds 6-byte OctetStrings (ONU MACs), derives table root + adjacent status/type columns at runtime. Works regardless of firmware path.
3. **Opposite PON type** — tries CDATA-GPON table as last resort (catches misconfigured sysDescr or unknown PON type).

**Why the probe is needed:** C-DATA EPON table index column (col 1) is often `not-accessible` in the MIB, causing GETBULK on it to return 0 results even when ONUs exist. The probe uses GETBULK on broader subtrees and identifies ONU entries by their 6-byte MAC/LLID OctetStrings rather than index values.

**How to apply:** Do NOT remove the probe layer without verifying that the static table OID is confirmed correct for the target firmware. The probe's `mibUsed` field in results includes the discovered table root — use it to update the static OID if needed.
