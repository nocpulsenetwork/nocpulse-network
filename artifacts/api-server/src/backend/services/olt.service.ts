/**
 * OltService — business logic layer for OLT operations.
 *
 * Sits between API routes and the adapter/cache layer.
 * All public methods return normalized types; callers never touch adapters directly.
 *
 * TODO:
 *  - Implement getAll()    → query DB for OLT inventory, merge with cache state
 *  - Implement getById()   → oltCache hit → DB fallback → poll on miss
 *  - Implement addOlt()    → persist to DB, register with pollingEngine
 *  - Implement updateOlt() → update DB record, re-register polling if IP/creds changed
 *  - Implement removeOlt() → deregister polling, soft-delete from DB
 *  - Implement forceRefresh() → trigger immediate poll outside normal schedule
 */

import type { OltNormalized, OltPollRequest, OltVendor } from "../types/olt.types";
import { adapterRegistry } from "../core/adapter-registry";
import { normalizeOlt } from "../core/normalizer";
import { oltCache } from "../core/cache";
import { pollingEngine } from "../core/polling-engine";

export interface CreateOltDto {
  name: string;
  ipAddress: string;
  vendor: OltVendor;
  location: string;
  community?: string;
  username?: string;
  authKey?: string;
  privKey?: string;
  snmpPort?: number;
}

export interface OltServiceResult<T> {
  data: T;
  source: "cache" | "live" | "db";
  polledAt: Date;
}

export class OltService {
  async getAll(): Promise<OltServiceResult<OltNormalized[]>> {
    // TODO: load OLT inventory from DB, merge status from oltCache
    throw new Error("OltService.getAll — not yet implemented");
  }

  async getById(oltId: string): Promise<OltServiceResult<OltNormalized>> {
    // Cache-first
    const cached = oltCache.get(oltId);
    if (cached) {
      return { data: cached, source: "cache", polledAt: cached.lastPolled };
    }
    // TODO: DB fallback, then on-demand poll
    throw new Error(`OltService.getById("${oltId}") — not yet implemented`);
  }

  async create(dto: CreateOltDto): Promise<OltNormalized> {
    // TODO: validate IP reachability, persist to DB, register in pollingEngine
    void dto; // suppress unused warning until implemented
    throw new Error("OltService.create — not yet implemented");
  }

  async forceRefresh(oltId: string): Promise<OltNormalized> {
    // TODO: load OLT record from DB, build OltPollRequest, call adapter directly
    const cached = oltCache.get(oltId);
    if (!cached) {
      throw new Error(`OLT "${oltId}" not found in cache — DB lookup not yet implemented`);
    }
    const request: OltPollRequest = {
      oltId: cached.id,
      ipAddress: cached.ipAddress,
      vendor: cached.vendor,
    };
    const adapter = adapterRegistry.get(cached.vendor);
    const raw = await adapter.pollOlt(request);
    const normalized = normalizeOlt(raw);
    oltCache.set(oltId, normalized, 90_000);
    return normalized;
  }

  remove(oltId: string): void {
    pollingEngine.deregisterOlt(oltId);
    oltCache.delete(oltId);
    // TODO: soft-delete from DB
  }
}

export const oltService = new OltService();
