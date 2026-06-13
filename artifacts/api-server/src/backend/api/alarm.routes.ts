/**
 * Alarm API Routes — mounted at /api/alarms
 *
 * Single source of truth: all alarm data flows from the same live caches
 * that the OLT/ONU discovery and health-poll endpoints write to.
 *
 * ─── Endpoints ────────────────────────────────────────────────────────────────
 *   GET    /api/alarms                     active + acknowledged alarms
 *   GET    /api/alarms/summary             severity count KPI totals
 *   GET    /api/alarms/history             cleared alarms (paginated)
 *   GET    /api/alarms/device/:deviceId    alarms for a specific OLT or ONU
 *   GET    /api/alarms/:id                 single alarm detail
 *   POST   /api/alarms/:id/acknowledge     acknowledge alarm (by: string in body)
 *   POST   /api/alarms/:id/clear           manually clear alarm (NOC override)
 *
 * ─── Data sources ─────────────────────────────────────────────────────────────
 *   OLTs → oltHealthCache (keyed by OLT ID) from POST /api/olts/poll-health
 *   ONUs → onuDiscoveryCache (keyed by OLT ID) from POST /api/olts/discover-onus
 *   These are the SAME caches that /api/olts/:id/health and /api/olts/:id/onus/real use.
 *   No snapshot stores, no polling engine, no mock data.
 *
 * ─── Reconcile strategy ──────────────────────────────────────────────────────
 *   Each GET request runs reconcile() before returning data.
 *   reconcile reads from in-memory Maps (O(n)) and never writes SNMP.
 *   Cost: ~1 ms for hundreds of ONUs.
 *
 * ─── ONU offline alarm grouping ───────────────────────────────────────────────
 *   ONE alarm per OLT for offline ONUs, never one per ONU.
 *   e.g. "CDATA-01: 213 ONUs Offline" — avoids flooding the alarm center.
 *   Individual threshold alarms (RX power, temperature) are still raised per ONU.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { alarmStore } from "../core/alarm-store";
import {
  detectOltHealthAlarms,
  detectOnuGroupAlarms,
} from "../services/alarm-detector";
import {
  onuDiscoveryCache,
  oltHealthCache,
  oltConnectionCache,
} from "./olt.routes";
import type { ApiError } from "../types/universal.types";
import type { DetectedAlarm } from "../services/alarm-detector";

export const alarmRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive alarms from the live discovery + health caches.
 * This is the single source of truth — same data the frontend OLT/ONU
 * endpoints serve. If no discovery has been run yet, returns [].
 */
function detectFromLiveCaches(): DetectedAlarm[] {
  const alarms: DetectedAlarm[] = [];
  const now = Date.now();

  for (const [oltId, conn] of oltConnectionCache.entries()) {
    // ── OLT health alarms (temp / CPU / mem) ──────────────────────────────
    const healthEntry = oltHealthCache.get(oltId);
    if (healthEntry && now < healthEntry.expiresAt) {
      alarms.push(...detectOltHealthAlarms(oltId, conn.ip, healthEntry.result));
    }

    // ── ONU grouped offline + individual threshold alarms ─────────────────
    const discovery = onuDiscoveryCache.get(oltId);
    if (discovery?.hasData) {
      // Use the OLT's sysName (if captured at discovery) as the label.
      // Falls back to the OLT ID so the alarm is always human-readable.
      const oltLabel = discovery.sysName?.trim() || oltId;
      alarms.push(...detectOnuGroupAlarms(oltId, oltLabel, discovery));
    }
  }

  return alarms;
}

/** Run alarm detection + reconcile against the alarm store. Safe to call on every request. */
function runReconcile(): boolean {
  if (oltConnectionCache.size === 0) return false; // no managed OLTs yet
  const detected = detectFromLiveCaches();
  alarmStore.reconcile(detected);
  return true;
}

function jsonMeta(source: string) {
  return { source, generatedAt: new Date().toISOString() };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/alarms — active + acknowledged alarms
// Supports ?status=active|acknowledged  ?severity=critical|warning|info  ?deviceId=…
alarmRouter.get("/", (req: Request, res: Response) => {
  const hasData = runReconcile();
  const { status, severity, deviceId } = req.query as Record<string, string | undefined>;

  let results = alarmStore.getActive();

  if (status)   results = results.filter((a) => a.status === status);
  if (severity) results = results.filter((a) => a.severity === severity);
  if (deviceId) results = results.filter(
    (a) => a.deviceId === deviceId || a.oltId === deviceId || a.onuId === deviceId,
  );

  res.json({
    data: results,
    meta: {
      total: results.length,
      page: 1,
      pageSize: results.length,
      ...jsonMeta(hasData ? "live" : "no-data"),
    },
  });
});

// GET /api/alarms/summary — severity count totals for KPI cards
alarmRouter.get("/summary", (_req: Request, res: Response) => {
  runReconcile();
  res.json({
    data: alarmStore.summary(),
    meta: jsonMeta("live"),
  });
});

// GET /api/alarms/history — cleared alarms (paginated)
alarmRouter.get("/history", (req: Request, res: Response) => {
  const limit  = Math.min(500, parseInt((req.query as Record<string, string>)["limit"]  ?? "100", 10));
  const offset =              parseInt((req.query as Record<string, string>)["offset"] ?? "0",   10);
  const results = alarmStore.getHistory(limit, offset);
  res.json({
    data: results,
    meta: {
      total: results.length,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      ...jsonMeta("live"),
    },
  });
});

// GET /api/alarms/device/:deviceId — alarms for a specific OLT or ONU
alarmRouter.get("/device/:deviceId", (req: Request, res: Response) => {
  runReconcile();
  const { deviceId } = req.params;
  const results = alarmStore.getAll().filter(
    (a) => a.deviceId === deviceId || a.oltId === deviceId || a.onuId === deviceId,
  );
  res.json({
    data: results,
    meta: { total: results.length, page: 1, pageSize: results.length, ...jsonMeta("live") },
  });
});

// GET /api/alarms/:id — single alarm detail
alarmRouter.get("/:id", (req: Request, res: Response) => {
  const alarm = alarmStore.get(req.params["id"] as string);
  if (!alarm) {
    const err: ApiError = { error: "Alarm not found", code: "ALARM_NOT_FOUND" };
    res.status(404).json(err);
    return;
  }
  res.json({ data: alarm, meta: jsonMeta("live") });
});

// POST /api/alarms/:id/acknowledge — acknowledge alarm
alarmRouter.post("/:id/acknowledge", (req: Request, res: Response) => {
  const by = (req.body as { by?: string })?.by ?? "noc-operator";
  const alarm = alarmStore.acknowledge(req.params["id"] as string, by);
  if (!alarm) {
    const err: ApiError = { error: "Alarm not found or not in active state", code: "ALARM_NOT_FOUND" };
    res.status(404).json(err);
    return;
  }
  res.json({ data: alarm, meta: jsonMeta("live") });
});

// POST /api/alarms/:id/clear — manual NOC clear
alarmRouter.post("/:id/clear", (req: Request, res: Response) => {
  const by = (req.body as { by?: string })?.by ?? "noc-operator";
  const alarm = alarmStore.manualClear(req.params["id"] as string, by);
  if (!alarm) {
    const err: ApiError = { error: "Alarm not found or already cleared", code: "ALARM_NOT_FOUND" };
    res.status(404).json(err);
    return;
  }
  res.json({ data: alarm, meta: jsonMeta("live") });
});
