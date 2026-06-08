---
name: ONU ID format and context refresh
description: EasyPath ONU instance OID structure, stable ID generation, and how post-discovery context refresh works.
---

## ONU Instance OID structure (EasyPath FD1208S-B0)

The raw OID walking yields `col.{idx1}.{idx2}` where both idx1 and idx2 are large integers.
- Example: `col.1205.1354`
- Both vary per ONU, so the FULL compound `"idx1.idx2"` is the unique identifier.
- Previous code used only `String(idx1)` which caused duplicate IDs when multiple ONUs shared the same idx1.

## Stable ID generation

`onuId = "${idx1}.${idx2}"` (dots preserved in the data field).

For use in URLs, localStorage keys, and HTML element IDs, sanitise with `.replace(/\./g, "-")`:
- `id` field on `OnuDevice`: `"${oltId}-onu-${safeOnuId}"`
- Navigation target: `/onus/${oltId}-onu-${safeOnuId}`

For display only (OltDetail badge cards), show just the short part: `o.onuId.split(".")[1] ?? o.onuId`

## Context refresh after discovery

`ApiDataContext` exposes `refreshRealOnus(oltId: string): Promise<void>` via `ApiDataContextValue`.
- Implemented with `useCallback` in `ApiDataProvider`.
- Calls `fetchRealOnusForOlt(oltId)`, replaces all real ONUs for that OLT in state, and rebuilds metrics.
- `OltDetail.handleDiscoverOnus()` calls `void refreshRealOnus(managed.id)` after `setRealOnus(j.data)` so that ONU Management, search, and other pages immediately see the newly discovered ONUs.

**Why:** Without this call, OLT Detail would show real ONUs but ONU Management would still show only mock data until the page reloaded.

## Physical port count

`readEasyPathPhysicalPorts()` walks `ifDescr` (1.3.6.1.2.1.2.2.1.2) with BATCH=20, counts entries matching `/pon|epon|gpon/i`. Returns 0 on failure. Result stored as `physicalPortCount?: number` in `OnuDiscoveryResult`.

In `OltDetail`, `totalPorts = physicalPortCount ?? ponPortCount` so empty ports (no ONUs registered) are still shown.
