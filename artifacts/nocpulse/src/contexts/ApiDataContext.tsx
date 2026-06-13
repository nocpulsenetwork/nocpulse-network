/**
 * ApiDataContext — provides fetched backend data app-wide.
 *
 * Rules:
 *  - Single fetch on mount via Promise.all; no intervals for OLTs/ONUs
 *  - Alarms refresh every 30 s so badges/counts stay in sync with AlarmCenter
 *  - Starts with mock data synchronously so pages never render empty
 *  - On API success: replaces data with live backend data
 *  - On API failure: keeps mock data, sets error for debugging
 *
 * Real OLT support:
 *  - Reads managed OLTs from localStorage (written by OltDetail when user adds a real OLT)
 *  - For each managed OLT, fetches cached real ONU discovery data from the backend
 *  - Merges real OLTs and real ONUs into the unified olts/onus arrays
 *  - All consumers (OnuManagement, OnuDetail, search, dropdowns) automatically see real data
 *
 * Single source of truth for alarm counts:
 *  - Alarm counts come from /api/alarms (same endpoint AlarmCenter uses)
 *  - Badge, sidebar badge, and Dashboard Active Alarms all derive from the same fetch
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fetchOlts, fetchOnus, fetchAlarms } from "@/lib/api";
import {
  olts as mockOlts,
  onus as mockOnus,
  alarms as mockAlarms,
  type OltDevice,
  type OnuDevice,
  type Alarm,
  type Status,
} from "@/data/mockData";

// ─── Managed OLT localStorage ───────────────────────────────────────────────
// OltDetail stores real OLTs here using the same key constant.
const MANAGED_OLT_KEY = "nocpulse-managed-olts";

// Stored managed OLT record — extends OltDevice with SNMP credentials.
// We only need the OltDevice portion; the extra fields are opaque to us here.
type StoredManagedOlt = OltDevice & Record<string, unknown>;

function loadManagedOlts(): StoredManagedOlt[] {
  try {
    const raw = localStorage.getItem(MANAGED_OLT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredManagedOlt[]) : [];
  } catch {
    return [];
  }
}

// ─── Real ONU transform ──────────────────────────────────────────────────────
// Mirrors the shape returned by GET /api/olts/:id/onus/real
type RawDiscoveredOnu = {
  onuId: string;
  ponPort: string;
  status: string;
  serial: string | null;
  type: string | null;
  /** ONU name/alias from OLT management table, or null/absent if unsupported. */
  name?: string | null;
  /** MAC address / EPON LLID, or null/absent if unsupported. */
  mac?: string | null;
  /** De-registration reason code (C-DATA/EasyPath INTEGER enum), or null/absent. */
  offlineReasonCode?: number | null;
  /** ONU receive optical power in dBm, or null/absent when not available. */
  rxPowerDbm?: number | null;
  /** ONU transmit optical power in dBm, or null/absent when not available. */
  txPowerDbm?: number | null;
  /** Physical fiber distance in metres, or null/absent when not available. */
  distanceMeters?: number | null;
  /** ONU module temperature in °C from Phase 3 SNMP probe, or null/absent. */
  temperatureCelsius?: number | null;
  /** Seconds since last PON registration from Phase 3 SNMP probe, or null/absent. */
  registerDurationSecs?: number | null;
};

// ── Offline reason decoder (C-DATA / EasyPath EPON) ──────────────────────────
const EPON_OFFLINE_REASON: Record<number, string> = {
  0: "Unknown",
  1: "Dying Gasp",
  2: "LOS",
  3: "Admin Disabled",
  4: "MPCP Timeout",
  5: "Link Fault",
  6: "Deregistered",
  7: "Aging Out",
};

function decodeOfflineReason(code: number | null | undefined): string {
  if (code == null) return "N/A";
  return EPON_OFFLINE_REASON[code] ?? `Code-${code}`;
}

/** Format seconds → "14d 3h 22m" / "3h 42m" / "15m" */
function fmtUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function transformDiscoveredOnu(oltId: string, onu: RawDiscoveredOnu): OnuDevice {
  // portIndex: SNMP ponPort is "port-N" where N is 0-based port index (port-0 = PON-1)
  const portNum   = parseInt(onu.ponPort.replace("port-", ""), 10);
  const portIndex = isNaN(portNum) ? 0 : portNum;
  const ponPort   = `PON-${portIndex + 1}`;
  const status: Status = onu.status === "online" ? "Online" : "Offline";

  // onuId is "portSlot.onuSlot" (e.g. "15.6") — the exact two-part SNMP index.
  // Dots → dashes for URL/ID safety; onuSlot is read directly from the second part
  // (never bit-masked from an opaque bigN, so there is no encoding ambiguity).
  const safeOnuId = onu.onuId.replace(/\./g, "-");        // e.g. "15-6"
  const idParts   = onu.onuId.split(".");
  const onuSlot   = parseInt(idParts[1] ?? "1", 10);       // e.g. 6
  const onuNo     = `0/0/${portIndex}/${Number.isFinite(onuSlot) ? onuSlot : 1}`;

  return {
    id:                `${oltId}-onu-${safeOnuId}`,
    oltId,
    onuNo,
    description:       onu.name ?? "",
    distance:          onu.distanceMeters != null
                         ? `${(onu.distanceMeters / 1000).toFixed(2)} km`
                         : null,
    signalLevel:       onu.rxPowerDbm ?? null,
    txPower:           onu.txPowerDbm ?? null,
    status,
    macAddress:        onu.mac ?? onu.serial ?? "",
    clientMac:         "",
    customerName:      "",
    lastSync:          "N/A",
    bandwidth:         "N/A",
    lastLogoutTime:    "N/A",
    lastLogoutReason:  decodeOfflineReason(onu.offlineReasonCode),
    onlineDuration:    onu.registerDurationSecs != null ? fmtUptime(onu.registerDurationSecs) : "N/A",
    ponPort,
    vlanId:            0,
    oltPort:           onu.ponPort,
    lastOfflineRxPower: null,
    signalStability:   status === "Offline"                                 ? "Offline"
                         : onu.rxPowerDbm != null && onu.rxPowerDbm >  -8  ? "Too High"
                         : onu.rxPowerDbm != null && onu.rxPowerDbm >= -18 ? "Excellent"
                         : onu.rxPowerDbm != null && onu.rxPowerDbm >= -22 ? "Good"
                         : onu.rxPowerDbm != null && onu.rxPowerDbm >= -25 ? "Normal"
                         : onu.rxPowerDbm != null && onu.rxPowerDbm >= -27 ? "Abnormal"
                         : onu.rxPowerDbm != null                           ? "Bad"
                         : "Stable",
    onuType:           "EPON",
    isReal:            true,
    temperatureCelsius:   onu.temperatureCelsius   ?? null,
    registerDurationSecs: onu.registerDurationSecs ?? null,
  };
}

async function fetchRealOnusForOlt(oltId: string): Promise<OnuDevice[]> {
  try {
    const res = await fetch(`/api/olts/${encodeURIComponent(oltId)}/onus/real`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const json = await res.json() as {
      data?: { hasData?: boolean; onus?: RawDiscoveredOnu[] };
    };
    const d = json?.data;
    if (!d?.hasData || !d.onus?.length) return [];
    return d.onus.map((onu) => transformDiscoveredOnu(oltId, onu));
  } catch {
    return [];
  }
}

// ─── Context types ───────────────────────────────────────────────────────────

type DataSource = "api" | "mock";

export interface ApiMetrics {
  totalOlts: number;
  totalOnus: number;
  onlineOnus: number;
  offlineOnus: number;
  offlineOlts: number;
  activeAlarms: number;
  criticalAlarms: number;
  networkUptime: number | null;
  bandwidthUsage: string;
}

export interface ApiDataState {
  olts: OltDevice[];
  onus: OnuDevice[];
  alarms: Alarm[];
  metrics: ApiMetrics;
  loading: boolean;
  error: string | null;
  source: DataSource;
}

/** ApiDataState extended with methods for dynamic updates. */
export type ApiDataContextValue = ApiDataState & {
  /** Re-fetch the real ONU cache for a single OLT and merge results into state. */
  refreshRealOnus: (oltId: string) => Promise<void>;
};

/**
 * Alarm is "active" when:
 *  - Backend Alarm: alarmStatus === "active"
 *  - Legacy/mock Alarm: !acknowledged (no alarmStatus field)
 * An acknowledged alarm is NOT counted as active (NOC has seen it).
 */
function isActiveAlarm(a: Alarm): boolean {
  if (a.alarmStatus !== undefined) return a.alarmStatus === "active";
  return !a.acknowledged;
}

function buildMetrics(
  olts: OltDevice[],
  onus: OnuDevice[],
  alarms: Alarm[]
): ApiMetrics {
  const totalOlts = olts.length;
  const onlineOlts = olts.filter((o) => o.status === "Online").length;
  const networkUptime =
    totalOlts > 0
      ? Math.round((onlineOlts / totalOlts) * 1000) / 10
      : null;
  const activeAlarms = alarms.filter(isActiveAlarm);
  return {
    totalOlts,
    totalOnus: onus.length,
    onlineOnus: onus.filter((o) => o.status === "Online").length,
    offlineOnus: onus.filter((o) => o.status === "Offline").length,
    offlineOlts: olts.filter((o) => o.status === "Offline").length,
    activeAlarms: activeAlarms.length,
    criticalAlarms: activeAlarms.filter((a) => a.severity === "Critical").length,
    networkUptime,
    bandwidthUsage: "42.5 Tbps",
  };
}

const mockMetrics = buildMetrics(mockOlts, mockOnus, mockAlarms);

const ApiDataContext = createContext<ApiDataContextValue | null>(null);

export function ApiDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ApiDataState>({
    olts: mockOlts,
    onus: mockOnus,
    alarms: mockAlarms,
    metrics: mockMetrics,
    loading: true,
    error: null,
    source: "mock",
  });

  // ── Initial fetch: OLTs, ONUs, alarms ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    /* Safety net: loading screen must never persist longer than 1500 ms. */
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
    }, 1500);

    const doFetch = async () => {
      // Fetch API data and managed-OLT real ONUs concurrently.
      const managedOlts = loadManagedOlts();

      const [apiOlts, apiOnus, apiAlarms, ...realOnusArrays] = await Promise.all([
        fetchOlts(),
        fetchOnus(),
        fetchAlarms(),
        ...managedOlts.map((o) => fetchRealOnusForOlt(o.id)),
      ]);

      // Merge managed OLTs that aren't already in the API response.
      const apiOltIds = new Set(apiOlts.map((o) => o.id));
      const extraOlts: OltDevice[] = managedOlts.filter((o) => !apiOltIds.has(o.id));
      const allOlts = [...apiOlts, ...extraOlts];

      // Merge real ONUs from every managed OLT's discovery cache.
      const realOnus = (realOnusArrays as OnuDevice[][]).flat();
      const allOnus = [...apiOnus, ...realOnus];

      return { olts: allOlts, onus: allOnus, alarms: apiAlarms };
    };

    doFetch()
      .then(({ olts, onus, alarms }) => {
        clearTimeout(safetyTimer);
        if (cancelled) return;
        setState({
          olts,
          onus,
          alarms,
          metrics: buildMetrics(olts, onus, alarms),
          loading: false,
          error: null,
          source: "api",
        });
      })
      .catch((err: unknown) => {
        clearTimeout(safetyTimer);
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "API fetch failed",
          source: "mock",
        }));
      });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, []);

  // ── Alarm refresh every 30 s (single source of truth for all badge counts) ─
  // Dashboard, notification badge, sidebar badge all read from context.alarms.
  // AlarmCenter has its own 30 s refresh loop that calls the same endpoint.
  // Both stay in sync because they hit the same /api/alarms endpoint which
  // runs reconcile() on every request.
  useEffect(() => {
    const tick = async () => {
      try {
        const fresh = await fetchAlarms();
        setState((prev) => ({
          ...prev,
          alarms: fresh,
          metrics: buildMetrics(prev.olts, prev.onus, fresh),
        }));
      } catch {
        // Silently keep existing alarm data on refresh failure.
      }
    };

    const id = setInterval(() => { void tick(); }, 30_000);
    return () => clearInterval(id);
  }, []);

  const refreshRealOnus = useCallback(async (oltId: string): Promise<void> => {
    const newOnus = await fetchRealOnusForOlt(oltId);
    if (newOnus.length === 0) return;
    setState((prev) => {
      const withoutOlt = prev.onus.filter(
        (o) => !((o as OnuDevice & { isReal?: boolean }).isReal && o.oltId === oltId)
      );
      const allOnus = [...withoutOlt, ...newOnus];
      return { ...prev, onus: allOnus, metrics: buildMetrics(prev.olts, allOnus, prev.alarms) };
    });
  }, []);

  return (
    <ApiDataContext.Provider value={{ ...state, refreshRealOnus }}>
      {children}
    </ApiDataContext.Provider>
  );
}

export function useApiData(): ApiDataContextValue {
  const ctx = useContext(ApiDataContext);
  if (!ctx) {
    throw new Error("useApiData must be used inside <ApiDataProvider>");
  }
  return ctx;
}
