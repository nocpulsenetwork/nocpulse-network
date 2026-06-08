---
name: EasyPath SNMP quirks
description: FD1208S-B0 V1.6.0 firmware SNMP behavior — ONU table OID, column map, maxRepetitions limit.
---

# EasyPath Ethernet-PON (FD1208S-B0 V1.6.0) SNMP quirks

## Device identity
- sysObjectID: `1.3.6.1.4.1.17409` (NOT the standard C-DATA `1.3.6.1.4.1.34592`)
- sysDescr: "EasyPath Ethernet-PON"
- Detected vendor: "CDATA" (added "easypath" and OID prefix checks to detectVendor())

## ONU table location
`1.3.6.1.4.1.17409.2.2.11.2.1.1.{col}.{idx1}.{idx2}` — 8 columns (2,3,4,6,7,8,9,10)

## Column map (confirmed live)
| Col | Type           | Meaning                                     |
|-----|----------------|---------------------------------------------|
| 3   | OctetString[9] | byte[5] = PON port index (0-indexed)        |
| 4   | INTEGER        | Status: 4=online, 2=offline                 |
| 6   | OctetString[11]| DateAndTime registration timestamp          |
| 7   | OctetString[11]| DateAndTime (last de-reg or same as COL6)   |
| 8   | Counter32      | Registration count                          |
| 9   | INTEGER        | Always 1 (admin state enabled)              |
| 10  | OctetString    | ONU name (empty — not configured)           |
| 2   | INTEGER        | ONU type code (203/310/321/401/403)         |

## Index structure
- idx1: auto-incremented ONU registration ID (stable per ONU session, monotone with reg time)
- idx2: second auto-incremented counter, always > idx1, not port/slot derived
- Use idx1 as the ONU identifier (onuId)

## No MAC/Serial
This firmware does not expose ONU MAC addresses or serial numbers via SNMP.
Leave serial=null and mac=null in SnmpOnu.

## Critical: GETBULK maxRepetitions limit
- maxRepetitions ≤ 40: works fine (~70ms)
- maxRepetitions = 50: OLT agent hangs → timeout after 3000ms × retries
- **Always use iterative GETBULK with BATCH=20** (same as WALK_MAX_REPETITIONS)

**Why:** The FD1208S-B0 SNMP agent cannot handle large bulk requests on this specific
table. BATCH=20 stays well below the limit and is consistent with debugWalkSubtree.

**How to apply:** In readEasyPathOnuTable(), Phase 1 uses a walkLoop with
`snmpGetBulk([cursor], 20)` until the subtree is exhausted, not a single large GETBULK.
