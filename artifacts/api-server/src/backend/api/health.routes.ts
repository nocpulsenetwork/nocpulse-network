/**
 * Health API Routes — mounted at /api/health
 *
 * Returns server status, uptime, version, cache snapshot, and polling mode.
 * Designed to be called by load balancers, monitoring systems, and the
 * NOC dashboard status widget.
 *
 * Safe to call at any frequency — pure in-memory reads, no I/O.
 *
 * Endpoints:
 *   GET /api/health   →  full health object
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { pollingEngine } from "../core/polling-engine";
import { oltCache, onuCache, alarmCache } from "../core/cache";

export const healthRouter = Router();

const SERVER_START = Date.now();
const VERSION = "0.1.0-mock";

healthRouter.get("/", (_req: Request, res: Response) => {
  const uptimeMs = Date.now() - SERVER_START;

  res.json({
    status: "ok",
    version: VERSION,
    uptime: {
      ms: uptimeMs,
      seconds: Math.floor(uptimeMs / 1_000),
      human: formatUptime(uptimeMs),
    },
    cacheStatus: {
      olts: oltCache.size(),
      onus: onuCache.size(),
      alarms: alarmCache.size(),
    },
    pollingMode: "mock-safe",
    polling: pollingEngine.getPollingStatus(),
    timestamp: new Date().toISOString(),
  });
});

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1_000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
