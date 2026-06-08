---
name: EasyPath SNMP quirks
description: FD1208S-B0 V1.6.0 firmware SNMP behavior — ONU table OID, column map, maxRepetitions limit, dual sub-table structure.
---

# EasyPath Ethernet-PON (FD1208S-B0 V1.6.0) SNMP quirks

## Device identity
- sysObjectID: `1.3.6.1.4.1.17409` (NOT the standard C-DATA `1.3.6.1.4.1.34592`)
- sysDescr: "EasyPath Ethernet-PON"
- sysName: "EasyPath Series PON Switch Access"
- Detected vendor: "CDATA" (added "easypath" and OID prefix checks to detectVendor())

## ONU table location — ACTIVE registration table (correct one to use)
`1.3.6.1.4.1.17409.2.2.11.2.1.1.{col}.{idx1}.{idx2}` — 8 columns (2,3,4,6,7,8,9,10)

This is tableIdx=1 in the OID path.  All currently-registered ONUs appear here.
Verified exhaustively on 2026-06-08: active count ~31 ONUs across 2 PON ports.

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

## Second sub-table — DO NOT USE for ONU status
`1.3.6.1.4.1.17409.2.2.11.2.2.1.{col}.{idx1}.{idx2}` — this is a
**historical LLID session log**, NOT current ONU registrations.

**Confirmed on 2026-06-08:**
- ~1969 COL4 entries (1642 status=4, 319 other, 12 status=2)
- COL3 (port bytes) is ENTIRELY ABSENT — GETBULK from `.2.2.1.3` returns 0 entries
- tableIdx=2 is a ring-buffer (~2000 slots) that accumulates all past ONU registration
  events; status=4 in this table means "online when the session was logged",
  NOT "currently online"
- Ignore this sub-table for discovery — including it gives garbage "online" counts
  and wrong port assignments (portIdx fallback only, no real COL3 data)

**Why:** The FD1208S-B0 maintains both a current-registration view (2.1.1) and a
historical-session log (2.2.1). The session log accumulates over the device's lifetime
and has a completely different cardinality from the current active ONU count.

## Other sub-tables (tableIdx = 0, 3–7)
Probed on 2026-06-08 — all return 0 COL4 entries. Empty; do not walk.

## No MAC/Serial
This firmware does not expose ONU MAC addresses or serial numbers via SNMP.
Leave serial=null and mac=null in SnmpOnu.

## Identity columns (COL2, COL5, COL6, COL9) — SKIP
All four identity columns return noSuchInstance for every ONU on this firmware.
Removed from readEasyPathOnuTable() to avoid ~120 s of wasted SNMP round-trips
over WAN (each GET chunk takes 3–5 s; 40 chunks for 500 ONUs = 120–200 s wasted).
**Do not re-add** unless the user confirms a firmware version that populates them.

## Critical: GETBULK maxRepetitions limit
- maxRepetitions ≤ 40: works fine (~70ms)
- maxRepetitions = 50: OLT agent hangs → timeout after 3000ms × retries
- **Always use iterative GETBULK with BATCH=20** (same as WALK_MAX_REPETITIONS)

**Why:** The FD1208S-B0 SNMP agent cannot handle large bulk requests on this specific
table. BATCH=20 stays well below the limit and is consistent with debugWalkSubtree.

**How to apply:** In readEasyPathOnuTable(), Phase 1 uses a walkLoop with
`snmpGetBulk([cursor], 20)` until the subtree is exhausted, not a single large GETBULK.

## Critical: do NOT break on batch.length < BATCH
The FD1208S-B0 firmware returns **partial GETBULK responses mid-table** between PON port
segments (e.g. batch of 10 when BATCH=20 even with more entries remaining). Breaking on
`batch.length < BATCH` causes premature termination — ONUs on subsequent ports are missed.

**End-of-table detection:** break only when `inTree.length === 0` (walked past the column
prefix) or when the cursor OID did not advance (infinite-loop guard).

## Per-PDU timeout
- Use `timeoutMs: 5_000` (5s per GETBULK PDU). With ~2 PDUs per 30 ONUs the full
  walk completes in <1 second under normal conditions.
- Do NOT use `timeoutMs: 10_000`. With `retries: 1`, a timed-out PDU costs 20s; across
  15 PDUs that exceeds typical HTTP client timeouts (60s) and makes discovery appear hung.

## Broader SNMP tree
Attempting GETBULK from the enterprise root `1.3.6.1.4.1.17409` returns 0 bindings —
the agent does not support tree-walk from high-level OIDs.  Only specific known OIDs
respond.  No other ONU-related OID paths were found under .17409 besides .2.2.11.2.x.1.
