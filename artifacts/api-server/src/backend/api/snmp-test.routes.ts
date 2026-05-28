/**
 * SNMP Test Routes — mounted at /api/snmp
 *
 * Manual-only endpoints for testing live OLT SNMP connectivity.
 * These endpoints NEVER run automatically — they only execute when
 * explicitly called by an operator or during development.
 *
 * ─── Safety rules ────────────────────────────────────────────────────────
 *
 *   - Read-only SNMP GET and GETBULK only — no SET operations
 *   - One-shot per request — no polling loops, no background workers
 *   - Timeout enforced at 3 s per request (configurable, max 10 s)
 *   - Single retry only (configurable, max 2)
 *   - Community string accepted from request body — never stored or logged
 *   - Results include timing info so operators can identify slow OLTs
 *
 * ─── Endpoints ───────────────────────────────────────────────────────────
 *
 *   POST /api/snmp/test
 *     Quick connectivity probe — sysDescr, sysName, sysUpTime, sysObjectID.
 *     Use for the "Test Connection" button on the OLT management page.
 *     Typical response time: 50–500 ms.
 *
 *   POST /api/snmp/probe
 *     Full read-only system information collection.
 *     Calls getSysInfo, getVendor, getModel, getPonPorts, getOnuListMockFallback.
 *     Typical response time: 500 ms – 5 s depending on interface count.
 *
 * ─── Request body (both endpoints) ──────────────────────────────────────
 *
 *   {
 *     "host":      "192.168.1.1",   required — OLT management IP
 *     "community": "public",        required — read-only community string
 *     "port":      161,             optional — default 161
 *     "timeoutMs": 3000,            optional — default 3 000, max 10 000
 *     "retries":   1,               optional — default 1, max 2
 *     "oltId":     "olt-001"        optional — used for mock ONU fallback filter
 *   }
 *
 * ─── NOT for production polling ──────────────────────────────────────────
 *
 *   Do not call /probe in a polling loop. Use the PollingEngine + VendorAdapter
 *   pipeline for scheduled polling. Calling /probe repeatedly would spam the
 *   OLT SNMP agent and is not rate-limited at this endpoint.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import {
  RealSnmpClient,
  SnmpTimeoutError,
  SnmpUnreachableError,
  detectVendorFromSysInfo,
  extractModelFromDescr,
} from "../snmp/real-snmp-client";

export const snmpTestRouter = Router();

// ─── Input types and validation ────────────────────────────────────────────

interface SnmpRequestBody {
  host?:      unknown;
  community?: unknown;
  port?:      unknown;
  timeoutMs?: unknown;
  retries?:   unknown;
  oltId?:     unknown;
}

interface ValidatedInput {
  host:      string;
  community: string;
  port:      number;
  timeoutMs: number;
  retries:   number;
  oltId?:    string;
}

function validateBody(body: SnmpRequestBody): ValidatedInput | { error: string } {
  if (typeof body.host !== "string" || !body.host.trim())
    return { error: "Missing required field: host (string, OLT management IP)" };
  if (typeof body.community !== "string" || !body.community.trim())
    return { error: "Missing required field: community (string, read-only SNMP community)" };

  const port = body.port !== undefined ? Number(body.port) : 161;
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return { error: "Invalid port: must be an integer between 1 and 65535" };

  const timeoutMs = body.timeoutMs !== undefined ? Number(body.timeoutMs) : 3_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 10_000)
    return { error: "Invalid timeoutMs: must be between 500 and 10000" };

  const retries = body.retries !== undefined ? Number(body.retries) : 1;
  if (!Number.isInteger(retries) || retries < 0 || retries > 2)
    return { error: "Invalid retries: must be 0, 1, or 2" };

  const oltId =
    typeof body.oltId === "string" && body.oltId.trim()
      ? body.oltId.trim()
      : undefined;

  return { host: body.host.trim(), community: body.community.trim(), port, timeoutMs, retries, oltId };
}

function snmpErrorCode(err: unknown): string {
  if (err instanceof SnmpTimeoutError)     return "SNMP_TIMEOUT";
  if (err instanceof SnmpUnreachableError) return "SNMP_UNREACHABLE";
  return "SNMP_ERROR";
}

// ─── POST /api/snmp/test ───────────────────────────────────────────────────
//
// Quick connectivity probe. Returns sysDescr, sysName, sysUpTime, sysObjectID.
// Never throws — errors are embedded in the response body with success=false.

snmpTestRouter.post("/test", async (req: Request, res: Response) => {
  const input = validateBody(req.body as SnmpRequestBody);
  if ("error" in input) {
    res.status(400).json({ error: input.error, code: "INVALID_INPUT" });
    return;
  }

  const client = new RealSnmpClient(input);

  try {
    const result = await client.testConnection();
    res.json({
      data: result,
      meta: { generatedAt: new Date().toISOString() },
    });
  } catch (err) {
    req.log?.error({ err }, "SNMP test connection threw unexpectedly");
    res.status(502).json({
      error:  err instanceof Error ? err.message : "SNMP request failed",
      code:   snmpErrorCode(err),
      detail: "The OLT did not respond. Check IP, community string, and firewall rules.",
    });
  }
});

// ─── POST /api/snmp/probe ──────────────────────────────────────────────────
//
// Full read-only probe. Runs all six methods and returns a combined snapshot.
// Uses Promise.allSettled so partial results are returned even when some
// methods fail (e.g. PON port walk times out but sysInfo succeeds).

snmpTestRouter.post("/probe", async (req: Request, res: Response) => {
  const input = validateBody(req.body as SnmpRequestBody);
  if ("error" in input) {
    res.status(400).json({ error: input.error, code: "INVALID_INPUT" });
    return;
  }

  const client  = new RealSnmpClient(input);
  const start   = Date.now();
  const probeAt = new Date().toISOString();

  // Quick connectivity test first — bail early if unreachable
  const connectivity = await client.testConnection();
  if (!connectivity.success) {
    res.status(502).json({
      data:  { connectivity },
      error: "OLT did not respond to connectivity probe",
      code:  "SNMP_UNREACHABLE",
      meta:  { generatedAt: probeAt },
    });
    return;
  }

  // Collect full read-only info — allSettled so partial failures don't abort
  const [sysInfoResult, ponPortsResult, onuListResult] = await Promise.allSettled([
    client.getSysInfo(),
    client.getPonPorts(),
    client.getOnuListMockFallback(input.oltId),
  ]);

  // Derive vendor + model from sysInfo without a second network round-trip
  const sysInfo = sysInfoResult.status === "fulfilled" ? sysInfoResult.value : null;
  const vendor  = sysInfo ? detectVendorFromSysInfo(sysInfo.sysDescr, sysInfo.sysObjectID) : "Unknown";
  const model   = sysInfo ? extractModelFromDescr(sysInfo.sysDescr) : "Unknown";

  const probeErrors = [
    sysInfoResult.status  === "rejected" ? { step: "sysInfo",  error: String(sysInfoResult.reason)  } : null,
    ponPortsResult.status === "rejected" ? { step: "ponPorts", error: String(ponPortsResult.reason) } : null,
    onuListResult.status  === "rejected" ? { step: "onuList",  error: String(onuListResult.reason)  } : null,
  ].filter((e): e is { step: string; error: string } => e !== null);

  res.json({
    data: {
      connectivity,
      sysInfo,
      vendor,
      model,
      ponPorts: ponPortsResult.status === "fulfilled" ? ponPortsResult.value : [],
      onuList:  onuListResult.status  === "fulfilled" ? onuListResult.value : {
        source: "mock" as const,
        onus: [],
        fallbackReason: "ONU list probe failed",
      },
      probeErrors,
    },
    meta: {
      host:        input.host,
      port:        input.port,
      probeMs:     Date.now() - start,
      generatedAt: probeAt,
      warning:     "Manual testing endpoint only — do not call in a polling loop.",
    },
  });
});
