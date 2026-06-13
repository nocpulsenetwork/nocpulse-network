/**
 * Alarm API Routes — mounted at /api/alarms
 *
 * All responses are derived from live snapshot-store data fed through the
 * alarm detector and reconciled by AlarmStore. No mock data, no DB.
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
 * ─── Reconcile strategy ──────────────────────────────────────────────────────
 *   Each GET request runs reconcile() before returning data. This is safe:
 *   reconcile reads from snapshot stores (in-memory, O(n)) and never writes SNMP.
 *   Cost: ~1 ms for hundreds of ONUs.
 *
 * ─── Data sources ─────────────────────────────────────────────────────────────
 *   OLTs → oltDetailStore (keyed by oltId) or oltListStore ("all")
 *   ONUs → onuListStore   (keyed by oltId) or onuListStore ("all")
 *   If no snapshot data exists yet (no poll has run), returns empty arrays with
 *   source: "no-data" so the frontend shows an empty-but-honest alarm list.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { alarmStore } from "../core/alarm-store";
import { detectAllAlarms } from "../services/alarm-detector";
import {
  oltListStore,
  oltDetailStore,
  onuListStore,
} from "../core/snapshot-store";
import type { UniversalOLT, UniversalONU, ApiError } from "../types/universal.types";

export const alarmRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Collect current OLT + ONU data from all snapshot stores. */
function getLiveData(): { olts: UniversalOLT[]; onus: UniversalONU[] } {
  // OLTs — try the list store first, fall back to individual detail entries.
  let olts: UniversalOLT[] = [];
  const listSnap = oltListStore.read("all");
  if (listSnap?.data.length) {
    olts = listSnap.data;
  } else {
    for (const key of oltDetailStore.keys()) {
      const s = oltDetailStore.read(key);
      if (s?.data) olts.push(s.data);
    }
  }

  // ONUs — try the "all" key first, then per-OLT slices.
  let onus: UniversalONU[] = [];
  const onuAllSnap = onuListStore.read("all");
  if (onuAllSnap?.data.length) {
    onus = onuAllSnap.data;
  } else {
    for (const key of onuListStore.keys()) {
      if (key === "all") continue;
      const s = onuListStore.read(key);
      if (s?.data?.length) onus = onus.concat(s.data);
    }
  }

  return { olts, onus };
}

/** Run alarm detection + reconcile. Safe to call on every request. */
function runReconcile(): boolean {
  const { olts, onus } = getLiveData();
  if (olts.length === 0 && onus.length === 0) return false; // no data yet
  const detected = detectAllAlarms(olts, onus);
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
