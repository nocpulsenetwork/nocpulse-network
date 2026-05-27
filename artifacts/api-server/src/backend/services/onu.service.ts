/**
 * OnuService — business logic layer for ONU operations.
 *
 * TODO:
 *  - Implement getByOlt()    → return all ONUs for a given OLT from cache/DB
 *  - Implement getById()     → onuCache hit → DB fallback → on-demand poll
 *  - Implement search()      → filter by serial number, IP, VLAN, status
 *  - Implement forceRefresh()→ on-demand ONU poll via adapter
 *  - Implement resetOnu()    → send reset command via SSH CLI adapter (future)
 *  - Implement deactivate()  → admin-disable ONU via CLI (future)
 */

import type { OnuNormalized, OnuPollRequest } from "../types/onu.types";
import type { OltVendor } from "../types/olt.types";
import { adapterRegistry } from "../core/adapter-registry";
import { normalizeOnu } from "../core/normalizer";
import { onuCache } from "../core/cache";

export interface OnuFilter {
  oltId?: string;
  status?: string;
  vlan?: number;
  serialNumber?: string;
  query?: string; // free-text: name, IP, MAC, serial
}

export interface OnuServiceResult<T> {
  data: T;
  source: "cache" | "live" | "db";
  polledAt: Date;
}

export class OnuService {
  async getByOlt(_oltId: string): Promise<OnuServiceResult<OnuNormalized[]>> {
    // TODO: scan onuCache for all keys matching oltId prefix, DB fallback
    throw new Error("OnuService.getByOlt — not yet implemented");
  }

  async getById(onuId: string): Promise<OnuServiceResult<OnuNormalized>> {
    const cached = onuCache.get(onuId);
    if (cached) {
      return { data: cached, source: "cache", polledAt: cached.lastPolled };
    }
    // TODO: DB lookup, then on-demand poll
    throw new Error(`OnuService.getById("${onuId}") — not yet implemented`);
  }

  async search(_filter: OnuFilter): Promise<OnuNormalized[]> {
    // TODO: query DB with filter predicates, overlay live cache state
    throw new Error("OnuService.search — not yet implemented");
  }

  async forceRefresh(
    onuId: string,
    oltId: string,
    oltIp: string,
    vendor: OltVendor,
    onuIndex: number,
    portId: string,
  ): Promise<OnuNormalized> {
    const request: OnuPollRequest = { onuId, oltId, oltIp, vendor, onuIndex, portId };
    const adapter = adapterRegistry.get(vendor);
    const raw = await adapter.pollOnu(request);
    const normalized = normalizeOnu(raw);
    onuCache.set(onuId, normalized, 180_000);
    return normalized;
  }
}

export const onuService = new OnuService();
