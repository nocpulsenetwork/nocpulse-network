/**
 * OLT API Routes — /api/olts
 *
 * All routes return JSON. Errors follow { error: string, code: string } shape.
 *
 * Planned endpoints:
 *   GET    /api/olts              → list all OLTs
 *   GET    /api/olts/:id          → single OLT detail
 *   POST   /api/olts              → add new OLT (provision)
 *   PATCH  /api/olts/:id          → update OLT record
 *   DELETE /api/olts/:id          → remove OLT
 *   POST   /api/olts/:id/refresh  → force immediate poll
 *
 * TODO:
 *  - Wire to oltService methods
 *  - Add input validation (Zod schemas)
 *  - Add role-based access control middleware
 *  - Add request/response logging
 */

import { Router } from "express";
import type { Request, Response } from "express";

export const oltRouter = Router();

oltRouter.get("/", (_req: Request, res: Response) => {
  // TODO: oltService.getAll()
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

oltRouter.get("/:id", (req: Request, res: Response) => {
  // TODO: oltService.getById(req.params.id)
  void req.params["id"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

oltRouter.post("/", (_req: Request, res: Response) => {
  // TODO: validate body, oltService.create(dto)
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

oltRouter.patch("/:id", (req: Request, res: Response) => {
  // TODO: validate body, oltService.update(req.params.id, dto)
  void req.params["id"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

oltRouter.delete("/:id", (req: Request, res: Response) => {
  // TODO: oltService.remove(req.params.id)
  void req.params["id"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

oltRouter.post("/:id/refresh", (req: Request, res: Response) => {
  // TODO: oltService.forceRefresh(req.params.id)
  void req.params["id"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});
