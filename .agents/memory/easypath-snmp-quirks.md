---
name: EasyPath SNMP quirks
description: FD1208S-B0 V1.6.0 — two-source ONU discovery: 17409.2.3.4 col8 (live status, bigN-indexed, 1=online 2=offline) + 34592 MAC table. Per-PON counts match web UI exactly.
---

# EasyPath Ethernet-PON (FD1208S-B0 V1.6.0) SNMP quirks

## Device identity
- sysObjectID: `1.3.6.1.4.1.17409` (NOT the standard C-DATA `1.3.6.1.4.1.34592`)
- sysDescr: "EasyPath Ethernet-PON"
- sysName: "EasyPath Series PON Switch Access"
- Detected vendor: "CDATA" (added "easypath" and OID prefix checks to detectVendor())

## ONU discovery — CORRECT TWO-SOURCE APPROACH (verified 2026-06-12, per-PON matches web UI)

### Source A — Live operational status (17409.2.3.4 ONU status table)
**`1.3.6.1.4.1.17409.2.3.4.1.1.8.{bigN}`**

- Index = bigN (IDENTICAL to Source B — direct join, no transformation needed)
- Value: INTEGER 1=online, 2=offline
- Covers ALL provisioned ONUs (~356 rows); per-PON counts match web UI exactly
- Confirmed: PON1=8, PON2=38, PON3=18, PON4=29, PON6=17, PON7=26, PON8=2 (live)
- **DO NOT use 17409.2.2.11.2.1.1 col3/col4** — that table has only ~146 rows (MPCP subset only) and gives wrong totals (~141 online vs actual 165)

### Source B — Registered ONU list with MAC addresses (34592 MAC table)
`1.3.6.1.4.1.34592.1.3.1.1.2.1.1.2.1.2.{bigN}`

OctetString value = 6-byte ONU MAC address. All provisioned ONUs appear here (~353–356).

### bigN index encoding (4-byte big-endian integer stored as decimal OID component)
- byte[0] = 0x01 (OLT group, always 1)
- byte[1] = 0x00 (reserved)
- byte[2] = port slot  (13–20 for PON1–PON8 on FD1208S-B0)
- byte[3] = ONU slot within port (1-based sequential)

```ts
const portSlot  = (bigN >>> 8) & 0xFF;  // byte[2]
const portIndex = portSlot - 13;         // 0=PON1, …, 7=PON8
```

PORT_SLOT_MIN=13, PORT_SLOT_MAX=28 (accepts up to 16-port C-DATA variants).

### Merge logic
Walk Source A first → Map<bigN, "online"|"offline">
Walk Source B second → for each registered ONU (bigN), look up status from map.
ONUs in Source B absent from Source A → "offline" (rare edge case).

## Per-PON online count OID (for reference / validation)
`1.3.6.1.4.1.17409.2.3.3.1.1.8.1.0.{portSlot}` for portSlot 13–20

8 scalar GETs give per-PON online count directly. Sum matches col8=1 count from 17409.2.3.4.
These are NOT used in the implementation (we derive per-port counts from bigN decoding instead),
but are useful for validating that the sum of per-port online counts equals total online.

## Dead-end OIDs (do not retry)
- `17409.2.2.11.2.1.1.3+.4` — only ~146 rows (MPCP subset), gives ~141 online (wrong)
- `34592.4.1.3.1` (EPON ONU table) — not implemented on this device, 0 rows
- `34592.5.1.1.1` (PON port table) — not implemented on this device, 0 rows
- `34592.4.x` and `34592.5.x` subtrees — not implemented on this EasyPath variant

## Critical: GETBULK maxRepetitions limit
- maxRepetitions ≤ 40: works fine (~70ms per PDU)
- maxRepetitions = 50: OLT agent hangs → timeout
- **Always use BATCH=20** for all GETBULK on this device

## Critical: do NOT break on batch.length < BATCH
The FD1208S-B0 firmware returns partial GETBULK responses. Break only when
`inTree.length === 0` or cursor did not advance (no-progress guard).

## Per-PDU timeout
- Use `timeoutMs: 5_000` (5s per GETBULK PDU).

## ONU ID format
- Format: `cdp_${bigN}` (e.g. `cdp_16780545`)
- "cdp" = C-DATA provisioned entry
- bigN is the decimal OID suffix integer

## MAC addresses
- 6-byte OctetString from 34592 sub-col 1.2
- All ~353 ONUs have valid MACs; use `parseMacAddress(vb.value)` directly

## Implementation location
`artifacts/api-server/src/backend/snmp/real-snmp-client.ts` — `readEasyPathOnuTable()`
Phase 1: walks 17409.2.3.4.1.1.8 (col8, ~356 rows) → statusByBigN map
Phase 2: walks 34592 MAC table → merges status by bigN
Total SNMP latency: ~2–3 seconds on FD1208S-B0 at 103.111.225.76.
