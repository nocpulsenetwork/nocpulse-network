---
name: net-snmp getBulk 2D array
description: net-snmp v3 getBulk callback returns a mixed flat/nested structure that must be flattened before treating varbinds as a flat list.
---

## Rule

Always flatten the `getBulk` callback varbinds before use. Never pass them directly to code that expects `vb.oid` on every element.

## Why

The `getBulk` callback structure depends on `nonRepeaters`:
- Non-repeater OIDs (index < nonRepeaters): pushed as a **flat** `Varbind` at the top level
- Repeater OIDs (index >= nonRepeaters): pushed as **`Varbind[]`** (an inner array) at the top level, with further repetitions appended to that inner array

With `nonRepeaters=0` (all OIDs are repeaters) and 1 starting OID, the callback receives `[[vb0, vb1, ..., vbN]]`. Iterating and calling `.oid` on the outer array element gives `undefined` → TypeError.

With `nonRepeaters >= oids.length` (old broken form using 3-arg overload), all OIDs are non-repeaters → flat `[vb0]` → works by accident but maxRepetitions is never applied (defaults to 10 internally).

## How to apply

In `snmpGetBulk`, after receiving `varbinds` from the callback, normalize:

```typescript
const flat: snmp.Varbind[] = [];
for (const entry of varbinds as unknown as Array<snmp.Varbind | snmp.Varbind[]>) {
  if (Array.isArray(entry)) {
    flat.push(...entry);
  } else {
    flat.push(entry);
  }
}
resolve(flat);
```

This is already implemented in `snmpGetBulk` in `real-snmp-client.ts`.

## Correct call signature

```typescript
session.getBulk(
  startOids,        // oids
  0,                // nonRepeaters: 0 — all OIDs repeat
  maxRepetitions,   // actual max rows per OID
  callback,         // 4-arg form
);
```

The 3-arg form `getBulk(oids, nonRepeaters, callback)` silently defaults maxRepetitions to 10 and treats all oids up to `nonRepeaters` as non-repeaters. Never use it for walks.
