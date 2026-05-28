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
import { MOCK_OLTS } from "../mock/mock-data";
import type { ApiListResponse, ApiDetailResponse, ApiError } from "../types/universal.types";
import {
  RealSnmpClient,
  detectVendorFromSysInfo,
  extractModelFromDescr,
  type ReadOnuTableResult,
} from "../snmp/real-snmp-client";

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

  // ── Step 2: Read ONU table ───────────────────────────────────────────
  // readOnuTable() does exactly 2 SNMP operations: 1 GETBULK + 1 GET.
  // Max 50 ONUs, all bounded, no walk loop, no background state.
  const onuResult: ReadOnuTableResult = await client.readOnuTable(vendor, 50);

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

// POST /api/olts  — provision new OLT
oltRouter.post("/", (_req: Request, res: Response) => {
  // TODO: validate body with Zod, oltService.create(dto), register in pollingEngine
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
