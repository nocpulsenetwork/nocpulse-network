/**
 * Vendor Routes — mounted at /api/vendors
 *
 * Exposes the static vendor profile registry.
 * Read-only. No device connections. No background processes.
 *
 * Endpoints:
 *   GET /api/vendors          — list all vendor profiles
 *   GET /api/vendors/:vendor  — single vendor profile (case-insensitive)
 *                               Unknown vendors return the Custom fallback (200).
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { getAllVendorProfiles, getVendorProfile } from "../vendor/vendor-profiles";

export const vendorRouter = Router();

// GET /api/vendors
vendorRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    data: getAllVendorProfiles(),
    meta: {
      count: getAllVendorProfiles().length,
      generatedAt: new Date().toISOString(),
    },
  });
});

// GET /api/vendors/:vendor
vendorRouter.get("/:vendor", (req: Request, res: Response) => {
  const key = Array.isArray(req.params.vendor) ? (req.params.vendor[0] ?? "") : (req.params.vendor ?? "");
  const profile = getVendorProfile(key);
  res.json({
    data: profile,
    meta: { generatedAt: new Date().toISOString() },
  });
});
