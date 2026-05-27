import type { OltNormalized } from "../types/olt.types";
import type { OnuNormalized } from "../types/onu.types";
import type { AlarmNormalized, AlarmSeverity } from "../types/alarm.types";

/**
 * Normalizer — post-processes raw adapter output into consistent shapes.
 *
 * Each vendor adapter returns a best-effort OltNormalized / OnuNormalized.
 * The normalizer applies cross-vendor business rules on top:
 *   - Clamp out-of-range optical power values
 *   - Derive OLT status from sub-component health
 *   - Deduplicate alarms by (deviceId + type + raisedAt window)
 *   - Classify alarm severity based on type + thresholds
 *
 * TODO:
 *  - Implement optical power range validation (typical: -8 to -28 dBm RX)
 *  - Implement OLT status derivation from board health + ONU offline ratio
 *  - Implement alarm deduplication window (default: 60 s)
 *  - Implement severity override rules (e.g. LOS on trunk → critical)
 */

const OPTICAL_RX_MIN_DBM = -30;
const OPTICAL_RX_MAX_DBM = -5;

export function normalizeOlt(raw: OltNormalized): OltNormalized {
  // TODO: derive status from hardware.boards health
  return {
    ...raw,
    lastPolled: new Date(),
  };
}

export function normalizeOnu(raw: OnuNormalized): OnuNormalized {
  // TODO: clamp optical values, derive status from optical + eth ports
  const rxPower = clampOptical(raw.optical.rxPowerDbm);
  return {
    ...raw,
    optical: { ...raw.optical, rxPowerDbm: rxPower },
    lastPolled: new Date(),
  };
}

export function normalizeAlarms(
  raw: AlarmNormalized[]
): AlarmNormalized[] {
  // TODO: deduplication + severity override rules
  return raw.map((alarm) => ({
    ...alarm,
    severity: overrideSeverity(alarm),
  }));
}

function clampOptical(dbm: number): number {
  if (dbm < OPTICAL_RX_MIN_DBM) return OPTICAL_RX_MIN_DBM;
  if (dbm > OPTICAL_RX_MAX_DBM) return OPTICAL_RX_MAX_DBM;
  return dbm;
}

function overrideSeverity(alarm: AlarmNormalized): AlarmSeverity {
  // Dying-gasp is always critical regardless of vendor classification
  if (alarm.type === "dying-gasp") return "critical";
  // Rogue ONU is always major — it impacts all ONUs on the PON port
  if (alarm.type === "rogue-onu") return "major";
  return alarm.severity;
}
