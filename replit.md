# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- **Frontend reads cache, never devices directly.** Frontend should read cached API data from `/api/cache/*`. Never call OLT directly from frontend. The `stale` flag tells the UI whether data is from a recent poll or a mock fallback.
- **Two-layer cache.** `TtlCache` (in `core/cache.ts`) stores raw SNMP-polled data for the polling engine. `SnapshotStore` (in `core/snapshot-store.ts`) wraps data with metadata (`lastUpdated`, `source`, `stale`) for the frontend cache API.
- **Alarm detection is pure/read-only.** `alarm-detector.ts` derives alarms from OLT/ONU data on every request — no SNMP, no DB, no background process.
- **No auto-polling.** The polling engine is manual-only (`POST /api/polling/start`). Max 1 concurrent OLT, minimum 30 s interval, auto-suspends after 3 consecutive failures.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
