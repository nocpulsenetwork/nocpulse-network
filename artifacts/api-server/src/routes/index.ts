import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { healthRouter as apiHealthRouter } from "../backend/api/health.routes";
import { oltRouter } from "../backend/api/olt.routes";
import { onuRouter } from "../backend/api/onu.routes";
import { alarmRouter } from "../backend/api/alarm.routes";
import { pollingRouter } from "../backend/api/polling.routes";
import { snmpTestRouter } from "../backend/api/snmp-test.routes";
import { cacheRouter } from "../backend/api/cache.routes";
import { exportRouter } from "../backend/api/export.routes";

const router: IRouter = Router();

// System health check (existing — used by load balancers)
router.use(healthRouter);

// Extended health — status, uptime, cache, polling mode
router.use("/health", apiHealthRouter);

// Device data — all read from TtlCache (populated by PollingEngine)
router.use("/olts", oltRouter);
router.use("/onus", onuRouter);
router.use("/alarms", alarmRouter);

// Polling engine control and status
router.use("/polling", pollingRouter);

// SNMP manual test endpoints — read-only, one-shot, no auto-polling
// POST /api/snmp/test  — quick connectivity probe
// POST /api/snmp/probe — full read-only system info collection
router.use("/snmp", snmpTestRouter);

// Snapshot cache — frontend-safe read-only data with staleness metadata
// GET /api/cache/olts, /api/cache/olts/:id, /api/cache/onus, /api/cache/alarms
router.use("/cache", cacheRouter);

// CSV export — read-only downloads, no background process, no device calls
// GET /api/export/olts.csv, /api/export/onus.csv, /api/export/alarms.csv
router.use("/export", exportRouter);

export default router;
