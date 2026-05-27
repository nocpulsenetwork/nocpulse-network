import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { oltRouter } from "../backend/api/olt.routes";
import { onuRouter } from "../backend/api/onu.routes";
import { alarmRouter } from "../backend/api/alarm.routes";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/olts", oltRouter);
router.use("/onus", onuRouter);
router.use("/alarms", alarmRouter);

export default router;
