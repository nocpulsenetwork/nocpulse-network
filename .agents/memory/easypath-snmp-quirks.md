---
name: EasyPath SNMP quirks
description: FD1208S-B0 V1.6.0 firmware — full ONU discovery uses 34592 MAC table (NOT 17409.2.2.11.2.1.1), bigN port encoding, maxRepetitions limit.
---

# EasyPath Ethernet-PON (FD1208S-B0 V1.6.0) SNMP quirks

## Device identity
- sysObjectID: `1.3.6.1.4.1.17409` (NOT the standard C-DATA `1.3.6.1.4.1.34592`)
- sysDescr: "EasyPath Ethernet-PON"
- sysName: "EasyPath Series PON Switch Access"
- Detected vendor: "CDATA" (added "easypath" and OID prefix checks to detectVendor())

## ONU discovery — USE 34592 MAC TABLE (confirmed 2026-06-08)

The ONLY SNMP path that surfaces all provisioned ONUs across all 8 PON ports:

`1.3.6.1.4.1.34592.1.3.1.1.2.1.1.2.1.2.{bigN}`

OctetString value = 6-byte ONU MAC address.

### bigN index encoding (4-byte big-endian integer)
- byte[0] = 0x01 (OLT group, always 1)
- byte[1] = 0x00 (reserved)
- byte[2] = port slot  (13–20 for PON1–PON8 on FD1208S-B0)
- byte[3] = ONU slot within port (1-based sequential)

Port extraction in TypeScript/JavaScript:
```ts
const portSlot  = (bigN >>> 8) & 0xFF;  // byte[2]
const portIndex = portSlot - 13;         // 0=PON1, …, 7=PON8
```

PORT_SLOT_MIN=13, PORT_SLOT_MAX=28 (accepts up to 16-port C-DATA variants).

### Per-ONU online/offline status — NOT AVAILABLE
- community=public does not expose per-ONU online/offline status for all ONUs
- All 353 provisioned ONUs are reported with status="online"
- 17409.2.2.11.2.1.1 (portIdx=1) only exposes 31 ONUs from PON1–3; not representative

### 34592 sub-table structure (reference)
- sub-col 1.2: 353 × 6-byte OctetString = MAC ← USE THIS
- sub-col 1.3, 1.4, 1.5: 353 × INTEGER=0 (padding/reserved)
- sub-col 1.6: 353 × INTEGER ∈ {61, 62, outliers} — service profile ID; NOT status
- sub-col 1.7: 353 × INTEGER=1 — constant flag; NOT status
- sub-col 1.8+: empty

### Confirmed configured counts per port (FD1208S-B0 at 103.111.225.76, 2026-06-08)
| Port  | Configured | OLT web UI (online) | Offline |
|-------|-----------|---------------------|---------|
| PON1  | 58        | 53                  | 5       |
| PON2  | 42        | 42                  | 0       |
| PON3  | 19        | 17                  | 2       |
| PON4  | 46        | 31                  | 15      |
| PON5  | 58        | 45                  | 13      |
| PON6  | 56        | 31                  | 25      |
| PON7  | 35        | 33                  | 2       |
| PON8  | 39        | 28                  | 11      |
| Total | 353       | 280                 | 73      |

The 73 offline ONUs remain in the 34592 table (config persists). Their presence is
indistinguishable from online ONUs via community=public.

## Why not 17409.2.2.11.2.1.1 (portIdx=1)?
- portIdx=1: ONLY 31 ONUs (PON1–PON3 partial subset); genuinely has only 31 rows
- portIdx=2: historical LLID session ring-buffer (~2000 entries) for PON1–PON3 only
- portIdx=3: historical overflow log for PON1 only (byte[5]=0 for all entries)
- portIdx=4–10, portIdx=8–10: all return 0 entries
- No other 17409 subtree exposes ONU data: 17409.2.1, 17409.2.2.1–10, 17409.2.2.11.1/3, 17409.2.3 all return 0 entries

## Critical: GETBULK maxRepetitions limit
- maxRepetitions ≤ 40: works fine (~70ms)
- maxRepetitions = 50: OLT agent hangs → timeout
- **Always use BATCH=20** for all GETBULK on this device

## Critical: do NOT break on batch.length < BATCH
The FD1208S-B0 firmware returns partial GETBULK responses. Break only when
`inTree.length === 0` or cursor did not advance (no-progress guard).

## Per-PDU timeout
- Use `timeoutMs: 5_000` (5s per GETBULK PDU).
- Do NOT use 10_000: with retries=1, a timeout costs 20s; compound over many PDUs.

## ONU ID format
- New format: `cdp_${bigN}` (e.g. `cdp_16780545`)
- "cdp" = C-DATA provisioned entry
- bigN is the decimal OID suffix integer

## MAC addresses
- 6-byte OctetString from sub-col 1.2 of 34592 table
- All 353 ONUs have valid MACs; use `parseMacAddress(vb.value)` directly
