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
 *   GET    /api/olts              list all OLTs
 *   GET    /api/olts/:id          single OLT detail
 *   POST   /api/olts              provision a new OLT
 *   PATCH  /api/olts/:id          update OLT record
 *   DELETE /api/olts/:id          remove OLT + deregister polling
 *   POST   /api/olts/:id/refresh  force immediate poll
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { MOCK_OLTS } from "../mock/mock-data";
import type { ApiListResponse, ApiDetailResponse, ApiError } from "../types/universal.types";

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
