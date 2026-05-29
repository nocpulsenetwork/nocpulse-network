/**
 * Export Routes — mounted at /api/export
 *
 * Read-only CSV downloads. No background process, no direct OLT calls,
 * no permanent files. Data comes from the in-memory snapshot stores when
 * available, falling back to mock data when no poll has run yet.
 *
 * Endpoints:
 *   GET /api/export/olts.csv
 *   GET /api/export/onus.csv
 *   GET /api/export/alarms.csv
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { oltListStore, onuListStore, alarmListStore } from "../core/snapshot-store";
import { MOCK_OLTS, MOCK_ONUS } from "../mock/mock-data";
import { detectAllAlarms } from "../services/alarm-detector";
import type { UniversalOLT, UniversalONU } from "../types/universal.types";
import type { DetectedAlarm } from "../services/alarm-detector";

export const exportRouter = Router();

// ─── CSV helpers ────────────────────────────────────────────────────────────

/** Escape a single cell value: wrap in quotes if it contains comma, quote, or newline. */
function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from a header row and an array of row arrays. */
function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const header = headers.map(csvCell).join(",");
  const body   = rows.map(row => row.map(csvCell).join(",")).join("\n");
  return rows.length > 0 ? `${header}\n${body}\n` : `${header}\n`;
}

/** Set response headers for a CSV file download. */
function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(csv);
}

// ─── OLT export ─────────────────────────────────────────────────────────────

exportRouter.get("/olts.csv", (_req: Request, res: Response) => {
  const olts: UniversalOLT[] = oltListStore.read("all")?.data ?? MOCK_OLTS;

  const headers = ["oltId", "name", "vendor", "ip", "status", "lastUpdated"];

  const rows = olts.map(o => [
    o.id,
    o.name,
    o.vendor,
    o.ipAddress,
    o.status,
    o.lastPolled,
  ]);

  sendCsv(res, "olts.csv", buildCsv(headers, rows));
});

// ─── ONU export ─────────────────────────────────────────────────────────────

exportRouter.get("/onus.csv", (_req: Request, res: Response) => {
  const onus: UniversalONU[] = onuListStore.read("all")?.data ?? MOCK_ONUS;

  const headers = [
    "onuId", "name", "status", "mac", "serial", "vlan",
    "pppoeUsername", "rxPower", "txPower", "distance", "uptime",
    "totalUsage", "oltId",
  ];

  const rows = onus.map(o => [
    o.id,
    o.name,
    o.status,
    o.mac,
    o.serial,
    o.vlan,
    "",                 // pppoeUsername — not in UniversalONU
    o.rxPower,
    o.txPower,
    o.distance,
    o.uptime,
    "",                 // totalUsage — not in UniversalONU
    o.oltId,
  ]);

  sendCsv(res, "onus.csv", buildCsv(headers, rows));
});

// ─── Alarm export ────────────────────────────────────────────────────────────

exportRouter.get("/alarms.csv", (_req: Request, res: Response) => {
  const alarms: DetectedAlarm[] =
    alarmListStore.read("all")?.data ?? detectAllAlarms(MOCK_OLTS, MOCK_ONUS);

  const headers = ["id", "oltId", "onuId", "type", "severity", "title", "message", "createdAt"];

  const rows = alarms.map(a => [
    a.id,
    a.oltId,
    a.onuId,
    a.type,
    a.severity,
    a.title,
    a.message,
    a.createdAt,
  ]);

  sendCsv(res, "alarms.csv", buildCsv(headers, rows));
});
