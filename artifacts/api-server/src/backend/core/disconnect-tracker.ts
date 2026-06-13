/**
 * DisconnectTracker — in-memory per-ONU Online→Offline transition recorder.
 *
 * Receives ONU lists from the polling engine and detects status transitions.
 * Stores the latest disconnect snapshot per ONU. Resets on server restart.
 *
 * Rules:
 *  - No SNMP calls, no DB writes — pure read from what the engine already collects.
 *  - One snapshot per ONU — latest disconnect wins.
 *  - Only captures events AFTER the server started (no backfill, no history).
 */

import { logger } from "../../lib/logger";

// ─── Input type (minimal subset of SnmpOnu required here) ──────────────────

export interface OnuPollEntry {
  onuId: string;
  ponPort: string;
  status: "online" | "offline" | "unknown";
  rxPowerDbm?: number | null;
  txPowerDbm?: number | null;
  temperatureCelsius?: number | null;
  distanceMeters?: number | null;
  offlineReasonCode?: number | null;
}

// ─── Snapshot type ──────────────────────────────────────────────────────────

export interface DisconnectSnapshot {
  oltId: string;
  /** URL-safe ONU key: raw onuId with dots replaced by dashes (matches /:onuId URL param). */
  onuKey: string;
  rawPonPort: string;
  rawOnuId: string;

  /** ISO 8601 — when Online→Offline transition was first observed. */
  disconnectedAt: string;
  /** ISO 8601 — when Offline→Online transition was observed. Null if still offline. */
  reconnectedAt: string | null;
  /** ISO 8601 — when the ONU was last seen online before this disconnect. */
  prevOnlineSince: string | null;

  /** Optical/signal state captured at the moment of disconnect. */
  rxPowerDbm: number | null;
  txPowerDbm: number | null;
  temperatureCelsius: number | null;
  distanceMeters: number | null;
  offlineReasonCode: number | null;
}

// ─── Internal state type ────────────────────────────────────────────────────

interface PrevEntry {
  status: "online" | "offline" | "unknown";
  /** ISO timestamp when this status was first observed. */
  since: string;
}

// ─── Tracker class ──────────────────────────────────────────────────────────

class DisconnectTracker {
  /** Latest snapshot per ONU. Key: `${oltId}::${onuKey}` */
  private readonly snapshots  = new Map<string, DisconnectSnapshot>();
  /** Previous observed status per ONU. Key: `${oltId}::${onuKey}` */
  private readonly prevStatus = new Map<string, PrevEntry>();

  /**
   * Process one ONU poll result from the polling engine.
   * Detects Online→Offline and Offline→Online transitions.
   * Never throws — any errors are logged and swallowed.
   */
  recordOnuPoll(oltId: string, onus: OnuPollEntry[], polledAt: string): void {
    for (const onu of onus) {
      try {
        const onuKey = onu.onuId.replace(/\./g, "-");
        const mapKey = `${oltId}::${onuKey}`;
        const prev   = this.prevStatus.get(mapKey);
        const cur    = onu.status;

        if (prev !== undefined && prev.status !== cur) {
          if (prev.status !== "offline" && cur === "offline") {
            // ── Online (or unknown) → Offline ─────────────────────────────
            const snap: DisconnectSnapshot = {
              oltId,
              onuKey,
              rawPonPort:         onu.ponPort,
              rawOnuId:           onu.onuId,
              disconnectedAt:     polledAt,
              reconnectedAt:      null,
              prevOnlineSince:    prev.status === "online" ? prev.since : null,
              rxPowerDbm:         onu.rxPowerDbm         ?? null,
              txPowerDbm:         onu.txPowerDbm         ?? null,
              temperatureCelsius: onu.temperatureCelsius  ?? null,
              distanceMeters:     onu.distanceMeters      ?? null,
              offlineReasonCode:  onu.offlineReasonCode   ?? null,
            };
            this.snapshots.set(mapKey, snap);
            logger.info({ oltId, onuKey, rawOnuId: onu.onuId }, "disconnect-tracker:offline");

          } else if (prev.status === "offline" && cur !== "offline") {
            // ── Offline → Online (or unknown) ─────────────────────────────
            const existing = this.snapshots.get(mapKey);
            if (existing && existing.reconnectedAt === null) {
              existing.reconnectedAt = polledAt;
              logger.info({ oltId, onuKey }, "disconnect-tracker:reconnected");
            }
          }
        }

        // Update previous entry — "since" resets only when status changes
        const newSince =
          prev === undefined || prev.status !== cur ? polledAt : prev.since;
        this.prevStatus.set(mapKey, { status: cur, since: newSince });

      } catch (err) {
        logger.warn({ oltId, onuId: onu.onuId, err }, "disconnect-tracker:record-error");
      }
    }
  }

  /**
   * Return the latest disconnect snapshot for one ONU, or null if none recorded yet.
   * @param onuKey  URL-safe ONU key (dots replaced by dashes — same as the /:onuId URL param).
   */
  getSnapshot(oltId: string, onuKey: string): DisconnectSnapshot | null {
    return this.snapshots.get(`${oltId}::${onuKey}`) ?? null;
  }

  /** How many snapshots are currently stored. */
  size(): number {
    return this.snapshots.size;
  }

  /** Clear all state. Use in tests only. */
  clear(): void {
    this.snapshots.clear();
    this.prevStatus.clear();
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const disconnectTracker = new DisconnectTracker();
