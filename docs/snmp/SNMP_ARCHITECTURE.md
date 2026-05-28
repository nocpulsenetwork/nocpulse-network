# NOCpulse — SNMP Read-Only Architecture Plan

> **Status:** Planning only. No real SNMP calls exist yet.
> This document defines the intended adapter pattern, safety contract, polling strategy,
> and data flow for future SNMP integration. Implementation belongs in `artifacts/api-server`.

---

## 1. Overview

NOCpulse will poll OLTs and ONUs via SNMPv2c (or SNMPv3) in **read-only** mode.
A thin vendor-specific adapter layer translates raw OIDs into the typed data models
already used throughout the frontend (`OltDevice`, `OnuDevice`).

The polling engine will live entirely in the API server. The frontend never issues
SNMP requests directly; it consumes REST endpoints that return the same shape as the
existing mock data.

---

## 2. Read-Only SNMP Flow

```
Frontend
  │  REST GET /api/olts/:id/live
  ▼
API Server (Express)
  │  calls → SnmpPoller.getOltSnapshot(olt)
  ▼
SnmpPoller
  │  uses → VendorAdapter.resolve(olt.brand)
  ▼
VendorAdapter (Huawei | ZTE | BDCOM | VSOL | CDATA | Generic)
  │  provides OID map for the target vendor
  ▼
snmp.get / snmp.getNext / snmp.walk  ← READ ONLY
  │
  ▼
Raw OID values
  │  transformed by VendorAdapter.parse()
  ▼
OltSnapshot / OnuSnapshot (typed)
  │
  ▼
API Server returns JSON → Frontend
```

### Step-by-step poll sequence for one OLT

1. **Open SNMP session** — `snmp.createSession(ip, community, options)`
2. **Get OLT system info** — `sysDescr`, `sysUpTime`, `sysName` (RFC 1213 / SNMPv2-MIB)
3. **Get PON port table** — vendor-specific `ifTable` walk or proprietary port OID
4. **Get ONU list** — walk vendor ONU index table (e.g. Huawei `hwGponDeviceMibObjects`)
5. **Get ONU RX power** — per-ONU optical RX dBm OID
6. **Get ONU TX power** — per-ONU optical TX dBm OID
7. **Get ONU status** — per-ONU oper-state / admin-state OID
8. **Close session** — always close in `finally` block to release socket

---

## 3. Safety Contract — NO WRITE OPERATIONS

These rules are **absolute** and must be enforced at the adapter layer, not just by
convention. Any future implementation must follow them.

| Rule | Detail |
|------|--------|
| **No SET requests** | `snmp.set()` must never be called |
| **No reboot** | Never walk/use `hrSWRunTable` write OIDs or vendor reboot OIDs |
| **No disable** | Never touch `ifAdminStatus` SET or vendor admin-state write OIDs |
| **No config push** | Never use NETCONF, RESTCONF, or SNMP SET for configuration |
| **Read-only community only** | The community string stored in `ManagedOlt.community` is treated as read-only. A separate `rwCommunity` field would be needed for write access — it must never be added without explicit safety review |
| **SNMP v3 auth** | When SNMPv3 is used, only `authNoPriv` or `authPriv` with `noAuthNoPriv` for read; never configure write access in the agent config |
| **Rate limiting** | Minimum 200 ms gap between successive GET requests to the same OLT to avoid SNMP queue saturation |
| **Timeout/retry** | Max 2 retries, 3 s timeout per request. Give up and mark as `Degraded` rather than hammering |
| **Safe Polling Mode** | When `ManagedOlt.safePollingMode === true`, all intervals are multiplied by 4× and walk batch size is halved |

---

## 4. Polling Strategy

All intervals are defaults. Override via per-OLT `safePollingMode` (4× multiplier).

| Data Class | Default Interval | Safe Poll Interval | Notes |
|---|---|---|---|
| OLT system info | 60 s | 240 s | `sysUpTime`, CPU, memory, temp |
| PON port state | 60 s | 240 s | link-up / link-down per port |
| ONU list | 120 s | 480 s | index walk; catches add/remove |
| ONU RX/TX power | 60 s | 240 s | per-ONU optical levels |
| ONU status | 60 s | 240 s | online / offline / degraded |
| Alarm / trap | 30 s | 120 s | walk alarmActive table |
| Full refresh | **Manual only** | **Manual only** | Triggered by user or API call |

### Jitter
Add ±10 % random jitter to all intervals to prevent thundering-herd when many OLTs
are polled simultaneously.

### Stale data handling
If a poll fails (timeout / unreachable), the last known snapshot is retained and
the OLT/ONU status is set to `Degraded` after 2 consecutive failures, `Offline` after 5.

---

## 5. Adapter Interface

See `docs/snmp/ADAPTER_INTERFACE.ts` for the TypeScript contract every vendor adapter
must satisfy.

---

## 6. Vendor OID Files

Placeholder OID maps live in `docs/snmp/oids/`. Each file exports:
- A constant `OID_MAP` with all known OIDs for that vendor
- A `parseOltSnapshot` stub
- A `parseOnuRow` stub

| File | Vendor | MIB basis |
|------|--------|-----------|
| `oids/huawei.ts` | Huawei MA5800 / MA5600 | `HUAWEI-GPON-MIB`, `HUAWEI-EPON-MIB` |
| `oids/zte.ts` | ZTE ZXA10 C300/C600 | `ZTE-AN-GPON-MIB`, proprietary |
| `oids/bdcom.ts` | BDCOM P3310C / P3608 | `BDCOM-EPON-MIB` |
| `oids/vsol.ts` | VSOL V1600 / V2800 | Partial standard + proprietary |
| `oids/cdata.ts` | CDATA FD1616GS / FD8920 | `CDATA-GPON-MIB` |
| `oids/generic.ts` | Any (fallback) | RFC 1213, IF-MIB, ENTITY-MIB |

---

## 7. Future Implementation Checklist

When it is time to implement real SNMP polling, follow this order:

- [ ] Add `net-snmp` (Node.js) to `artifacts/api-server/package.json` — review license (MIT)
- [ ] Create `artifacts/api-server/src/snmp/session.ts` — session factory with timeout + retry
- [ ] Create `artifacts/api-server/src/snmp/poller.ts` — interval scheduler using `node:timers/promises`
- [ ] Move OID maps from `docs/snmp/oids/` into `artifacts/api-server/src/snmp/oids/`
- [ ] Implement `VendorAdapter` per vendor, starting with `generic.ts` as base class
- [ ] Add `GET /api/olts/:id/live` endpoint that calls poller directly (no cache)
- [ ] Add `GET /api/olts/:id/onus` endpoint for ONU list
- [ ] Add `GET /api/olts/:id/alarms` endpoint for active alarms
- [ ] Wire `useApiData` context to new live endpoints (fallback to mock on error)
- [ ] Add SNMP credentials to env secrets: `SNMP_READ_COMMUNITY` (never commit)
- [ ] Test against a real OLT in a lab environment before production rollout
- [ ] Run a 24-hour soak test watching memory / socket leak
