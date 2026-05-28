/**
 * API Service Layer — lightweight fetch wrapper for NOCpulse backend.
 *
 * Design constraints:
 *  - fetch() only — no axios, no extra dependencies
 *  - Transforms backend shapes → frontend OltDevice/OnuDevice/Alarm types
 *  - Every function is called once on page load via ApiDataContext; no intervals
 *  - If a call fails, ApiDataContext falls back to mockData silently
 *  - AbortSignal.timeout keeps requests bounded; no hanging fetches
 */
import type {
  OltDevice,
  OnuDevice,
  Alarm,
  Status,
  Severity,
  SignalStability,
  OnuType,
} from "@/data/mockData";

// ─── Backend wire types (subset of what each endpoint returns) ─────────────

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  meta: { generatedAt: string; count: number; source: string };
}

interface ApiPonPort {
  portId: string;
  type: string;
  capacity: number;
  registered: number;
  online: number;
  status: string;
}

interface ApiOLT {
  id: string;
  name: string;
  vendor: string;
  model: string;
  ipAddress: string;
  location: string;
  status: string;
  totalOnuCapacity: number;
  onlineOnu: number;
  cpuUsagePercent: number | null;
  memUsagePercent: number | null;
  temperature: number | null;
  uptime: number;
  lastPolled: string;
  ponPorts: ApiPonPort[];
}

interface ApiONU {
  id: string;
  oltId: string;
  oltPort: string;
  onuIndex: number;
  onuType: string;
  mac: string;
  name: string;
  description: string;
  vlan: number;
  status: string;
  txPower: number | null;
  rxPower: number | null;
  distance: number | null;
  uptime: number | null;
  lastOfflineReason: string | null;
  lastOnlineTime: string | null;
}

interface ApiAlarm {
  id: string;
  severity: string;
  acknowledged: boolean;
  deviceId: string;
  deviceName: string;
  description: string;
  timestamp: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function capitalizeStatus(s: string): Status {
  if (s === "online") return "Online";
  if (s === "offline") return "Offline";
  if (s === "degraded") return "Degraded";
  return "Offline";
}

function capitalizeSeverity(s: string): Severity {
  const map: Record<string, Severity> = {
    critical: "Critical",
    major: "Major",
    minor: "Minor",
    info: "Info",
    warning: "Info",
  };
  return map[s.toLowerCase()] ?? "Info";
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0d 0h";
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3_600);
  return `${d}d ${h}h`;
}

function deriveSignalStability(
  rxPower: number | null,
  status: string
): SignalStability {
  if (status === "offline") return "Offline";
  if (rxPower === null) return "Stable";
  if (rxPower <= -30) return "High Loss";
  if (rxPower <= -27) return "Weak Signal";
  if (rxPower <= -25) return "Unstable";
  return "Stable";
}

function deriveOltType(ports: ApiPonPort[]): "GPON" | "EPON" {
  const first = ports[0]?.type ?? "GPON";
  return first.toUpperCase() === "EPON" ? "EPON" : "GPON";
}

function vendorDisplay(vendor: string): string {
  const map: Record<string, string> = {
    huawei: "Huawei",
    zte: "ZTE",
    bdcom: "BDCOM",
    vsol: "VSOL",
    cdata: "C-DATA",
    generic: "Generic",
  };
  return map[vendor.toLowerCase()] ?? vendor;
}

// ─── Transforms ────────────────────────────────────────────────────────────

function transformOlt(o: ApiOLT): OltDevice {
  const oltType = deriveOltType(o.ponPorts);
  return {
    id: o.id,
    name: o.name,
    ip: o.ipAddress,
    portCount: o.totalOnuCapacity,
    activeOnus: o.onlineOnu,
    status: capitalizeStatus(o.status),
    uptime: formatUptime(o.uptime),
    lastSeen: "Just now",
    location: o.location,
    brand: vendorDisplay(o.vendor),
    type: oltType,
    mode: oltType,
    cpu: o.cpuUsagePercent ?? 0,
    memory: o.memUsagePercent ?? 0,
    temperature: o.temperature ?? 0,
    lastSync: o.lastPolled,
    uplinkStatus: o.status === "online" ? "Active" : "Down",
    uplinkPort: "10GE0/0/1",
    ponPortCount: o.ponPorts.length,
  };
}

function transformOnu(o: ApiONU): OnuDevice {
  const rxPower = o.rxPower ?? -40.0;
  const status = capitalizeStatus(o.status);
  const onuType = (
    ["GPON", "EPON", "XPON"].includes(o.onuType.toUpperCase())
      ? o.onuType.toUpperCase()
      : "GPON"
  ) as OnuType;

  return {
    id: o.id,
    oltId: o.oltId,
    onuNo: `${o.oltPort}/${o.onuIndex}`,
    description: o.description,
    distance:
      o.distance !== null ? `${(o.distance / 1000).toFixed(2)} km` : "N/A",
    signalLevel: rxPower,
    txPower: o.txPower ?? -5.0,
    status,
    macAddress: o.mac,
    clientMac: "",
    customerName: o.name,
    lastSync: o.status === "online" ? "Just now" : "Offline",
    bandwidth: "N/A",
    lastLogoutTime: o.lastOnlineTime ?? "N/A",
    lastLogoutReason: o.lastOfflineReason ?? "N/A",
    onlineDuration:
      o.uptime !== null ? formatUptime(o.uptime) : "N/A",
    ponPort: `PON-${o.onuIndex}`,
    vlanId: o.vlan,
    oltPort: o.oltPort,
    lastOfflineRxPower: o.status !== "online" ? rxPower : null,
    signalStability: deriveSignalStability(o.rxPower, o.status),
    onuType,
  };
}

function transformAlarm(a: ApiAlarm): Alarm {
  return {
    id: a.id,
    severity: capitalizeSeverity(a.severity),
    deviceId: a.deviceId,
    deviceName: a.deviceName,
    timestamp: a.timestamp,
    description: a.description,
    acknowledged: a.acknowledged,
  };
}

// ─── Public fetch functions ────────────────────────────────────────────────

const TIMEOUT_MS = 8_000;

async function apiFetch<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`/api${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GET /api${path} → HTTP ${res.status}`);
  return res.json() as Promise<ApiResponse<T>>;
}

export async function fetchOlts(): Promise<OltDevice[]> {
  const resp = await apiFetch<ApiOLT>("/olts");
  return resp.data.map(transformOlt);
}

export async function fetchOnus(): Promise<OnuDevice[]> {
  const resp = await apiFetch<ApiONU>("/onus");
  return resp.data.map(transformOnu);
}

export async function fetchAlarms(): Promise<Alarm[]> {
  const resp = await apiFetch<ApiAlarm>("/alarms");
  return resp.data.map(transformAlarm);
}
