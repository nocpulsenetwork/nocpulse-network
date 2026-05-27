/**
 * Polling API Routes — mounted at /api/polling
 *
 * Exposes the polling engine status and control surface.
 *
 * ─── Architecture note ───────────────────────────────────────────────────────
 *
 *   The frontend MUST read device data from the cache via REST endpoints.
 *   The frontend must NEVER poll OLT/ONU devices directly.
 *
 *   Correct flow:
 *     Frontend  →  GET /api/olts          (reads from TtlCache)
 *     Backend   →  PollingEngine          (writes to TtlCache on schedule)
 *     Backend   →  VendorAdapter.pollOlt  (talks to real device, future)
 *
 *   Real SNMP device calls will happen exclusively through the adapter queue
 *   inside PollingEngine. This prevents thundering-herd problems when many
 *   browser tabs are open, keeps OLT management plane load predictable, and
 *   lets the backend absorb device timeouts without impacting the UI.
 *
 * ─── Polling mode: "mock-safe" ───────────────────────────────────────────────
 *
 *   Current mode is "mock-safe":
 *     - startPolling() / stopPolling() are no-ops (safe to call)
 *     - No intervals are created
 *     - No device connections are made
 *     - CPU overhead: zero
 *
 *   When real SNMP adapters are ready, set pollingMode = "live" and
 *   startPolling() will activate the real PollingEngine timers.
 *
 * Endpoints:
 *   GET  /api/polling/status   →  current polling engine state
 *   POST /api/polling/start    →  start polling (no-op in mock-safe mode)
 *   POST /api/polling/stop     →  stop polling  (no-op in mock-safe mode)
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { pollingEngine } from "../core/polling-engine";

export const pollingRouter = Router();

// GET /api/polling/status
pollingRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    data: pollingEngine.getPollingStatus(),
    meta: {
      generatedAt: new Date().toISOString(),
    },
  });
});

// POST /api/polling/start — safe no-op in mock-safe mode
pollingRouter.post("/start", (_req: Request, res: Response) => {
  pollingEngine.start();
  res.json({
    data: pollingEngine.getPollingStatus(),
    message: "Polling start requested.",
    meta: { generatedAt: new Date().toISOString() },
  });
});

// POST /api/polling/stop — safe no-op in mock-safe mode
pollingRouter.post("/stop", (_req: Request, res: Response) => {
  pollingEngine.stop();
  res.json({
    data: pollingEngine.getPollingStatus(),
    message: "Polling stop requested.",
    meta: { generatedAt: new Date().toISOString() },
  });
});
