---
name: ONU discovery architecture
description: How real ONU discovery works end-to-end — endpoints, caching, frontend integration
---

## Rule
`POST /api/olts/discover-onus` is the only write path for ONU discovery. It calls `RealSnmpClient.readOnuTable()` directly (not via adapter), caches the result in a per-process `Map<string, OnuDiscoveryResult>`, and returns the result. `GET /api/olts/:id/onus/real` reads from the same cache (or returns `{hasData: false}`).

**Why:** Architecture rule — frontend reads `/api/cache/*` or named endpoints, never SNMP devices directly. Discovery is always manual (no background polling). Cache is intentionally lost on restart (user clicks "Discover" again).

**How to apply:**
- `POST /discover-onus` must be declared BEFORE `POST /` in the router (literal before wildcard, though Express wouldn't confuse them in practice).
- `GET /:id/onus/real` is declared before `GET /:id` in the router file (same caution).
- Discovery result type: `OnuDiscoveryResult` from `types/onu-discovery.types.ts`.
- Frontend sends `{id, ip, community, port, vendor}` (vendor is a hint for fallback if auto-detect fails).
- Frontend reads cache on mount via `useEffect`, sets `realOnus` state.

## Key types
- `OnuDiscoveryResult` — full result (hasData: true)
- `OnuDiscoveryEmpty` — no data yet (hasData: false)
- Both live in `artifacts/api-server/src/backend/types/onu-discovery.types.ts`
