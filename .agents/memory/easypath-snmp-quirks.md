---
name: EasyPath SNMP quirks
description: FD1208S-B0 V1.6.0 — two-source ONU discovery: 34592 MAC table (registered) + 17409.2.2.11.2.1.1 col3/col4 (live status). bigN cross-reference confirmed.
---

# EasyPath Ethernet-PON (FD1208S-B0 V1.6.0) SNMP quirks

## Device identity
- sysObjectID: `1.3.6.1.4.1.17409` (NOT the standard C-DATA `1.3.6.1.4.1.34592`)
- sysDescr: "EasyPath Ethernet-PON"
- sysName: "EasyPath Series PON Switch Access"
- Detected vendor: "CDATA" (added "easypath" and OID prefix checks to detectVendor())

## ONU discovery — TWO-SOURCE APPROACH (implemented 2026-06-12)

### Source A — Registered ONU list (34592 MAC table)
`1.3.6.1.4.1.34592.1.3.1.1.2.1.1.2.1.2.{bigN}`

OctetString value = 6-byte ONU MAC address. All provisioned ONUs appear here (~353–356).

### bigN index encoding (4-byte big-endian integer)
- byte[0] = 0x01 (OLT group, always 1)
- byte[1] = 0x00 (reserved)
- byte[2] = port slot  (13–20 for PON1–PON8 on FD1208S-B0)
- byte[3] = ONU slot within port (1-based sequential)

```ts
const portSlot  = (bigN >>> 8) & 0xFF;  // byte[2]
const portIndex = portSlot - 13;         // 0=PON1, …, 7=PON8
```

PORT_SLOT_MIN=13, PORT_SLOT_MAX=28 (accepts up to 16-port C-DATA variants).

### Source B — Live operational status (17409 EPON registration table)
`1.3.6.1.4.1.17409.2.2.11.2.1.1.3.{idx1}.{idx2}` — col3, 9-byte OctetString
- bytes[0..3] = bigN (identical encoding to Source A — same portSlot, onuSlot)
- `bigN = (b0<<24)|(b1<<16)|(b2<<8)|b3 >>> 0`

`1.3.6.1.4.1.17409.2.2.11.2.1.1.4.{idx1}.{idx2}` — col4, INTEGER status
- 4 = online, 2 = offline, 3 = transitioning (treat as offline)

**Cross-reference:** match col3 and col4 by shared `{idx1}.{idx2}` OID suffix.
Derive bigN from col3 bytes → use as key into the registered ONU map from Source A.

### Merge logic
For each ONU in Source A (registered):
- If its bigN appears in Source B with col4=4 → status = "online"
- Otherwise (absent or col4≠4) → status = "offline"

### Why this table only has ~152 rows (not 353)
The 17409.2.2.11.2.1.1 table contains ONUs currently tracked by the EPON MPCP layer.
ONUs that are provisioned but have no active LLID registration don't appear here — they
are correctly treated as offline in the merge step.

### 34592 sub-table structure (reference)
- sub-col 1.2: ~353 × 6-byte OctetString = MAC ← USE THIS for registered list
- sub-col 1.3, 1.4, 1.5: ~353 × INTEGER=0 (padding/reserved)
- sub-col 1.6: ~353 × INTEGER ∈ {61, 62, outliers} — service profile ID; NOT status
- sub-col 1.7: ~353 × INTEGER=1 — constant flag; NOT status

## Critical: GETBULK maxRepetitions limit
- maxRepetitions ≤ 40: works fine (~70ms per PDU)
- maxRepetitions = 50: OLT agent hangs → timeout
- **Always use BATCH=20** for all GETBULK on this device

## Critical: do NOT break on batch.length < BATCH
The FD1208S-B0 firmware returns partial GETBULK responses. Break only when
`inTree.length === 0` or cursor did not advance (no-progress guard).

## Per-PDU timeout
- Use `timeoutMs: 5_000` (5s per GETBULK PDU).
- Do NOT use 10_000: with retries=1, a timeout costs 20s; compound over many PDUs.

## ONU ID format
- Format: `cdp_${bigN}` (e.g. `cdp_16780545`)
- "cdp" = C-DATA provisioned entry
- bigN is the decimal OID suffix integer

## MAC addresses
- 6-byte OctetString from sub-col 1.2 of 34592 table
- All ~353 ONUs have valid MACs; use `parseMacAddress(vb.value)` directly

## Implementation location
`artifacts/api-server/src/backend/snmp/real-snmp-client.ts` — `readEasyPathOnuTable()`
Walks col3 and col4 in parallel (Promise.all), then walks 34592 MAC table and merges.
Total SNMP latency: ~2.4 seconds on FD1208S-B0 at 103.111.225.76.
