import type { Alarm } from "@/data/mockData";

/**
 * Derives the correct navigation href for an alarm row.
 *
 * Priority:
 * 1. Real backend `onuId`  → /onus/{onuId}
 * 2. Real backend `oltId`  → /olts/{oltId}
 * 3. Mock deviceId prefix  → /onus/… or /olts/… (onu-xxx / olt-xxx convention)
 * 4. Fallback              → /alarms  (always safe)
 */
export function getAlarmHref(alarm: Alarm): string {
  if (alarm.onuId) return `/onus/${alarm.onuId}`;
  if (alarm.oltId) return `/olts/${alarm.oltId}`;
  if (alarm.deviceId.startsWith("onu-")) return `/onus/${alarm.deviceId}`;
  if (alarm.deviceId.startsWith("olt-")) return `/olts/${alarm.deviceId}`;
  return "/alarms";
}

/** Returns true when the alarm targets a concrete device (OLT or ONU). */
export function alarmHasDevice(alarm: Alarm): boolean {
  return !!(
    alarm.onuId ||
    alarm.oltId ||
    alarm.deviceId.startsWith("onu-") ||
    alarm.deviceId.startsWith("olt-")
  );
}
