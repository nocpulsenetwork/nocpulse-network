---
name: OLT test-connection API shape
description: Field names for POST /api/olts/test-connection — easy to mix up with snmpCommunity/snmpPort variant from spec doc
---

## Rule
`POST /api/olts/test-connection` (in `olt.routes.ts`) accepts:
- `ip` (string)
- `community` (string) — NOT `snmpCommunity`
- `port` (number) — NOT `snmpPort`
- `snmpVersion` (string, optional)
- `vendor` (string, optional hint)
- `timeoutMs` / `retries` (optional)

Response envelope: `{ data: { success, vendor, model, sysName, sysDescr, message, latencyMs, snmpVersion }, meta: { host, port, generatedAt, warning } }`

**Why:** The Phase 19 spec used `snmpCommunity`/`snmpPort` as field names, but the actual backend uses `community`/`port`. The frontend must use the backend's actual field names.

**How to apply:** Whenever the frontend calls this endpoint, use `community` and `port` as keys — not the spec's `snmpCommunity`/`snmpPort`. Read the response from `json.data.success`, `json.data.vendor`, etc.
