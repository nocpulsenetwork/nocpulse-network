/**
 * Alarm API Routes — /api/alarms
 *
 * Planned endpoints:
 *   GET    /api/alarms                       → list alarms (?status=active&severity=critical)
 *   GET    /api/alarms/:id                   → single alarm detail
 *   GET    /api/alarms/device/:deviceId      → alarms for a specific OLT or ONU
 *   GET    /api/alarms/summary               → severity counts (KPI card data)
 *   POST   /api/alarms/:id/acknowledge       → acknowledge alarm
 *   POST   /api/alarms/:id/clear             → manually clear alarm
 *
 * TODO:
 *  - Wire to alarmService methods
 *  - Add query param parsing + Zod validation
 *  - Add role-based access control (only NOC Admin can clear)
 *  - Add pagination + cursor support for history endpoint
 */

import { Router } from "express";
import type { Request, Response } from "express";

export const alarmRouter = Router();

alarmRouter.get("/", (_req: Request, res: Response) => {
  // TODO: parse ?status, ?severity, ?deviceId, ?from, ?to → alarmService.getHistory(filter)
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

alarmRouter.get("/summary", (_req: Request, res: Response) => {
  // TODO: alarmService.severityCount()
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

alarmRouter.get("/device/:deviceId", (req: Request, res: Response) => {
  // TODO: alarmService.getByDevice(req.params.deviceId)
  void req.params["deviceId"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

alarmRouter.get("/:id", (req: Request, res: Response) => {
  // TODO: look up single alarm from DB
  void req.params["id"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

alarmRouter.post("/:id/acknowledge", (req: Request, res: Response) => {
  // TODO: alarmService.acknowledge(req.params.id, req.user.id)
  void req.params["id"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});

alarmRouter.post("/:id/clear", (req: Request, res: Response) => {
  // TODO: alarmService.clearAlarm(req.params.id, req.user.id)
  void req.params["id"];
  res.status(501).json({ error: "Not implemented", code: "NOT_IMPLEMENTED" });
});
