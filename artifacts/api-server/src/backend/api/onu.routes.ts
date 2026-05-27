/**
 * ONU API Routes — /api/onus
 *
 * Planned endpoints:
 *   GET    /api/onus              → list ONUs (filterable: ?oltId=&status=&vlan=&q=)
 *   GET    /api/onus/:id          → single ONU detail + optical + traffic
 *   POST   /api/onus/:id/refresh  → force immediate poll
 *   POST   /api/onus/:id/reset    → send reset command (future, CLI)
 *
 * TODO:
 *  - Wire to onuService methods
 *  - Add query param parsing + Zod validation
 *  - Add role-based access control middleware
 *  - Add pagination headers (X-Total-Count, Link)
 */

import { Router } from "express";
import type { Request, Response } from "express";

export const onuRouter = Router();

onuRouter.get("/", (_req: Request, res: Response) => {
  // TODO: parse ?oltId, ?status, ?vlan, ?q → onuService.search(filter)
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

onuRouter.get("/:id", (req: Request, res: Response) => {
  // TODO: onuService.getById(req.params.id)
  void req.params["id"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

onuRouter.post("/:id/refresh", (req: Request, res: Response) => {
  // TODO: onuService.forceRefresh(...)
  void req.params["id"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

onuRouter.post("/:id/reset", (req: Request, res: Response) => {
  // TODO: CLI adapter reset command (future feature)
  void req.params["id"];
  res.status(501).json({ error: "Not implemented — requires CLI adapter", code: "NOT_IMPLEMENTED" });
});
