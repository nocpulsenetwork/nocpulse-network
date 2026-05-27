/**
 * ONU API Routes — mounted at /api/onus
 *
 * Currently returns mock normalized data; swap MOCK_ONUS for
 * onuService calls once adapters are implemented.
 *
 * ─── Cache strategy ──────────────────────────────────────────────────────────
 *   GET /api/onus          → onuCache scan by oltId filter, DB fallback
 *   GET /api/onus/:id      → onuCache hit → DB → on-demand poll on miss
 *   POST /:id/refresh      → bypasses cache, writes fresh result to onuCache
 *   POST /:id/reset        → write op, serialized through per-OLT write queue
 *
 * ─── Queue safety ────────────────────────────────────────────────────────────
 *   rebootOnu and disableOnu are write operations. They are serialized through
 *   a single-concurrency queue per OLT to prevent simultaneous writes to the
 *   same device. A concurrent write returns 409 Conflict.
 *
 * ─── Planned endpoints ───────────────────────────────────────────────────────
 *   GET    /api/onus               list ONUs (?oltId=&status=&vlan=&q=)
 *   GET    /api/onus/:id           single ONU detail + optical + traffic
 *   POST   /api/onus/:id/refresh   force immediate poll
 *   POST   /api/onus/:id/reboot    send reboot command (requires CLI adapter)
 *   POST   /api/onus/:id/disable   admin-disable ONU port
 *   POST   /api/onus/:id/enable    re-enable ONU port
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { MOCK_ONUS } from "../mock/mock-data";
import type { ApiListResponse, ApiDetailResponse, ApiError } from "../types/universal.types";

export const onuRouter = Router();

const META_SOURCE = "mock" as const;

// GET /api/onus  — supports ?oltId=&status=&vlan=&q=
onuRouter.get("/", (req: Request, res: Response) => {
  const { oltId, status, vlan, q } = req.query as Record<string, string | undefined>;

  let results = [...MOCK_ONUS];

  if (oltId)  results = results.filter((o) => o.oltId === oltId);
  if (status) results = results.filter((o) => o.status === status);
  if (vlan)   results = results.filter((o) => o.vlan === Number(vlan));
  if (q) {
    const lq = q.toLowerCase();
    results = results.filter(
      (o) =>
        o.name.toLowerCase().includes(lq) ||
        o.serial.toLowerCase().includes(lq) ||
        o.mac.toLowerCase().includes(lq) ||
        o.ipAddress.includes(lq) ||
        o.description.toLowerCase().includes(lq),
    );
  }

  const body: ApiListResponse<typeof results[number]> = {
    data: results,
    meta: {
      total: results.length,
      page: 1,
      pageSize: results.length,
      source: META_SOURCE,
      generatedAt: new Date().toISOString(),
    },
  };
  res.json(body);
});

// GET /api/onus/:id
onuRouter.get("/:id", (req: Request, res: Response) => {
  const onu = MOCK_ONUS.find((o) => o.id === req.params["id"]);
  if (!onu) {
    const err: ApiError = { error: "ONU not found", code: "ONU_NOT_FOUND" };
    res.status(404).json(err);
    return;
  }
  const body: ApiDetailResponse<typeof onu> = {
    data: onu,
    meta: { source: META_SOURCE, generatedAt: new Date().toISOString() },
  };
  res.json(body);
});

// POST /api/onus/:id/refresh
onuRouter.post("/:id/refresh", (req: Request, res: Response) => {
  const onu = MOCK_ONUS.find((o) => o.id === req.params["id"]);
  if (!onu) {
    const err: ApiError = { error: "ONU not found", code: "ONU_NOT_FOUND" };
    res.status(404).json(err);
    return;
  }
  // TODO: onuService.forceRefresh — call real adapter and update cache
  const body: ApiDetailResponse<typeof onu> = {
    data: { ...onu, lastPolled: new Date().toISOString() },
    meta: { source: META_SOURCE, generatedAt: new Date().toISOString() },
  };
  res.json(body);
});

// POST /api/onus/:id/reboot
onuRouter.post("/:id/reboot", (req: Request, res: Response) => {
  // TODO: check adapter capabilities.onuReboot, serialize through write queue
  void req.params["id"];
  res.status(501).json({ error: "Not implemented — requires CLI adapter", code: "NOT_IMPLEMENTED" });
});

// POST /api/onus/:id/disable
onuRouter.post("/:id/disable", (req: Request, res: Response) => {
  // TODO: check adapter capabilities.onuDisable, serialize through write queue
  void req.params["id"];
  res.status(501).json({ error: "Not implemented — requires CLI adapter", code: "NOT_IMPLEMENTED" });
});

// POST /api/onus/:id/enable
onuRouter.post("/:id/enable", (req: Request, res: Response) => {
  // TODO: check adapter capabilities.onuDisable, serialize through write queue
  void req.params["id"];
  res.status(501).json({ error: "Not implemented — requires CLI adapter", code: "NOT_IMPLEMENTED" });
});
