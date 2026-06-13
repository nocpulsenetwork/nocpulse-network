import type { Alarm } from "@/data/mockData";

/**
 * Derives the correct navigation href for an alarm row.
 *
 * Real ONU alarm  → /onus?search=<MAC>   (ONU Management filtered by MAC/name)
 * Real OLT alarm  → /olts/<oltId>         (OLT Detail)
 * Mock deviceId   → /onus/<id> or /olts/<id>  (onu-xxx / olt-xxx prefix)
 * Fallback        → /alarms               (always safe)
 */
export function getAlarmHref(alarm: Alarm): string {
  // Real ONU alarm — navigate to ONU Management filtered by MAC (deviceName)
  if (alarm.onuId) {
    const q = alarm.deviceName
      ? encodeURIComponent(alarm.deviceName)
      : encodeURIComponent(alarm.onuId);
    return `/onus?search=${q}`;
  }
  // Real OLT alarm
  if (alarm.oltId) return `/olts/${alarm.oltId}`;
  // Mock alarm fallbacks (deviceId prefix convention)
  if (alarm.deviceId.startsWith("onu-")) return `/onus/${alarm.deviceId}`;
  if (alarm.deviceId.startsWith("olt-")) return `/olts/${alarm.deviceId}`;
  // No resolvable target
  console.warn("[alarmNav] Alarm navigation target missing", {
    id: alarm.id,
    deviceId: alarm.deviceId,
    oltId: alarm.oltId,
    onuId: alarm.onuId,
  });
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
