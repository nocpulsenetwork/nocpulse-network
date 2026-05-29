/**
 * Polling API Routes — mounted at /api/polling
 *
 * Exposes per-OLT manual polling control and status.
 *
 * ─── Architecture note ───────────────────────────────────────────────────────
 *
 *   The frontend MUST read device data from the cache via REST endpoints.
 *   The frontend must NEVER poll OLT/ONU devices directly.
 *
 *   Correct flow:
 *     Frontend  →  GET /api/olts          (reads from TtlCache)
 *     Backend   →  PollingEngine          (writes to TtlCache on schedule)
 *     Backend   →  RealSnmpClient.pollX() (talks to real device)
 *
 *   Real SNMP device calls run exclusively through the PollingEngine's
 *   setInterval loops. This keeps OLT management plane load predictable and
 *   lets the backend absorb device timeouts without impacting the UI.
 *
 * ─── Polling mode ────────────────────────────────────────────────────────────
 *
 *   "manual-only": polling does NOT start on boot. A POST /api/polling/start
 *   with explicit credentials is required before any SNMP traffic is generated.
 *
 *   Safety: max 1 OLT polling at a time (MAX_CONCURRENT_OLTS in polling-engine).
 *   All SNMP calls are read-only GETs. No write commands. No auto-restart.
 *
 * ─── Endpoints ───────────────────────────────────────────────────────────────
 *
 *   POST /api/polling/start           → start polling one OLT (requires credentials)
 *   POST /api/polling/stop            → stop polling one OLT (requires oltId)
 *   GET  /api/polling/status          → engine status + all active sessions
 *   GET  /api/polling/status/:oltId   → status for one specific OLT
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { pollingEngine } from "../core/polling-engine";
import type { OltManualPollRequest } from "../core/polling-engine";

export const pollingRouter = Router();

// ── GET /api/polling/status — engine + all sessions ─────────────────────────
pollingRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    data: pollingEngine.getPollingStatus(),
    meta: { generatedAt: new Date().toISOString() },
  });
});

// ── GET /api/polling/status/:oltId — one OLT ────────────────────────────────
pollingRouter.get("/status/:oltId", (req: Request, res: Response) => {
  const oltId  = Array.isArray(req.params["oltId"]) ? req.params["oltId"][0] : req.params["oltId"];
  const status = pollingEngine.getOltPollingStatus(oltId ?? "");

  if (!status) {
    res.status(404).json({
      error: `No active polling session for OLT "${oltId}".`,
      code:  "NOT_FOUND",
      hint:  "Start polling first: POST /api/polling/start",
      meta:  { generatedAt: new Date().toISOString() },
    });
    return;
  }

  res.json({
    data: status,
    meta: { generatedAt: new Date().toISOString() },
  });
});

// ── POST /api/polling/start — start polling one OLT ─────────────────────────
//
// Required body fields:
//   oltId     — unique OLT identifier
//   ip        — OLT management IP address
//   vendor    — SNMP vendor name (Huawei | ZTE | BDCOM | VSOL | CDATA)
//   community — SNMP community string (defaults to "public" if omitted)
//
// Optional body fields:
//   port      — SNMP UDP port (defaults to 161)
//
// Safety guarantees (enforced in PollingEngine):
//   • Read-only SNMP GETs only — no SET, no write commands
//   • No polling faster than 30 s (MIN_INTERVAL_MS enforced in engine)
//   • Max 1 concurrent OLT session (returns 409 if limit is reached)
//   • No auto-start — this endpoint is the only entry point
//
// Polling intervals once started:
//   OLT status check → every  60 s   (first tick after 60 s)
//   ONU list check   → every 120 s   (first tick after 120 s)
//   Alarm check      → every  30 s   (first tick after 30 s)
pollingRouter.post("/start", (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  // ── Input validation ──────────────────────────────────────────────────────
  if (typeof body["oltId"] !== "string" || !body["oltId"].trim()) {
    res.status(400).json({
      error: "Missing required field: oltId",
      code:  "INVALID_INPUT",
    });
    return;
  }
  if (typeof body["ip"] !== "string" || !body["ip"].trim()) {
    res.status(400).json({
      error: "Missing required field: ip (OLT management IP address)",
      code:  "INVALID_INPUT",
    });
    return;
  }
  if (typeof body["vendor"] !== "string" || !body["vendor"].trim()) {
    res.status(400).json({
      error: "Missing required field: vendor (e.g. Huawei, ZTE, BDCOM, VSOL, CDATA)",
      code:  "INVALID_INPUT",
    });
    return;
  }

  const port = body["port"] !== undefined ? Number(body["port"]) : 161;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    res.status(400).json({
      error: "Invalid port: must be an integer between 1 and 65535",
      code:  "INVALID_INPUT",
    });
    return;
  }

  const request: OltManualPollRequest = {
    oltId:     (body["oltId"] as string).trim(),
    ip:        (body["ip"] as string).trim(),
    community: typeof body["community"] === "string" ? (body["community"] as string).trim() : "public",
    vendor:    (body["vendor"] as string).trim(),
    port,
  };

  const result = pollingEngine.startOltPolling(request);

  if (!result.success) {
    // 409 Conflict: already polling or limit reached
    // 400 Bad Request: bad input (engine will return for missing required fields)
    const status = result.message.includes("already being polled") || result.message.includes("Safety limit") ? 409 : 400;
    res.status(status).json({
      error:  result.message,
      code:   "POLLING_START_FAILED",
      data:   pollingEngine.getPollingStatus(),
      meta:   { generatedAt: new Date().toISOString() },
    });
    return;
  }

  const oltStatus = pollingEngine.getOltPollingStatus(request.oltId);

  res.status(201).json({
    data: {
      message: result.message,
      session: oltStatus,
    },
    engine: pollingEngine.getPollingStatus(),
    meta: {
      generatedAt: new Date().toISOString(),
      warning: [
        "Polling is read-only SNMP GETs only — no write commands will be issued.",
        "First OLT status tick fires in 60 s, ONU list in 120 s, alarm check in 30 s.",
        "Session auto-suspends after 3 consecutive SNMP failures.",
      ],
    },
  });
});

// ── POST /api/polling/stop — stop polling one OLT ───────────────────────────
//
// Required body fields:
//   oltId — OLT identifier to stop
//
// Returns 404 if no session is active for the given oltId.
pollingRouter.post("/stop", (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  if (typeof body["oltId"] !== "string" || !body["oltId"].trim()) {
    res.status(400).json({
      error: "Missing required field: oltId",
      code:  "INVALID_INPUT",
    });
    return;
  }

  const oltId  = (body["oltId"] as string).trim();
  const result = pollingEngine.stopOltPolling(oltId);

  if (!result.success) {
    res.status(404).json({
      error: result.message,
      code:  "NOT_FOUND",
      hint:  "Check GET /api/polling/status for active sessions.",
      data:  pollingEngine.getPollingStatus(),
      meta:  { generatedAt: new Date().toISOString() },
    });
    return;
  }

  res.json({
    data: {
      message: result.message,
    },
    engine: pollingEngine.getPollingStatus(),
    meta:   { generatedAt: new Date().toISOString() },
  });
});
