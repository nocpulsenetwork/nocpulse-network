---
name: OltDetail real vs demo split
description: How OltDetail.tsx distinguishes real (managed) OLTs from demo OLTs and gates data accordingly
---

## Rule
`const isRealOlt = managed !== null` — this is the single discriminator. All data display branches off this.

**Why:** Demo OLTs have rich mock ONU data (connectedOnus, signal levels, etc.). Real OLTs have zero mock ONU connection (ID mismatch with mock data). Mixing them would show fake data on real devices.

**How to apply:**
- Summary cards: use `displayTotal/displayOnline/displayOffline/displayDegraded` vars (real → live SNMP counts or 0; demo → mock counts).
- PON port grid/table: use `displayPonPorts` (real + real data → `realPonPortsDisplay`; else → mock `ponPorts`).
- ONU Distribution chart: use `displayChartData` and `hasDisplayData` guard.
- ONU mini-cards section:
  - Real OLT, no discovery → "No real ONU data available yet" CTA
  - Real OLT, discovery done → simplified real ONU cards (onuId, ponPort, status, serial)
  - Demo OLT → existing mock ONU buttons with signal dBm
- "Discover ONUs" button lives inside the SNMP Verification card (only shown for managed OLTs).
- `realOnus` state is loaded from `GET /api/olts/:id/onus/real` on mount.
- Discovery timestamp displayed as `HH:mm:ss` using date-fns `format()`.
