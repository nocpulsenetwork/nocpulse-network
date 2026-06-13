---
name: Unified alarm store — Phase 12
description: Rules for the single-source-of-truth alarm engine; what generates false alarms and how to avoid them.
---

## Rules

**ApiDataContext initial state must use `alarms: []`** — NOT `mockAlarms`. Starting with mock alarms causes the badge to flicker (shows 5, then drops to real count). Empty initial state means the badge is 0 until the first API response.

**`detectOnuGroupAlarms` must NEVER generate offline ONU alarms** — "84 ONUs Offline" is a state-based reading, not a transition. Offline ONUs discovered at startup were already offline; they are not alarms. Generating them produces ~37 false positives. Rule: remove the grouped offline section entirely; only generate threshold alarms (RX power, temperature) for ONUs with `status === "online"`.

**OLT Detail alarm filter: `alarms.filter(a => a.deviceId === olt.id)`** — Works for both real and mock OLTs. The old `managed !== null ? [] : ...` guard prevented real OLTs from ever showing alarms — remove it.

**Why:**
- The alarm engine stores `deviceId = oltId ?? onuId ?? "system"` in `AlarmStore.reconcile()`.
- The frontend `transformAlarm` maps `deviceId: a.deviceId ?? a.oltId ?? a.onuId`.
- So `a.deviceId === olt.id` correctly matches OLT-level alarms for any OLT type.

**ONU Management alarm indicator** — filter by `a.alarmType === "low-rx-power" || a.alarmTitle?.startsWith("ONU")` to count ONU-specific active alarms from the real engine.

**Alarm bell / sidebar badge single source** — Both Navbar and Sidebar must use `useApiData().metrics.activeAlarms` (not `mockData.alarms`). The `isActiveAlarm` check: `alarmStatus === "active"` for backend alarms, `!acknowledged` for legacy mock alarms.
