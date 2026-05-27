import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { healthRouter as apiHealthRouter } from "../backend/api/health.routes";
import { oltRouter } from "../backend/api/olt.routes";
import { onuRouter } from "../backend/api/onu.routes";
import { alarmRouter } from "../backend/api/alarm.routes";
import { pollingRouter } from "../backend/api/polling.routes";

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

export default router;
