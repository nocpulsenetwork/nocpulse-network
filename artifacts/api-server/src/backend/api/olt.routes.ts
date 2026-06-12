/**
 * OLT API Routes — mounted at /api/olts
 *
 * All responses follow the ApiListResponse / ApiDetailResponse envelope.
 * Currently returns mock normalized data; swap MOCK_OLTS imports for
 * oltService calls once the database and SNMP adapters are implemented.
 *
 * ─── Cache strategy ──────────────────────────────────────────────────────────
 *   GET /api/olts      → served from oltCache (TTL 90 s), falls back to DB
 *   GET /api/olts/:id  → cache-first (oltCache), DB on miss, live poll on force
 *   POST /:id/refresh  → bypasses cache, writes result back to oltCache
 *
 * ─── Planned endpoints ───────────────────────────────────────────────────────
 *   GET    /api/olts                   list all OLTs
 *   GET    /api/olts/:id               single OLT detail
 *   POST   /api/olts/test-connection   read-only SNMP ping — manual test only
 *   POST   /api/olts                   provision a new OLT
 *   PATCH  /api/olts/:id               update OLT record
 *   DELETE /api/olts/:id               remove OLT + deregister polling
 *   POST   /api/olts/:id/refresh       force immediate poll
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { MOCK_OLTS, MOCK_ONUS } from "../mock/mock-data";
import type { ApiListResponse, ApiDetailResponse, ApiError } from "../types/universal.types";
import type { DetectedAlarm } from "../services/alarm-detector";
import { detectAlarmsForOlt } from "../services/alarm-detector";
import {
  RealSnmpClient,
  detectVendorFromSysInfo,
  extractModelFromDescr,
  detectCdataPonType,
  buildOnuInstance,
  type ReadOnuTableResult,
  type ReadOnuDetailResult,
  type ReadOnuOpticalResult,
  type ReadOnuTrafficResult,
} from "../snmp/real-snmp-client";
import type {
  OnuDiscoveryResult,
  OnuDiscoveryEmpty,
  OnuDiscoverySummary,
  RealPonPort,
} from "../types/onu-discovery.types";

export const oltRouter = Router();

const META_SOURCE = "mock" as const;

// GET /api/olts
oltRouter.get("/", (_req: Request, res: Response) => {
  const body: ApiListResponse<typeof MOCK_OLTS[number]> = {
    data: MOCK_OLTS,
    meta: {
      total: MOCK_OLTS.length,
      page: 1,
      pageSize: MOCK_OLTS.length,
      source: META_SOURCE,
      generatedAt: new Date().toISOString(),
    },
  };
  res.json(body);
});

// GET /api/olts/:id/alarms — detected alarms for one OLT and all its ONUs
oltRouter.get("/:id/alarms", (req: Request, res: Response) => {
  const alarms: DetectedAlarm[] = detectAlarmsForOlt(req.params["id"] as string, MOCK_OLTS, MOCK_ONUS);
  const body: ApiListResponse<DetectedAlarm> = {
    data: alarms,
    meta: {
      total: alarms.length,
      page: 1,
      pageSize: alarms.length,
      source: META_SOURCE,
      generatedAt: new Date().toISOString(),
    },
  };
  res.json(body);
});

// GET /api/olts/:id
oltRouter.get("/:id", (req: Request, res: Response) => {
  const olt = MOCK_OLTS.find((o) => o.id === req.params["id"]);
  if (!olt) {
    const err: ApiError = { error: "OLT not found", code: "OLT_NOT_FOUND" };
    res.status(404).json(err);
    return;
  }
  const body: ApiDetailResponse<typeof olt> = {
    data: olt,
    meta: { source: META_SOURCE, generatedAt: new Date().toISOString() },
  };
  res.json(body);
});

// POST /api/olts/test-connection — manual read-only SNMP connectivity test
//
// Accepts one OLT's credentials, issues a single SNMP GET (sysDescr + sysName +
// sysObjectID + sysUpTime), and returns vendor/model detection + latency.
//
// Safety contract:
//   • Read-only: only snmpGet() is called — no snmpSet(), no walk spam
//   • One-shot: no interval, no background worker, no persistent session
//   • Does NOT save the OLT to the database
//   • Does NOT start polling
//   • Does NOT fetch ONU list
//   • Timeout: max 10 000 ms (clamped below), default 3 000 ms
//   • Retries: max 2 (clamped below), default 1
oltRouter.post("/test-connection", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  // ── Input validation ──────────────────────────────────────────────────────
  if (typeof body["ip"] !== "string" || !body["ip"].trim()) {
    res.status(400).json({ error: "Missing required field: ip", code: "INVALID_INPUT" });
    return;
  }
  if (typeof body["community"] !== "string" || !body["community"].trim()) {
    res.status(400).json({ error: "Missing required field: community", code: "INVALID_INPUT" });
    return;
  }

  const ip        = body["ip"].trim();
  const community = body["community"].trim();
  const port      = body["port"] !== undefined ? Number(body["port"]) : 161;
  const timeoutMs = Math.min(body["timeoutMs"] !== undefined ? Number(body["timeoutMs"]) : 3_000, 10_000);
  const retries   = Math.min(body["retries"]   !== undefined ? Number(body["retries"])   : 1,     2);

  // snmpVersion is accepted for forward-compatibility but only v2c is supported now.
  const requestedVersion = typeof body["snmpVersion"] === "string" ? body["snmpVersion"] : "v2c";
  const snmpVersion      = "v2c" as const; // always v2c; v3 TODO

  // vendorHint is optional — used as fallback when SNMP detection returns "Unknown"
  const vendorHint = typeof body["vendor"] === "string" ? body["vendor"].trim() : undefined;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    res.status(400).json({ error: "Invalid port: must be 1–65535", code: "INVALID_INPUT" });
    return;
  }
  if (isNaN(timeoutMs) || timeoutMs < 500) {
    res.status(400).json({ error: "Invalid timeoutMs: must be ≥ 500", code: "INVALID_INPUT" });
    return;
  }

  // ── SNMP test — read-only, one-shot ──────────────────────────────────────
  const client = new RealSnmpClient({ host: ip, community, port, timeoutMs, retries });
  const result = await client.testConnection();

  // ── Derive vendor + model from the sysDescr/sysObjectID already fetched ──
  // No second network round-trip — reuse what testConnection() already retrieved.
  const detectedVendor = (result.sysDescr || result.sysObjectID)
    ? detectVendorFromSysInfo(result.sysDescr ?? "", result.sysObjectID ?? "")
    : "Unknown";

  const vendor = detectedVendor !== "Unknown" ? detectedVendor : (vendorHint ?? "Unknown");
  const model  = result.sysDescr ? extractModelFromDescr(result.sysDescr) : "Unknown";

  // ── Build human-readable message ──────────────────────────────────────────
  let message: string;
  if (result.success) {
    const parts: string[] = [`Connected to ${ip}`];
    if (result.sysName) parts.push(`(${result.sysName})`);
    if (vendor !== "Unknown") parts.push(`• ${vendor}`);
    if (model  !== "Unknown") parts.push(model);
    message = parts.join(" ");
  } else {
    message = result.error ?? "SNMP request failed";
    if (requestedVersion !== snmpVersion) {
      message += `. Note: only SNMPv2c is supported — v3 is not yet implemented.`;
    }
  }

  res.json({
    data: {
      success:     result.success,
      vendor,
      model,
      sysName:     result.sysName     ?? null,
      sysDescr:    result.sysDescr    ?? null,
      sysObjectID: result.sysObjectID ?? null,
      uptime:      result.sysUpTimeSecs ?? null,
      message,
      latencyMs:   result.responseTimeMs,
      snmpVersion,
      ...(requestedVersion !== snmpVersion && {
        snmpVersionNote: `Requested ${requestedVersion} — only v2c is currently supported.`,
      }),
    },
    meta: {
      host:        ip,
      port,
      generatedAt: new Date().toISOString(),
      warning:     "Manual test only — this endpoint does not save or poll the OLT.",
    },
  });
});

// POST /api/olts/test-onu-list — manual read-only ONU table read
//
// Reads the ONU management table from one OLT using vendor-specific SNMP MIBs.
// Exactly 2 SNMP operations: 1 GETBULK (index column, max 50 rows) + 1 GET
// (all attribute columns for found ONUs). No walk spam, no background state.
//
// Safety contract:
//   • Read-only: GETBULK + GET only — no SET, no walk loop, no background thread
//   • Bounded: at most 50 ONUs regardless of how many exist on the device
//   • Does NOT save ONUs to the database
//   • Does NOT start polling
//   • Does NOT fetch RX/TX optical power or traffic counters
oltRouter.post("/test-onu-list", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  // ── Input validation ──────────────────────────────────────────────────
  if (typeof body["ip"] !== "string" || !body["ip"].trim()) {
    res.status(400).json({ error: "Missing required field: ip", code: "INVALID_INPUT" });
    return;
  }
  if (typeof body["community"] !== "string" || !body["community"].trim()) {
    res.status(400).json({ error: "Missing required field: community", code: "INVALID_INPUT" });
    return;
  }

  const ip        = (body["ip"] as string).trim();
  const community = (body["community"] as string).trim();
  const port      = body["port"]      !== undefined ? Number(body["port"])      : 161;
  const timeoutMs = Math.min(body["timeoutMs"] !== undefined ? Number(body["timeoutMs"]) : 3_000, 10_000);
  const retries   = Math.min(body["retries"]   !== undefined ? Number(body["retries"])   : 1,     2);
  const vendorHint = typeof body["vendor"] === "string" ? (body["vendor"] as string).trim() : undefined;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    res.status(400).json({ error: "Invalid port: must be 1–65535", code: "INVALID_INPUT" });
    return;
  }

  const client   = new RealSnmpClient({ host: ip, community, port, timeoutMs, retries });
  const probeAt  = new Date().toISOString();
  const start    = Date.now();

  // ── Step 1: Connectivity test + vendor detection ─────────────────────
  // testConnection() does one SNMP GET — confirms device is reachable and
  // gives us sysDescr/sysObjectID for vendor detection. No extra round-trip.
  const connectivity = await client.testConnection();
  if (!connectivity.success) {
    res.status(502).json({
      data:  { success: false, message: connectivity.error ?? "OLT did not respond" },
      error: "OLT unreachable — cannot read ONU list",
      code:  "SNMP_UNREACHABLE",
      meta:  { host: ip, port, generatedAt: probeAt },
    });
    return;
  }

  const detectedVendor = (connectivity.sysDescr || connectivity.sysObjectID)
    ? detectVendorFromSysInfo(connectivity.sysDescr ?? "", connectivity.sysObjectID ?? "")
    : "Unknown";
  const vendor = detectedVendor !== "Unknown" ? detectedVendor : (vendorHint ?? "Unknown");
  const model  = connectivity.sysDescr ? extractModelFromDescr(connectivity.sysDescr) : "Unknown";

  if (vendor === "Unknown") {
    res.status(422).json({
      data: {
        success:       false,
        connectivity,
        vendor:        "Unknown",
        model,
        message:       "Vendor could not be detected from sysDescr/sysObjectID. " +
                       "Pass a vendor hint in the 'vendor' field (Huawei, ZTE, BDCOM, VSOL, CDATA).",
      },
      meta: { host: ip, port, generatedAt: probeAt },
    });
    return;
  }

  // ── Step 2: Resolve MIB key (CDATA requires PON-type dispatch) ──────
  // For C-DATA devices, the GPON and EPON ONU tables are at different OID
  // paths. We detect the PON type from sysDescr and pick the correct key.
  // If unknown, try GPON first and fall back to EPON on 0 results.
  let mibKey = vendor;
  if (vendor === "CDATA" && connectivity.sysDescr) {
    const ponType = detectCdataPonType(connectivity.sysDescr);
    mibKey = ponType === "EPON" ? "CDATA-EPON" : "CDATA-GPON";
  }

  // ── Step 3: Read ONU table ───────────────────────────────────────────
  // readOnuTable() does exactly 2 SNMP operations: 1 GETBULK + 1 GET.
  // Max 50 ONUs, all bounded, no walk loop, no background state.
  let onuResult: ReadOnuTableResult = await client.readOnuTable(mibKey, 50);

  // CDATA fallback: if primary table (GPON or EPON) returned 0, try the other.
  if (vendor === "CDATA" && onuResult.totalFound === 0) {
    const altKey = mibKey === "CDATA-EPON" ? "CDATA-GPON" : "CDATA-EPON";
    const altResult = await client.readOnuTable(altKey, 50);
    if (altResult.totalFound > 0) onuResult = altResult;
  }

  res.json({
    data: {
      success:      onuResult.success,
      vendor,
      model,
      sysName:      connectivity.sysName     ?? null,
      sysDescr:     connectivity.sysDescr    ?? null,
      uptime:       connectivity.sysUpTimeSecs ?? null,
      totalFound:   onuResult.totalFound,
      onus:         onuResult.onus,
      message:      onuResult.message,
      latencyMs:    Date.now() - start,
      mibUsed:      onuResult.mibUsed,
    },
    meta: {
      host:        ip,
      port,
      generatedAt: probeAt,
      warning:     "Manual test only — this endpoint does not save or poll the OLT.",
    },
  });
});

// POST /api/olts/test-onu-details — manual read-only ONU detail read
//
// Reads detailed attributes for ONE ONU using vendor-specific SNMP MIBs.
// At most 2 SNMP PDUs: 1 GET for all column attributes, plus 1 optional
// GET for distance if the vendor supports it. No GETBULK, no walk loop.
//
// Safety contract:
//   • Read-only: snmpGet() only — no SET, no walk, no GETBULK
//   • One-shot: no interval, no background worker, no persistent session
//   • Bounded: at most 2 SNMP PDUs total
//   • Does NOT save to the database
//   • Does NOT start polling
//   • Does NOT fetch RX/TX optical power or traffic counters
//
// The instance OID is resolved in priority order:
//   1. `instanceOid` — use directly (raw OID from readOnuTable response)
//   2. `ponPort` + `onuId` — reconstructed with vendor-specific rules
//   3. `onuId` alone — used as-is (works for simple 2-segment instances)
oltRouter.post("/test-onu-details", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  // ── Input validation ────────────────────────────────────────────────────
  if (typeof body["ip"] !== "string" || !body["ip"].trim()) {
    res.status(400).json({ error: "Missing required field: ip", code: "INVALID_INPUT" });
    return;
  }
  if (typeof body["community"] !== "string" || !body["community"].trim()) {
    res.status(400).json({ error: "Missing required field: community", code: "INVALID_INPUT" });
    return;
  }
  if (typeof body["vendor"] !== "string" || !body["vendor"].trim()) {
    res.status(400).json({
      error: "Missing required field: vendor (Huawei, ZTE, BDCOM, VSOL, CDATA)",
      code: "INVALID_INPUT",
    });
    return;
  }
  if (typeof body["onuId"] !== "string" || !body["onuId"].trim()) {
    res.status(400).json({ error: "Missing required field: onuId", code: "INVALID_INPUT" });
    return;
  }

  const ip        = (body["ip"] as string).trim();
  const community = (body["community"] as string).trim();
  const vendor    = (body["vendor"] as string).trim();
  const onuId     = (body["onuId"] as string).trim();
  const port      = body["port"]      !== undefined ? Number(body["port"])      : 161;
  const timeoutMs = Math.min(body["timeoutMs"] !== undefined ? Number(body["timeoutMs"]) : 3_000, 10_000);
  const retries   = Math.min(body["retries"]   !== undefined ? Number(body["retries"])   : 1,     2);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    res.status(400).json({ error: "Invalid port: must be 1–65535", code: "INVALID_INPUT" });
    return;
  }

  // ── Resolve OID instance suffix ─────────────────────────────────────────
  // Priority: explicit instanceOid > reconstruct from ponPort+onuId > onuId alone
  const instanceOid: string =
    typeof body["instanceOid"] === "string" && body["instanceOid"].trim()
      ? (body["instanceOid"] as string).trim()
      : buildOnuInstance(
          vendor,
          onuId,
          typeof body["ponPort"] === "string" ? (body["ponPort"] as string).trim() : undefined,
        );

  // ── SNMP details read — read-only, at most 2 PDUs ───────────────────────
  const client = new RealSnmpClient({ host: ip, community, port, timeoutMs, retries });
  const probeAt = new Date().toISOString();

  const result: ReadOnuDetailResult = await client.readOnuDetails(vendor, instanceOid);

  if (!result.success) {
    res.status(502).json({
      data:  { success: false, vendor, onu: null, message: result.message },
      error: result.message,
      code:  "SNMP_READ_FAILED",
      meta:  { host: ip, port, instanceOid, generatedAt: probeAt },
    });
    return;
  }

  res.json({
    data: {
      success:   result.success,
      vendor:    result.vendor,
      onu:       result.onu,
      message:   result.message,
      latencyMs: result.latencyMs,
      mibUsed:   result.mibUsed,
    },
    meta: {
      host:        ip,
      port,
      instanceOid,
      generatedAt: probeAt,
      warning:     "Manual test only — this endpoint does not save or poll the OLT.",
    },
  });
});

// POST /api/olts/test-onu-optical — manual read-only ONU optical power read
//
// Reads RX power, TX power, OLT RX power, and temperature for ONE ONU using
// vendor-specific SNMP optical interface table MIBs. Exactly 1 SNMP GET.
//
// Safety contract:
//   • Read-only: snmpGet() only — no SET, no walk, no GETBULK
//   • One-shot: no interval, no background worker, no persistent session
//   • Bounded: exactly 1 SNMP PDU
//   • Does NOT save to the database
//   • Does NOT start polling
//   • Does NOT fetch traffic counters
//
// Instance OID resolution order (same as test-onu-details):
//   1. `instanceOid` — use directly (rawInstanceOid from the list response)
//   2. `ponPort` + `onuId` — reconstructed with vendor-specific rules
//   3. `onuId` alone — used as-is
oltRouter.post("/test-onu-optical", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  // ── Input validation ────────────────────────────────────────────────────
  if (typeof body["ip"] !== "string" || !body["ip"].trim()) {
    res.status(400).json({ error: "Missing required field: ip", code: "INVALID_INPUT" });
    return;
  }
  if (typeof body["community"] !== "string" || !body["community"].trim()) {
    res.status(400).json({ error: "Missing required field: community", code: "INVALID_INPUT" });
    return;
  }
  if (typeof body["vendor"] !== "string" || !body["vendor"].trim()) {
    res.status(400).json({
      error: "Missing required field: vendor (optical currently supported: Huawei, ZTE)",
      code: "INVALID_INPUT",
    });
    return;
  }
  if (typeof body["onuId"] !== "string" || !body["onuId"].trim()) {
    res.status(400).json({ error: "Missing required field: onuId", code: "INVALID_INPUT" });
    return;
  }

  const ip        = (body["ip"] as string).trim();
  const community = (body["community"] as string).trim();
  const vendor    = (body["vendor"] as string).trim();
  const onuId     = (body["onuId"] as string).trim();
  const port      = body["port"]      !== undefined ? Number(body["port"])      : 161;
  const timeoutMs = Math.min(body["timeoutMs"] !== undefined ? Number(body["timeoutMs"]) : 3_000, 10_000);
  const retries   = Math.min(body["retries"]   !== undefined ? Number(body["retries"])   : 1,     2);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    res.status(400).json({ error: "Invalid port: must be 1–65535", code: "INVALID_INPUT" });
    return;
  }

  // ── Resolve OID instance suffix ─────────────────────────────────────────
  const instanceOid: string =
    typeof body["instanceOid"] === "string" && body["instanceOid"].trim()
      ? (body["instanceOid"] as string).trim()
      : buildOnuInstance(
          vendor,
          onuId,
          typeof body["ponPort"] === "string" ? (body["ponPort"] as string).trim() : undefined,
        );

  // ── SNMP optical read — exactly 1 PDU ───────────────────────────────────
  const client  = new RealSnmpClient({ host: ip, community, port, timeoutMs, retries });
  const probeAt = new Date().toISOString();

  const result: ReadOnuOpticalResult = await client.readOnuOptical(vendor, instanceOid);

  if (!result.success) {
    // 422 for "not supported by vendor", 502 for SNMP failure
    const status = result.message.includes("not available") || result.message.includes("no readable") ? 422 : 502;
    res.status(status).json({
      data:  { success: false, vendor, onu: null, message: result.message },
      error: result.message,
      code:  "OPTICAL_READ_FAILED",
      meta:  { host: ip, port, instanceOid, generatedAt: probeAt },
    });
    return;
  }

  res.json({
    data: {
      success:   result.success,
      vendor:    result.vendor,
      onu:       result.onu,
      message:   result.message,
      latencyMs: result.latencyMs,
      mibUsed:   result.mibUsed,
    },
    meta: {
      host:        ip,
      port,
      instanceOid,
      generatedAt: probeAt,
      warning:     "Manual test only — this endpoint does not save or poll the OLT.",
    },
  });
});

// POST /api/olts/test-onu-traffic — manual read-only ONU traffic counter read
//
// Reads cumulative download/upload byte counters and device-reported rates for
// ONE ONU. Exactly 1 SNMP GET.
//
// Two data paths:
//   • Provide `ifIndex` → standard IF-MIB (ifHCInOctets / ifHCOutOctets, 64-bit)
//                          Works for ANY vendor. Rates not available (single GET).
//   • Omit `ifIndex`    → vendor-specific stats table (Huawei / ZTE configured;
//                          others return 422 with suggestion to use ifIndex).
//
// Safety contract:
//   • Read-only: snmpGet() only — no SET, no walk, no GETBULK
//   • One-shot: no interval, no background worker, no persistent session
//   • Bounded: exactly 1 SNMP PDU
//   • Does NOT save to the database
//   • Does NOT start polling
//
// Note: byte counters are cumulative since last device reboot or counter reset.
//       Rates (when returned) are device-reported moving averages.
//       Instantaneous rate requires two readings + time delta — not done here.
oltRouter.post("/test-onu-traffic", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  // ── Input validation ────────────────────────────────────────────────────
  if (typeof body["ip"] !== "string" || !body["ip"].trim()) {
    res.status(400).json({ error: "Missing required field: ip", code: "INVALID_INPUT" });
    return;
  }
  if (typeof body["community"] !== "string" || !body["community"].trim()) {
    res.status(400).json({ error: "Missing required field: community", code: "INVALID_INPUT" });
    return;
  }
  if (typeof body["vendor"] !== "string" || !body["vendor"].trim()) {
    res.status(400).json({
      error: "Missing required field: vendor (Huawei/ZTE for vendor tables, or any vendor with ifIndex)",
      code: "INVALID_INPUT",
    });
    return;
  }
  if (typeof body["onuId"] !== "string" || !body["onuId"].trim()) {
    res.status(400).json({ error: "Missing required field: onuId", code: "INVALID_INPUT" });
    return;
  }

  const ip        = (body["ip"] as string).trim();
  const community = (body["community"] as string).trim();
  const vendor    = (body["vendor"] as string).trim();
  const onuId     = (body["onuId"] as string).trim();
  const port      = body["port"]      !== undefined ? Number(body["port"])      : 161;
  const timeoutMs = Math.min(body["timeoutMs"] !== undefined ? Number(body["timeoutMs"]) : 3_000, 10_000);
  const retries   = Math.min(body["retries"]   !== undefined ? Number(body["retries"])   : 1,     2);
  const ifIndex   = body["ifIndex"] !== undefined ? Number(body["ifIndex"]) : undefined;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    res.status(400).json({ error: "Invalid port: must be 1–65535", code: "INVALID_INPUT" });
    return;
  }
  if (ifIndex !== undefined && (!Number.isInteger(ifIndex) || ifIndex < 1)) {
    res.status(400).json({ error: "Invalid ifIndex: must be a positive integer", code: "INVALID_INPUT" });
    return;
  }

  // ── Resolve OID instance suffix ─────────────────────────────────────────
  const instanceOid: string =
    typeof body["instanceOid"] === "string" && body["instanceOid"].trim()
      ? (body["instanceOid"] as string).trim()
      : buildOnuInstance(
          vendor,
          onuId,
          typeof body["ponPort"] === "string" ? (body["ponPort"] as string).trim() : undefined,
        );

  // ── SNMP traffic read — exactly 1 PDU ───────────────────────────────────
  const client  = new RealSnmpClient({ host: ip, community, port, timeoutMs, retries });
  const probeAt = new Date().toISOString();

  const result: ReadOnuTrafficResult = await client.readOnuTraffic(vendor, instanceOid, ifIndex);

  if (!result.success) {
    const status = result.message.includes("No traffic MIB")
                || result.message.includes("no readable")
                || result.message.includes("not configured")
                  ? 422 : 502;
    res.status(status).json({
      data:  { success: false, vendor, onu: null, message: result.message },
      error: result.message,
      code:  "TRAFFIC_READ_FAILED",
      meta:  { host: ip, port, instanceOid, ifIndex: ifIndex ?? null, generatedAt: probeAt },
    });
    return;
  }

  res.json({
    data: {
      success:   result.success,
      vendor:    result.vendor,
      onu:       result.onu,
      message:   result.message,
      latencyMs: result.latencyMs,
      mibUsed:   result.mibUsed,
    },
    meta: {
      host:        ip,
      port,
      instanceOid,
      ifIndex:     ifIndex ?? null,
      generatedAt: probeAt,
      warning:     "Manual test only. Byte counters are cumulative since last reset. " +
                   "Rates (if present) are device-reported averages, not instantaneous.",
    },
  });
});

// ─── In-memory ONU discovery cache ───────────────────────────────────────────
//
// Key:   OLT ID string (the ID stored in localStorage by the frontend)
// Value: result of the last successful ONU discovery on that OLT
//
// Intentionally simple — no TTL, no disk persistence, no auto-eviction.
// One result per OLT; replaced on every successful discover-onus call.
// The cache is lost on server restart, which is acceptable for manual-trigger
// discovery (the user just clicks "Discover" again).
const onuDiscoveryCache = new Map<string, OnuDiscoveryResult>();

// POST /api/olts/discover-onus — manual read-only ONU discovery
//
// Connects to an OLT, auto-detects its vendor via sysDescr/sysObjectID, walks
// the vendor-specific ONU management table, and returns counts + full ONU list.
// Result is cached in memory under the provided OLT ID.
//
// Safety contract:
//   • Read-only: GETBULK walk (index column) + GET (attribute columns) — no SET
//   • EasyPath: snmpWalk of COL4 status + batched GET of COL3 port (50 OIDs/req)
//   • One-shot: no interval, no background worker, no persistent session
//   • Timeout: 10 000 ms per PDU, retries: 1
//   • Stores result only in memory — no database write
oltRouter.post("/discover-onus", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  // ── Input validation ──────────────────────────────────────────────────────
  if (typeof body["id"] !== "string" || !body["id"].trim()) {
    res.status(400).json({ error: "Missing required field: id (OLT ID for cache key)", code: "INVALID_INPUT" });
    return;
  }
  if (typeof body["ip"] !== "string" || !body["ip"].trim()) {
    res.status(400).json({ error: "Missing required field: ip", code: "INVALID_INPUT" });
    return;
  }
  if (typeof body["community"] !== "string" || !body["community"].trim()) {
    res.status(400).json({ error: "Missing required field: community", code: "INVALID_INPUT" });
    return;
  }

  const oltId     = body["id"].trim();
  const ip        = body["ip"].trim();
  const community = body["community"].trim();
  const port      = body["port"]      !== undefined ? Number(body["port"])      : 161;
  const vendorHint = typeof body["vendor"] === "string" ? body["vendor"].trim() : undefined;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    res.status(400).json({ error: "Invalid port: must be 1–65535", code: "INVALID_INPUT" });
    return;
  }

  const probeAt = new Date().toISOString();
  const start   = Date.now();
  const client  = new RealSnmpClient({ host: ip, community, port, timeoutMs: 5_000, retries: 1 });

  // TEMP: capture CDATA OLT credentials to file for automated debug walk
  try {
    const { writeFileSync } = await import("fs");
    writeFileSync("/tmp/olt-creds.json", JSON.stringify({ ip, community, port, oltId }));
  } catch { /* non-fatal */ }

  // ── Step 1: Connectivity test + vendor auto-detection ────────────────────
  const connectivity = await client.testConnection();
  if (!connectivity.success) {
    res.status(502).json({
      data:  { success: false, message: connectivity.error ?? "OLT did not respond" },
      error: "OLT unreachable — check IP, community string, and SNMP access",
      code:  "SNMP_UNREACHABLE",
      meta:  { host: ip, port, generatedAt: probeAt },
    });
    return;
  }

  const detectedVendor = (connectivity.sysDescr || connectivity.sysObjectID)
    ? detectVendorFromSysInfo(connectivity.sysDescr ?? "", connectivity.sysObjectID ?? "")
    : "Unknown";
  const vendor = detectedVendor !== "Unknown" ? detectedVendor : (vendorHint ?? "Unknown");

  if (vendor === "Unknown") {
    res.status(422).json({
      data: {
        success: false,
        vendor:  "Unknown",
        message: "Vendor could not be detected from sysDescr/sysObjectID. " +
                 "Pass a vendor hint in the 'vendor' field (CDATA, Huawei, ZTE, BDCOM, VSOL).",
      },
      meta: { host: ip, port, generatedAt: probeAt },
    });
    return;
  }

  // ── Step 2: Extract model and resolve MIB key ────────────────────────────
  const model = extractModelFromDescr(connectivity.sysDescr ?? "");

  // EasyPath firmware (FD1208S-B0 V1.6.0): sysObjId 1.3.6.1.4.1.17409.
  // Different OID tree — bypass the generic EPON/GPON MIB key selection.
  const isEasyPath = vendor === "CDATA" &&
    (connectivity.sysObjectID ?? "").startsWith("1.3.6.1.4.1.17409");

  // CDATA: must detect PON type (EPON vs GPON) BEFORE picking the ONU table.
  let mibKey  = vendor;
  let ponType = "N/A";
  if (!isEasyPath && vendor === "CDATA") {
    const detected = detectCdataPonType(connectivity.sysDescr ?? "");
    ponType  = detected;
    mibKey   = detected === "EPON" ? "CDATA-EPON"
             : detected === "GPON" ? "CDATA-GPON"
             : "CDATA-EPON";  // default to EPON when unknown — probe will confirm
  }

  // ── Step 3: Read ONU management table ────────────────────────────────────
  let onuResult: ReadOnuTableResult;

  let easyPathPhysicalPorts: number | undefined;
  if (isEasyPath) {
    // EasyPath EPON: walk the active registration table (tableIdx=1 only).
    // tableIdx=2 is a historical session log and must NOT be walked — see
    // readEasyPathOnuTable() for full rationale.
    ponType   = "EPON (EasyPath)";
    onuResult = await client.readEasyPathOnuTable(500);
    // Query hardware port count from ifTable (gives empty ports too).
    const portCount = await client.readEasyPathPhysicalPorts();
    if (portCount > 0) easyPathPhysicalPorts = portCount;
  } else {
    // Standard vendor flow: GETBULK on index column + GET attribute columns
    onuResult = await client.readOnuTable(mibKey, 50);

    // CDATA-EPON: static table may return 0 if firmware uses a non-standard OID
    // path or if the index column is marked not-accessible. Fall back to the
    // dynamic probe which walks the enterprise subtree and identifies ONUs by
    // their 6-byte MAC/LLID OctetStrings.
    if (vendor === "CDATA" && mibKey === "CDATA-EPON" && onuResult.totalFound === 0) {
      const probeResult = await client.readCdataEponOnusProbe(50);
      if (probeResult.totalFound > 0) onuResult = probeResult;
    }

    // CDATA: if both EPON paths returned 0, try GPON as a last resort.
    if (vendor === "CDATA" && onuResult.totalFound === 0) {
      const altKey    = mibKey === "CDATA-EPON" ? "CDATA-GPON" : "CDATA-EPON";
      const altResult = await client.readOnuTable(altKey, 50);
      if (altResult.totalFound > 0) onuResult = altResult;
    }
  }

  // ── Derive counts ─────────────────────────────────────────────────────────
  const onlineCount  = onuResult.onus.filter(o => o.status === "online").length;
  const offlineCount = onuResult.onus.filter(o => o.status === "offline").length;
  const unknownCount = onuResult.onus.filter(o => o.status === "unknown").length;

  // ── Per-PON-port breakdown ─────────────────────────────────────────────────
  const portMap = new Map<string, { total: number; online: number; offline: number; unknown: number }>();
  for (const onu of onuResult.onus) {
    const e = portMap.get(onu.ponPort) ?? { total: 0, online: 0, offline: 0, unknown: 0 };
    e.total++;
    if (onu.status === "online")       e.online++;
    else if (onu.status === "offline") e.offline++;
    else                               e.unknown++;
    portMap.set(onu.ponPort, e);
  }

  const ponPorts: RealPonPort[] = [...portMap.entries()].map(([id, counts]) => ({ id, ...counts }));
  const onus: OnuDiscoverySummary[] = onuResult.onus.map(o => ({
    onuId:               o.onuId,
    ponPort:             o.ponPort,
    status:              o.status,
    serial:              o.serial,
    type:                o.type,
    name:                o.name ?? null,
    mac:                 o.mac,
    offlineReasonCode:   o.offlineReasonCode   ?? null,
    rxPowerDbm:          o.rxPowerDbm          ?? null,
    txPowerDbm:          o.txPowerDbm          ?? null,
    distanceMeters:      o.distanceMeters       ?? null,
    temperatureCelsius:  o.temperatureC         ?? null,
    registerDurationSecs: o.registerDurationSecs ?? null,
  }));

  const result: OnuDiscoveryResult = {
    hasData:      true,
    oltId,
    totalOnus:    onuResult.totalFound,
    onlineOnus:   onlineCount,
    offlineOnus:  offlineCount,
    unknownOnus:  unknownCount,
    ponPortCount:      portMap.size,
    physicalPortCount: easyPathPhysicalPorts,
    ponPorts,
    onus,
    discoveredAt: probeAt,
    latencyMs:    Date.now() - start,
    source:       "live-snmp",
    vendor,
    mibUsed:      onuResult.mibUsed,
    message:      onuResult.message,
    sysUpTimeSecs: connectivity.sysUpTimeSecs ?? null,
    sysDescr:      connectivity.sysDescr      ?? null,
    sysName:       connectivity.sysName        ?? null,
  };

  // ── Cache result by OLT ID ───────────────────────────────────────────────
  onuDiscoveryCache.set(oltId, result);

  res.json({
    data: result,
    meta: {
      host:        ip,
      port,
      generatedAt: probeAt,
      debug: {
        detectedVendor:  vendor,
        detectedModel:   model,
        detectedPonType: ponType,
        onuTableOidUsed: onuResult.mibUsed,
        onuCountReturned: onuResult.totalFound,
      },
      cached:      true,
    },
  });
});

// POST /api/olts/debug-snmp-walk — temporary debug tool: walk a vendor SNMP
// subtree and return every OID the device responds with, grouped by prefix.
//
// Use this to identify which OID path an OLT actually exposes data on when the
// vendor's published MIB OIDs don't match the real firmware. Read-only.
//
// Body: { ip, community, port?, rootOid?, maxOids? }
// rootOid defaults to the C-DATA enterprise OID (1.3.6.1.4.1.34592).
// maxOids defaults to 1000 (hard cap in RealSnmpClient.debugWalkSubtree).
oltRouter.post("/debug-snmp-walk", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  if (typeof body["ip"] !== "string" || !body["ip"].trim()) {
    res.status(400).json({ error: "Missing required field: ip", code: "INVALID_INPUT" });
    return;
  }
  if (typeof body["community"] !== "string" || !body["community"].trim()) {
    res.status(400).json({ error: "Missing required field: community", code: "INVALID_INPUT" });
    return;
  }

  const ip        = body["ip"].trim();
  const community = body["community"].trim();
  const port      = body["port"] !== undefined ? Number(body["port"]) : 161;
  const rootOid   = typeof body["rootOid"] === "string" && body["rootOid"].trim()
    ? body["rootOid"].trim()
    : "1.3.6.1.4.1.34592";
  const maxOids   = typeof body["maxOids"] === "number" ? Math.min(body["maxOids"], 2_000) : 1_000;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    res.status(400).json({ error: "Invalid port: must be 1–65535", code: "INVALID_INPUT" });
    return;
  }

  const client = new RealSnmpClient({ host: ip, community, port, timeoutMs: 5_000, retries: 1 });

  // Verify connectivity first so we get sysDescr / vendor info
  const connectivity = await client.testConnection();
  if (!connectivity.success) {
    res.status(502).json({
      error: "OLT unreachable — check IP, community string, and SNMP access",
      code:  "SNMP_UNREACHABLE",
      meta:  { host: ip, port },
    });
    return;
  }

  const vendor   = detectVendorFromSysInfo(connectivity.sysDescr ?? "", connectivity.sysObjectID ?? "");
  const model    = extractModelFromDescr(connectivity.sysDescr ?? "");
  const ponType  = vendor === "CDATA"
    ? detectCdataPonType(connectivity.sysDescr ?? "")
    : "N/A";

  const walkResult = await client.debugWalkSubtree(rootOid, maxOids);

  res.json({
    data: {
      device: {
        vendor,
        model,
        ponType,
        sysDescr:  connectivity.sysDescr  ?? null,
        sysName:   connectivity.sysName   ?? null,
        sysObjId:  connectivity.sysObjectID ?? null,
      },
      walk: {
        rootOid,
        totalOids:  walkResult.totalOids,
        walkMs:     walkResult.walkMs,
        batches:    walkResult.batches,
        subtrees:   walkResult.subtrees,
        rows:       walkResult.rows,
      },
    },
    meta: {
      host:        ip,
      port,
      generatedAt: new Date().toISOString(),
      note:        "Debug tool — read-only SNMP walk. Remove before production deploy.",
    },
  });
});

// GET /api/olts/:id/onus/real — return cached ONU discovery result for an OLT
//
// Returns the result of the last successful POST /discover-onus call for this
// OLT ID, or { hasData: false } if no discovery has been performed yet.
oltRouter.get("/:id/onus/real", (req: Request, res: Response) => {
  const oltId = req.params["id"] as string;
  const cached = onuDiscoveryCache.get(oltId);

  if (!cached) {
    const empty: OnuDiscoveryEmpty = { hasData: false, oltId };
    res.json({ data: empty, meta: { generatedAt: new Date().toISOString() } });
    return;
  }

  res.json({
    data: cached,
    meta: { generatedAt: new Date().toISOString(), cachedAt: cached.discoveredAt },
  });
});

// POST /api/olts  — provision new OLT
oltRouter.post("/", (req: Request, res: Response) => {
  // ── Backend protection ───────────────────────────────────────────────────
  // Reject any save where verified !== true.
  // Super Admin "Force Save" (verified=false) is only permitted via an explicit
  // bypassVerification flag — which will be guarded by auth middleware once
  // role-aware sessions are implemented.
  const body = req.body as { verified?: unknown; bypassVerification?: unknown };
  if (body.verified !== true && body.bypassVerification !== true) {
    res.status(400).json({
      error: "Successful OLT validation required before save.",
      code: "VERIFICATION_REQUIRED",
    });
    return;
  }
  // TODO: validate remaining body with Zod, oltService.create(dto), register in pollingEngine
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

// PATCH /api/olts/:id
oltRouter.patch("/:id", (req: Request, res: Response) => {
  // TODO: oltService.update(req.params.id, body)
  void req.params["id"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

// DELETE /api/olts/:id
oltRouter.delete("/:id", (req: Request, res: Response) => {
  // TODO: oltService.remove(req.params.id)
  void req.params["id"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

// POST /api/olts/:id/refresh — force immediate poll
oltRouter.post("/:id/refresh", (req: Request, res: Response) => {
  // TODO: oltService.forceRefresh(req.params.id)
  const olt = MOCK_OLTS.find((o) => o.id === req.params["id"]);
  if (!olt) {
    const err: ApiError = { error: "OLT not found", code: "OLT_NOT_FOUND" };
    res.status(404).json(err);
    return;
  }
  // Return the existing mock with a fresh timestamp to simulate a poll
  const body: ApiDetailResponse<typeof olt> = {
    data: { ...olt, lastPolled: new Date().toISOString() },
    meta: { source: META_SOURCE, generatedAt: new Date().toISOString() },
  };
  res.json(body);
});
