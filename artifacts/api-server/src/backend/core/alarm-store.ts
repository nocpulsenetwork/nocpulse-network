/**
 * AlarmStore — in-memory alarm lifecycle manager.
 *
 * Responsibilities:
 *   1. Reconcile detected alarms against stored state (raise, dedup, auto-clear, reopen).
 *   2. Persist per-alarm event history (raised, acknowledged, cleared, reopened).
 *   3. Support manual acknowledge and NOC-override clear.
 *
 * Storage: in-memory Map — no DB, no disk. Survives process restart only if
 * the polling engine feeds fresh data immediately after restart (which it does
 * on first manual poll).
 *
 * Alarm lifecycle:
 *   detected & not in store        → raise   (status: active)
 *   detected & in store (active)   → update message/severity, no duplicate raise
 *   detected & in store (acked)    → update message/severity, stay acknowledged
 *   detected & in store (cleared)  → reopen  (status: active, reopenCount++)
 *   not detected & active/acked    → auto-clear (status: cleared, clearedAt = now)
 *
 * Stable alarm IDs from alarm-detector.ts ensure correct deduplication:
 *   e.g. olt-{id}-link-down, onu-{id}-low-rx-power
 */

import type { DetectedAlarm, DetectedAlarmSeverity } from "../services/alarm-detector";
import type { AlarmType } from "../types/universal.types";

// ─── Types ──────────────────────────────────────────────────────────────────

export type StoredAlarmStatus = "active" | "acknowledged" | "cleared";

export interface AlarmHistoryEvent {
  eventId: string;
  timestamp: string;    // ISO 8601
  action: string;
  actor: string;
  note?: string;
}

export interface StoredAlarm {
  // Identity
  id: string;                    // stable dedup key from alarm-detector
  type: AlarmType;
  severity: DetectedAlarmSeverity;
  status: StoredAlarmStatus;
  // Device context
  oltId: string | null;
  onuId: string | null;
  deviceId: string;              // oltId ?? onuId ?? "system"
  deviceName: string;            // human-readable device name
  // Display
  title: string;                 // alarm type title ("ONU Offline")
  message: string;               // full description including device name
  // Timeline
  raisedAt: string;              // ISO — time first raised in this session
  updatedAt: string;             // ISO — last reconcile update
  clearedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  reopenCount: number;
  history: AlarmHistoryEvent[];
}

// ─── AlarmStore ─────────────────────────────────────────────────────────────

class AlarmStore {
  /** Active/acknowledged alarms keyed by stable alarm ID. */
  private readonly live = new Map<string, StoredAlarm>();

  /**
   * Reconcile the store against a fresh DetectedAlarm[] snapshot.
   *
   * Call this on every `GET /api/alarms` request — it is read-only
   * from the SNMP perspective (only reads snapshot stores, never writes OLTs).
   */
  reconcile(detected: DetectedAlarm[]): void {
    const now = new Date().toISOString();
    const detectedIds = new Set(detected.map((d) => d.id));

    // ── Raise new alarms / update existing ones ──────────────────────────
    for (const d of detected) {
      const existing = this.live.get(d.id);

      if (!existing) {
        // Brand-new alarm — raise it.
        this.live.set(d.id, {
          id: d.id,
          type: d.type,
          severity: d.severity,
          status: "active",
          oltId: d.oltId,
          onuId: d.onuId,
          deviceId: d.oltId ?? d.onuId ?? "system",
          deviceName: d.deviceName,
          title: d.title,
          message: d.message,
          raisedAt: now,
          updatedAt: now,
          clearedAt: null,
          acknowledgedAt: null,
          acknowledgedBy: null,
          reopenCount: 0,
          history: [
            {
              eventId: `${d.id}-raised-${Date.now()}`,
              timestamp: now,
              action: "Alarm raised",
              actor: "System",
            },
          ],
        });
        continue;
      }

      if (existing.status === "cleared") {
        // Previously cleared — reopen it.
        const reopenCount = existing.reopenCount + 1;
        this.live.set(d.id, {
          ...existing,
          severity: d.severity,
          message: d.message,
          status: "active",
          clearedAt: null,
          acknowledgedAt: null,
          acknowledgedBy: null,
          updatedAt: now,
          reopenCount,
          history: [
            ...existing.history,
            {
              eventId: `${d.id}-reopen-${Date.now()}`,
              timestamp: now,
              action: `Alarm re-opened (occurrence #${reopenCount})`,
              actor: "System",
            },
          ],
        });
        continue;
      }

      // Still active or acknowledged — refresh severity/message, no duplicate raise.
      if (existing.severity !== d.severity || existing.message !== d.message) {
        this.live.set(d.id, {
          ...existing,
          severity: d.severity,
          message: d.message,
          updatedAt: now,
        });
      }
    }

    // ── Auto-clear alarms no longer detected ────────────────────────────
    for (const [id, alarm] of this.live) {
      if (detectedIds.has(id)) continue;
      if (alarm.status === "cleared") continue;

      this.live.set(id, {
        ...alarm,
        status: "cleared",
        clearedAt: now,
        updatedAt: now,
        history: [
          ...alarm.history,
          {
            eventId: `${id}-autoclear-${Date.now()}`,
            timestamp: now,
            action: "Alarm cleared — condition no longer detected",
            actor: "System (Auto-clear)",
          },
        ],
      });
    }
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  /** Acknowledge an active alarm. Returns null if alarm not found or not active. */
  acknowledge(id: string, by: string): StoredAlarm | null {
    const alarm = this.live.get(id);
    if (!alarm || alarm.status !== "active") return null;

    const now = new Date().toISOString();
    const updated: StoredAlarm = {
      ...alarm,
      status: "acknowledged",
      acknowledgedAt: now,
      acknowledgedBy: by,
      updatedAt: now,
      history: [
        ...alarm.history,
        {
          eventId: `${id}-ack-${Date.now()}`,
          timestamp: now,
          action: "Acknowledged by NOC operator",
          actor: by,
        },
      ],
    };
    this.live.set(id, updated);
    return updated;
  }

  /** Manually clear an alarm (NOC override). Returns null if not found or already cleared. */
  manualClear(id: string, by: string): StoredAlarm | null {
    const alarm = this.live.get(id);
    if (!alarm || alarm.status === "cleared") return null;

    const now = new Date().toISOString();
    const cleared: StoredAlarm = {
      ...alarm,
      status: "cleared",
      clearedAt: now,
      updatedAt: now,
      history: [
        ...alarm.history,
        {
          eventId: `${id}-manualclear-${Date.now()}`,
          timestamp: now,
          action: "Manually cleared by NOC operator",
          actor: by,
        },
      ],
    };
    this.live.set(id, cleared);
    return cleared;
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  /** All alarms that are active or acknowledged (not cleared). Newest first. */
  getActive(): StoredAlarm[] {
    return [...this.live.values()]
      .filter((a) => a.status !== "cleared")
      .sort((a, b) => new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime());
  }

  /** All stored alarms (active + acknowledged + cleared). Newest first. */
  getAll(): StoredAlarm[] {
    return [...this.live.values()].sort(
      (a, b) => new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime(),
    );
  }

  /** Cleared alarms only, sorted by clearedAt descending, with pagination. */
  getHistory(limit = 100, offset = 0): StoredAlarm[] {
    return [...this.live.values()]
      .filter((a) => a.status === "cleared")
      .sort((a, b) => {
        const ta = new Date(a.clearedAt ?? a.updatedAt).getTime();
        const tb = new Date(b.clearedAt ?? b.updatedAt).getTime();
        return tb - ta;
      })
      .slice(offset, offset + limit);
  }

  /** Look up a single alarm by its stable ID. */
  get(id: string): StoredAlarm | undefined {
    return this.live.get(id);
  }

  /** Severity count summary for KPI cards — active + acknowledged only. */
  summary(): {
    critical: number;
    warning: number;
    info: number;
    total: number;
    historyTotal: number;
  } {
    const active = [...this.live.values()].filter((a) => a.status !== "cleared");
    const history = [...this.live.values()].filter((a) => a.status === "cleared");
    return {
      critical: active.filter((a) => a.severity === "critical").length,
      warning:  active.filter((a) => a.severity === "warning").length,
      info:     active.filter((a) => a.severity === "info").length,
      total:    active.length,
      historyTotal: history.length,
    };
  }

  /** How many alarms are currently stored (for diagnostics). */
  size(): number {
    return this.live.size;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const alarmStore = new AlarmStore();
