/**
 * Alarm API Routes — mounted at /api/alarms
 *
 * Currently returns mock normalized data; swap MOCK_ALARMS for
 * alarmService calls once adapters and DB are implemented.
 *
 * ─── Cache strategy ──────────────────────────────────────────────────────────
 *   GET /api/alarms         → alarmCache (TTL 45 s), then DB
 *   GET /api/alarms/summary → aggregated from alarmCache; DB on miss
 *   Acknowledge / clear     → write to DB immediately, invalidate alarmCache
 *
 * ─── Polling strategy ────────────────────────────────────────────────────────
 *   The PollingEngine checks each OLT's alarm table every 20 s.
 *   Newly raised alarms emit "alarm:raised" events (WebSocket push, future).
 *   Cleared alarms emit "alarm:cleared" and are soft-deleted from the cache.
 *
 * ─── Planned endpoints ───────────────────────────────────────────────────────
 *   GET    /api/alarms                      list alarms (?status=&severity=&deviceId=)
 *   GET    /api/alarms/summary              severity count totals (KPI card data)
 *   GET    /api/alarms/device/:deviceId     alarms for a specific OLT or ONU
 *   GET    /api/alarms/:id                  single alarm detail
 *   POST   /api/alarms/:id/acknowledge      acknowledge alarm
 *   POST   /api/alarms/:id/clear            manually clear alarm (NOC override)
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { MOCK_ALARMS, MOCK_OLTS, MOCK_ONUS } from "../mock/mock-data";
import type { ApiListResponse, ApiDetailResponse, ApiError } from "../types/universal.types";
import type { DetectedAlarm } from "../services/alarm-detector";
import { detectAllAlarms } from "../services/alarm-detector";

export const alarmRouter = Router();

const META_SOURCE = "mock" as const;

// GET /api/alarms — alarms detected from all OLTs and ONUs
// Supports ?severity=critical|warning|info  ?oltId=  ?onuId=
alarmRouter.get("/", (req: Request, res: Response) => {
  const { severity, oltId, onuId } = req.query as Record<string, string | undefined>;

  let results: DetectedAlarm[] = detectAllAlarms(MOCK_OLTS, MOCK_ONUS);

  if (severity) results = results.filter((a) => a.severity === severity);
  if (oltId)    results = results.filter((a) => a.oltId === oltId);
  if (onuId)    results = results.filter((a) => a.onuId === onuId);

  const body: ApiListResponse<DetectedAlarm> = {
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

// GET /api/alarms/summary — severity count totals for KPI cards
alarmRouter.get("/summary", (_req: Request, res: Response) => {
  const active = MOCK_ALARMS.filter((a) => a.status === "active");
  const summary = {
    critical: active.filter((a) => a.severity === "critical").length,
    major:    active.filter((a) => a.severity === "major").length,
    minor:    active.filter((a) => a.severity === "minor").length,
    warning:  active.filter((a) => a.severity === "warning").length,
    info:     active.filter((a) => a.severity === "info").length,
    total:    active.length,
  };
  res.json({
    data: summary,
    meta: { source: META_SOURCE, generatedAt: new Date().toISOString() },
  });
});

// GET /api/alarms/device/:deviceId
alarmRouter.get("/device/:deviceId", (req: Request, res: Response) => {
  const results = MOCK_ALARMS.filter((a) => a.deviceId === req.params["deviceId"]);
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

// GET /api/alarms/:id
alarmRouter.get("/:id", (req: Request, res: Response) => {
  const alarm = MOCK_ALARMS.find((a) => a.id === req.params["id"]);
  if (!alarm) {
    const err: ApiError = { error: "Alarm not found", code: "ALARM_NOT_FOUND" };
    res.status(404).json(err);
    return;
  }
  const body: ApiDetailResponse<typeof alarm> = {
    data: alarm,
    meta: { source: META_SOURCE, generatedAt: new Date().toISOString() },
  };
  res.json(body);
});

// POST /api/alarms/:id/acknowledge
alarmRouter.post("/:id/acknowledge", (req: Request, res: Response) => {
  // TODO: alarmService.acknowledge(req.params.id, req.user?.id ?? "unknown")
  const alarm = MOCK_ALARMS.find((a) => a.id === req.params["id"]);
  if (!alarm) {
    const err: ApiError = { error: "Alarm not found", code: "ALARM_NOT_FOUND" };
    res.status(404).json(err);
    return;
  }
  const acknowledged = {
    ...alarm,
    status: "acknowledged" as const,
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: "noc-operator",
  };
  res.json({
    data: acknowledged,
    meta: { source: META_SOURCE, generatedAt: new Date().toISOString() },
  });
});

// POST /api/alarms/:id/clear
alarmRouter.post("/:id/clear", (req: Request, res: Response) => {
  // TODO: alarmService.clearAlarm(req.params.id, req.user?.id ?? "unknown")
  const alarm = MOCK_ALARMS.find((a) => a.id === req.params["id"]);
  if (!alarm) {
    const err: ApiError = { error: "Alarm not found", code: "ALARM_NOT_FOUND" };
    res.status(404).json(err);
    return;
  }
  const cleared = {
    ...alarm,
    status: "cleared" as const,
    clearedAt: new Date().toISOString(),
  };
  res.json({
    data: cleared,
    meta: { source: META_SOURCE, generatedAt: new Date().toISOString() },
  });
});
