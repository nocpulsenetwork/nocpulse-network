/**
 * AlarmService — business logic layer for alarm operations.
 *
 * TODO:
 *  - Implement getActive()       → return all active alarms from alarmCache / DB
 *  - Implement getHistory()      → paginated alarm history with AlarmFilter
 *  - Implement acknowledge()     → mark alarm as acknowledged in DB, emit event
 *  - Implement clearAlarm()      → manually clear alarm (NOC override), audit log
 *  - Implement getByDevice()     → alarms filtered by oltId or onuId
 *  - Implement severityCount()   → summary counts by severity (for KPI cards)
 */

import type { AlarmNormalized, AlarmFilter } from "../types/alarm.types";
import { alarmCache } from "../core/cache";

export interface PaginatedAlarms {
  items: AlarmNormalized[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AlarmSummary {
  critical: number;
  major: number;
  minor: number;
  warning: number;
  info: number;
  total: number;
}

export class AlarmService {
  async getActive(): Promise<AlarmNormalized[]> {
    // TODO: collect all alarmCache entries, filter status === "active"
    throw new Error("AlarmService.getActive — not yet implemented");
  }

  async getHistory(_filter: AlarmFilter, _page = 1, _pageSize = 50): Promise<PaginatedAlarms> {
    // TODO: DB query with filter predicates + pagination
    throw new Error("AlarmService.getHistory — not yet implemented");
  }

  async getByDevice(deviceId: string): Promise<AlarmNormalized[]> {
    const cached = alarmCache.get(deviceId);
    if (cached) return cached;
    // TODO: DB fallback
    throw new Error(`AlarmService.getByDevice("${deviceId}") — not yet implemented`);
  }

  async acknowledge(alarmId: string, acknowledgedBy: string): Promise<AlarmNormalized> {
    // TODO: update alarm record in DB, invalidate cache entry, audit log
    void alarmId; void acknowledgedBy;
    throw new Error("AlarmService.acknowledge — not yet implemented");
  }

  async clearAlarm(alarmId: string, clearedBy: string): Promise<AlarmNormalized> {
    // TODO: set clearedAt, update DB, remove from active cache
    void alarmId; void clearedBy;
    throw new Error("AlarmService.clearAlarm — not yet implemented");
  }

  async severityCount(): Promise<AlarmSummary> {
    // TODO: aggregate from getActive()
    throw new Error("AlarmService.severityCount — not yet implemented");
  }
}

export const alarmService = new AlarmService();
