/**
 * Cache API Routes — mounted at /api/cache
 *
 * Serves frontend-safe snapshots of device data.
 * Each response includes: data, lastUpdated, source, stale.
 *
 * Fallback: if no snapshot exists (i.e. no manual poll has run yet),
 * mock data is returned with stale: true and source: "mock".
 *
 * ─── Endpoints ───────────────────────────────────────────────────────────────
 *   GET /api/cache/olts       — all OLT snapshots (or mock fallback)
 *   GET /api/cache/olts/:id   — single OLT snapshot (or mock fallback)
 *   GET /api/cache/onus       — all ONU snapshots (or mock fallback)
 *   GET /api/cache/alarms     — detected alarm snapshots (or mock fallback)
 *
 * Safety rules:
 *   - Read-only. No write, no SNMP, no background process.
 *   - Frontend must read from here. Never call OLT directly from frontend.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { MOCK_OLTS, MOCK_ONUS } from "../mock/mock-data";
import { detectAllAlarms } from "../services/alarm-detector";
import type { DetectedAlarm } from "../services/alarm-detector";
import type { Snapshot } from "../core/snapshot-store";
import {
  oltListStore,
  oltDetailStore,
  onuListStore,
  alarmListStore,
} from "../core/snapshot-store";
import type { UniversalOLT, UniversalONU, ApiError } from "../types/universal.types";

export const cacheRouter = Router();

const MOCK_SOURCE = "mock" as const;

// GET /api/cache/olts — full OLT list snapshot
cacheRouter.get("/olts", (_req: Request, res: Response) => {
  const snap = oltListStore.read("all");
  if (snap) {
    res.json(snap);
    return;
  }
  const fallback: Snapshot<UniversalOLT[]> = {
    data: MOCK_OLTS,
    lastUpdated: new Date().toISOString(),
    source: MOCK_SOURCE,
    stale: true,
  };
  res.json(fallback);
});

// GET /api/cache/olts/:id — single OLT snapshot
cacheRouter.get("/olts/:id", (req: Request, res: Response) => {
  const id = req.params["id"] as string;

  const snap = oltDetailStore.read(id);
  if (snap) {
    res.json(snap);
    return;
  }

  const olt = MOCK_OLTS.find((o) => o.id === id);
  if (!olt) {
    const err: ApiError = { error: "OLT not found", code: "OLT_NOT_FOUND" };
    res.status(404).json(err);
    return;
  }

  const fallback: Snapshot<UniversalOLT> = {
    data: olt,
    lastUpdated: new Date().toISOString(),
    source: MOCK_SOURCE,
    stale: true,
  };
  res.json(fallback);
});

// GET /api/cache/onus — full ONU list snapshot
cacheRouter.get("/onus", (_req: Request, res: Response) => {
  const snap = onuListStore.read("all");
  if (snap) {
    res.json(snap);
    return;
  }
  const fallback: Snapshot<UniversalONU[]> = {
    data: MOCK_ONUS,
    lastUpdated: new Date().toISOString(),
    source: MOCK_SOURCE,
    stale: true,
  };
  res.json(fallback);
});

// GET /api/cache/alarms — detected alarm list snapshot
cacheRouter.get("/alarms", (_req: Request, res: Response) => {
  const snap = alarmListStore.read("all");
  if (snap) {
    res.json(snap);
    return;
  }
  const alarms: DetectedAlarm[] = detectAllAlarms(MOCK_OLTS, MOCK_ONUS);
  const fallback: Snapshot<DetectedAlarm[]> = {
    data: alarms,
    lastUpdated: new Date().toISOString(),
    source: MOCK_SOURCE,
    stale: true,
  };
  res.json(fallback);
});
