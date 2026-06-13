---
name: EasyPath SNMP quirks
description: FD1208S-B0 V1.6.0 — single-table ONU discovery: 17409.2.3.4 col7 (MAC) + col8 (status) walked in parallel. Eliminates 34592 MAC table walk. Per-PON counts match web UI exactly.
---

# EasyPath Ethernet-PON (FD1208S-B0 V1.6.0) SNMP quirks

## Device identity
- sysObjectID: `1.3.6.1.4.1.17409` (NOT the standard C-DATA `1.3.6.1.4.1.34592`)
- sysDescr: "EasyPath Ethernet-PON"
- sysName: "EasyPath Series PON Switch Access"
- Detected vendor: "CDATA" (added "easypath" and OID prefix checks to detectVendor())

## ONU discovery — OPTIMISED SINGLE-TABLE APPROACH (verified 2026-06-12)

Walk **17409.2.3.4** cols 7 and 8 in parallel — both indexed by the same bigN.

### col7 — ONU MAC address
**`1.3.6.1.4.1.17409.2.3.4.1.1.7.{bigN}`**

- OctetString 6 bytes = hardware ONU MAC address
- All 356 provisioned ONUs have valid MACs here
- Format on wire: 6-byte binary; `parseMacAddress(vb.value)` → "AA:BB:CC:DD:EE:FF"
- Replaces the 34592 MAC table walk (34592 table still works but is redundant)

### col8 — Live online/offline status
**`1.3.6.1.4.1.17409.2.3.4.1.1.8.{bigN}`**

- INTEGER 1=online, 2=offline
- Covers ALL provisioned ONUs (~356 rows); per-PON counts match web UI exactly
- **DO NOT use 17409.2.2.11.2.1.1 col3/col4** — only ~146 rows (MPCP subset, wrong totals)

### Other probed columns of 17409.2.3.4.1.1
- col1: Gauge32 (bigN itself)
- col2: OctetString — all null/empty on this firmware
- col3: INTEGER — type flag (~288 rows only)
- col4/5/6: IpAddress — all 0.0.0.0
- col12: OctetString "14.06.06" — manufacture date?
- col13: OctetString "V6.0.2408E" — ONU firmware version
- col14: OctetString hex flags (0x010101…)
- cols 15–21: INTEGER — various counters/flags

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

### Implementation
Walk col7 and col8 via `Promise.all([walkCol7(), walkCol8()])`.
Build ONU list from statusByBigN map (all 356 entries).
Look up mac from macByBigN for each bigN.
serial = mac.replace(/:/g,"").toUpperCase() (EPON has no separate serial; MAC IS the identity).

## ONU description / name
- **NOT available via SNMP community=public on this device.**
- OLT stores descriptions in /mnt/cfg/pon.cfg but does not expose via SNMP GET.
- 17409.2.3.4 has no text-description column. 17409.2.3.2 is interface table (not ONUs).
- Return `name: null`. UI shows "N/A" for Name field — correct behavior.

## ONU serial number
- **EPON has no GPON-style serial.** The MAC address IS the ONU's unique identity.
- Store `serial = mac.replace(/:/g,"").toUpperCase()` (e.g. "00D39F3A0EB8")
- Frontend `macAddress` = `onu.mac ?? onu.serial ?? ""` — uses MAC with colons for display
- Serial without colons enables serial-style search (e.g. "00D39F")

## Per-PON online count OID (for reference / validation)
`1.3.6.1.4.1.17409.2.3.3.1.1.8.1.0.{portSlot}` for portSlot 13–20

## ONU optical power + distance (Phase 2 probe) — confirmed

Confirmed OIDs (same `17409.2.3.4.1.1` table):
- **col9**  → RX optical power
- **col10** → TX optical power
- **col11** → fiber distance (metres, integer, no scaling)

Confirmed encoding (validated by user against OLT web UI):
- OLT UI -12.24 dBm = raw SNMP -1224  →  **0.01 dBm scale (÷100)**
- OLT UI   2.70 dBm = raw SNMP   270  →  **0.01 dBm scale (÷100)**
- Auto-detect: median of negative values in RX col; if < -500 → ÷100, else ÷10
- TX is positive-only so auto-detect defaults wrong (÷10); fixed by inheriting rxDiv for txDiv

`isOpticalLike` heuristic requires `|val| > 10` to reject status-flag columns (raw 0, 1, 2).

### CRITICAL: col9/10/11 use two-part OID index, NOT single-integer bigN

col7/col8 (Phase 1) instance suffix: `"3846"` — single integer `(portSlot<<8)|onuSlot`
col9/10/11 (Phase 2) instance suffix: `"15.6"` — two-part `portSlot.onuSlot`

The old `walkIntCol` had `if (bigNStr.includes(".")) continue` — this silently dropped
every row from col9/10/11, returning empty Maps → isOpticalLike returned false → all null.

Fix: `walkIntCol` now handles both formats. Two-part suffix is re-encoded as
`bigN = (portSlot << 8) | onuSlot` so rxRaw/txRaw/distRaw keys match statusByBigN keys.
Also added 32-bit sign extension: `if (val > 0x7FFFFFFF) val = val - 0x100000000`
in case the OLT declares optical columns as Gauge32/Counter32 (unsigned).

Phase 3 (temperature/duration, cols 15–21) — OIDs not yet confirmed. Disabled (null/N/A).

## OLT health OIDs — EasyPath V2 MIB (enterprise 34592)

Confirmed OIDs to use for `getOltHealth()`. All are scalar GETs with `.0` instance suffix:

| Metric       | OID                                    | Notes                          |
|--------------|----------------------------------------|--------------------------------|
| CPU %        | `1.3.6.1.4.1.34592.1.3.100.1.8.1.0`  | Expect 0–100 integer           |
| Mem total    | `1.3.6.1.4.1.34592.1.3.100.1.8.2.0`  | Raw integer (KB or bytes)      |
| Mem free     | `1.3.6.1.4.1.34592.1.3.100.1.8.3.0`  | Same units as Mem total        |
| Temperature  | `1.3.6.1.4.1.34592.1.3.100.1.8.6.0`  | Whole °C or 0.01 °C if >120   |

memPct = round((memTotal − memFree) / memTotal × 100). Both OIDs must be present and total > 0.
Previous OIDs (`17409.1.1.1.5/6/7`) were wrong firmware generation — do NOT use.

## Dead-end OIDs (do not retry)
- `17409.2.2.11.2.1.1.3+.4` — only ~146 rows (MPCP subset), gives ~141 online (wrong)
- `34592.4.1.3.1` (EPON ONU table) — not implemented on this device, 0 rows
- `34592.5.1.1.1` (PON port table) — not implemented on this device, 0 rows
- `34592.4.x` and `34592.5.x` subtrees — not implemented on this EasyPath variant
- `34592.1.3.1.1.2.1.1.2.1.2.{bigN}` (34592 MAC table) — still works but 17409 col7 is faster

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
- Format: `${portSlot}.${onuSlot}` (e.g. `"15.6"`) — the explicit SNMP two-part index
- Replaces old `cdp_${bigN}` encoding; frontend parses second part directly for onuSlot
- Frontend safeOnuId = onuId.replace(/\./g, "-") → "15-6" (URL/ID safe)
- `onuSlot = parseInt(onuId.split(".")[1], 10)` — no bit-masking needed

## MIB-confirmed OIDs for optical telemetry (V2 MIB, 2026-06-13)

### onuPonPortOpticalTransmissionPropertyTable — `17409.2.3.4.2.1`
3-part INDEX: `{EponDeviceIndex, CardIndex, PortIndex}` — for non-modular ONU: CardIndex=0, PortIndex=1

| col | name | OID | units | scale |
|-----|------|-----|-------|-------|
| 4 | onuReceivedOpticalPower | `17409.2.3.4.2.1.4.{bigN}.0.1` | centi-dBm | ÷100 |
| 5 | onuTramsmittedOpticalPower (typo in MIB) | `17409.2.3.4.2.1.5.{bigN}.0.1` | centi-dBm | ÷100 |
| 6 | onuBiasCurrent | `17409.2.3.4.2.1.6.{bigN}.0.1` | centi-mA | ÷100 |
| 7 | onuWorkingVoltage | `17409.2.3.4.2.1.7.{bigN}.0.1` | centi-mV | ÷100 |
| 8 | onuWorkingTemperature | `17409.2.3.4.2.1.8.{bigN}.0.1` | Centi-°C | ÷100 |

bigN here = 32-bit EponDeviceIndex: `(0x01 << 24) | (0x00 << 16) | (portSlot << 8) | onuSlot`
→ PON-3 ONU-6: portSlot=15, onuSlot=6, bigN=16781062

### onuInfoTable — `17409.2.3.4.1.1`
1-part INDEX: `{EponDeviceIndex}` (same bigN 32-bit integer)

| col | name | OID | units | scale |
|-----|------|-----|-------|-------|
| 15 | onuTestDistance | `17409.2.3.4.1.1.15.{bigN}` | Meters | ×1 |
| 18 | onuTimeSinceLastRegister | `17409.2.3.4.1.1.18.{bigN}` | seconds | ×1 (Counter32) |

### IMPORTANT: Index encoding discrepancy
Current Phase 2 code uses TWO-part index `portSlot.onuSlot` (e.g. "15.6") for cols 9/10/11.
MIB-defined tables use SINGLE 32-bit bigN (e.g. 16781062) OR 3-part bigN.cardIdx.portIdx.
This suggests the device exposes cols 9/10/11 (optical) at a table that uses a different 2-part index,
NOT the MIB-spec onuInfoTable (which has single bigN index).
**Do not assume cols 9/10/11 index format matches MIB — confirm live OIDs against the device.**

## Phase 3 probe — temperature and register duration
Per MIB: temperature is in optical property table at `17409.2.3.4.2.1.8` (3-part index bigN.0.1),
NOT in onuInfoTable. onuTestDistance = `17409.2.3.4.1.1.15` with single 32-bit bigN index.
onuTimeSinceLastRegister = `17409.2.3.4.1.1.18` with single 32-bit bigN index.
**Status 2026-06-13:** OIDs now MIB-confirmed. Not yet validated live against device.

## Implementation location
`artifacts/api-server/src/backend/snmp/real-snmp-client.ts` — `readEasyPathOnuTable()`
Phase 1A: walkCol7 → macByBigN map (col7, MAC, ~356 rows)
Phase 1B: walkCol8 → statusByBigN map (col8, status, ~356 rows)
Both in parallel via Promise.all. Build onus[] from statusByBigN.
Total SNMP latency: ~1.5s on FD1208S-B0 at 103.111.225.76 (down from ~3s).
