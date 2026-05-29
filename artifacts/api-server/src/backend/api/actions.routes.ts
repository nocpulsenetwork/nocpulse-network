/**
 * ONU Action Routes — mounted at /api/actions
 *
 * SIMULATION ONLY. No SNMP writes. No real device commands.
 * No ONU state changes. No background processes.
 *
 * These endpoints are placeholders for future reboot/disable/enable
 * operations that will be wired to real SNMP SET calls only after
 * VPS real-OLT testing is completed and safety checks are in place.
 *
 * Endpoints:
 *   POST /api/actions/reboot
 *   POST /api/actions/disable
 *   POST /api/actions/enable
 *
 * Request body:  { oltId, onuId, vendor, role }
 * Response:      { success, action, oltId, onuId, vendor, mode, timestamp, message }
 */

import { Router } from "express";
import type { Request, Response } from "express";

export const actionsRouter = Router();

// ─── Constants ───────────────────────────────────────────────────────────────

const SIMULATION_NOTE =
  "This is simulation only. Real command is disabled until VPS real OLT testing.";

const BLOCKED_ROLES = ["viewer"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActionRequestBody {
  oltId?: unknown;
  onuId?: unknown;
  vendor?: unknown;
  role?: unknown;
}

interface ActionResponse {
  success: boolean;
  action: string;
  oltId: string;
  onuId: string;
  vendor: string;
  mode: "simulation";
  timestamp: string;
  message: string;
}

// ─── Handler factory ─────────────────────────────────────────────────────────

function makeActionHandler(action: "reboot" | "disable" | "enable") {
  return (req: Request, res: Response): void => {
    const body = req.body as ActionRequestBody;

    const oltId  = typeof body.oltId  === "string" ? body.oltId.trim()  : "";
    const onuId  = typeof body.onuId  === "string" ? body.onuId.trim()  : "";
    const vendor = typeof body.vendor === "string" ? body.vendor.trim() : "";
    const role   = typeof body.role   === "string" ? body.role.trim().toLowerCase() : "";

    // Validate required fields
    if (!oltId || !onuId) {
      res.status(400).json({ error: "oltId and onuId are required", code: "MISSING_FIELDS" });
      return;
    }

    // Role check — Viewer is blocked
    if (BLOCKED_ROLES.includes(role)) {
      res.status(403).json({
        error: "Your role does not have permission to perform this action.",
        code: "ROLE_FORBIDDEN",
        role,
        action,
      });
      return;
    }

    const payload: ActionResponse = {
      success: true,
      action,
      oltId,
      onuId,
      vendor: vendor || "unknown",
      mode: "simulation",
      timestamp: new Date().toISOString(),
      message: SIMULATION_NOTE,
    };

    res.status(200).json(payload);
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

actionsRouter.post("/reboot",  makeActionHandler("reboot"));
actionsRouter.post("/disable", makeActionHandler("disable"));
actionsRouter.post("/enable",  makeActionHandler("enable"));
