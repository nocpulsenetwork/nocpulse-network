# NOCpulse Backend — Architecture Overview

Multi-vendor OLT/ONU monitoring backend. Designed to scale from a single OLT to thousands of devices across distributed PoPs.

---

## Folder Structure

```
backend/
├── adapters/              Vendor-specific device communication
│   ├── huawei/            MA5800 / MA5600T (SNMP + SSH CLI planned)
│   ├── zte/               C300 / C320 / C600 (SNMP + NETCONF planned)
│   ├── bdcom/             P3310 / P3608 (SNMP)
│   ├── vsol/              V1600G series (SNMP + HTTP API planned)
│   ├── cdata/             FD1616 / FD8920 (SNMP)
│   └── generic/           RFC MIBs fallback (IF-MIB, ENTITY-MIB)
│
├── core/
│   ├── adapter-registry.ts   Maps vendor → adapter, exposes singleton
│   ├── normalizer.ts         Cross-vendor post-processing + business rules
│   ├── cache.ts              In-memory TTL cache (Redis-ready interface)
│   └── polling-engine.ts     Interval-based device poller with stagger + retry
│
├── services/
│   ├── olt.service.ts     OLT CRUD + forceRefresh
│   ├── onu.service.ts     ONU query + search + forceRefresh
│   └── alarm.service.ts   Active alarms, history, acknowledge, clear
│
├── api/
│   ├── olt.routes.ts      Express router — /api/olts
│   ├── onu.routes.ts      Express router — /api/onus
│   └── alarm.routes.ts    Express router — /api/alarms
│
└── types/
    ├── olt.types.ts       OltNormalized, OltPollRequest, OltVendor
    ├── onu.types.ts       OnuNormalized, OnuPollRequest, optical/traffic
    └── alarm.types.ts     AlarmNormalized, AlarmFilter, severity/type enums
```

---

## Key Design Decisions

### Vendor Adapter Interface
Every vendor adapter implements `VendorAdapter` with three methods:
- `pollOlt()` — device-level info, hardware, boards
- `pollOnu()` — per-ONU optical, traffic, status
- `pollAlarms()` — active alarm list

All return normalized types so the service layer is vendor-agnostic.

### Polling Intervals

| Target         | Default  | Env var                  |
|---------------|----------|--------------------------|
| OLT system    | 45 s     | `POLL_OLT_INTERVAL_MS`   |
| ONU status    | 90 s     | `POLL_ONU_INTERVAL_MS`   |
| Alarm check   | 20 s     | `POLL_ALARM_INTERVAL_MS` |

Stagger offset spreads SNMP traffic across the interval window.

### Cache Layer
`TtlCache<T>` wraps `Map` with per-entry TTL and LRU eviction. Singleton caches:
- `oltCache` — max 1 000 entries
- `onuCache` — max 100 000 entries
- `alarmCache` — max 1 000 entries (keyed by deviceId)

Interface is compatible with a Redis adapter for horizontal scaling.

### Error Strategy
- Adapter errors surface as thrown `Error` with descriptive messages
- Services catch and classify: `DeviceUnreachable`, `AuthFailure`, `ParseError`
- API routes map error classes to HTTP status codes
- Failed polls increment a retry counter; after 3 failures the OLT is marked `unreachable`

---

## Supported Vendors (planned)

| Vendor   | Protocol      | Key Models                   | Status      |
|---------|---------------|------------------------------|-------------|
| Huawei  | SNMP v2c/v3   | MA5800-X7/X15, MA5600T       | Placeholder |
| ZTE     | SNMP v2c/v3   | C300, C320, C600             | Placeholder |
| BDCOM   | SNMP v2c      | P3310C, P3608                | Placeholder |
| VSOL    | SNMP v2c      | V1600G, V1600G4              | Placeholder |
| C-DATA  | SNMP v2c      | FD1616GS, FD8920             | Placeholder |
| Generic | SNMP v2c (RFC)| Any IF-MIB compliant device  | Placeholder |

---

## Adding a New Vendor

1. Create `adapters/<vendor>/<vendor>.adapter.ts` implementing `VendorAdapter`.
2. Register it in the app bootstrap: `adapterRegistry.register(new MyVendorAdapter())`.
3. Add the vendor string to the `OltVendor` union in `types/olt.types.ts`.
4. Document MIB OIDs and known firmware quirks in the adapter file header.

---

## Next Steps (implementation order)

1. **SNMP library** — add `net-snmp` or `snmp-native` as a dependency
2. **Huawei SNMP** — implement `HuaweiAdapter.pollOlt` + `pollOnu`
3. **DB schema** — `olts` table, `onus` table, `alarms` table (Drizzle ORM)
4. **PollingEngine.start()** — load OLTs from DB, register all
5. **API route wiring** — connect routes to service methods
6. **WebSocket** — emit live OLT/ONU/alarm events to the frontend
