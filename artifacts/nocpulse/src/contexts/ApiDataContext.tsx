/**
 * ApiDataContext — provides fetched backend data app-wide.
 *
 * Rules:
 *  - Single fetch on mount via Promise.all; no intervals, no background refresh
 *  - Starts with mock data synchronously so pages never render empty
 *  - On API success: replaces data with live backend data
 *  - On API failure: keeps mock data, sets error for debugging
 *  - CPU safe: one effect, no timers, no polling loops
 *
 * Real OLT support:
 *  - Reads managed OLTs from localStorage (written by OltDetail when user adds a real OLT)
 *  - For each managed OLT, fetches cached real ONU discovery data from the backend
 *  - Merges real OLTs and real ONUs into the unified olts/onus arrays
 *  - All consumers (OnuManagement, OnuDetail, search, dropdowns) automatically see real data
 */
import {
  createContext,
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
};

function transformDiscoveredOnu(oltId: string, onu: RawDiscoveredOnu): OnuDevice {
  // SNMP port-0 → PON-1, port-1 → PON-2, … (0-indexed → 1-indexed)
  const portNum = parseInt(onu.ponPort.replace("port-", ""), 10);
  const ponPort = `PON-${isNaN(portNum) ? 1 : portNum + 1}`;
  const status: Status = onu.status === "online" ? "Online" : "Offline";
  return {
    id:                `${oltId}-onu-${onu.onuId}`,
    oltId,
    onuNo:             `${onu.ponPort}/${onu.onuId}`,
    description:       "",
    distance:          "N/A",
    signalLevel:       -40.0,
    txPower:           -5.0,
    status,
    macAddress:        onu.serial ?? "",
    clientMac:         "",
    customerName:      `ONU-${onu.onuId}`,
    lastSync:          status === "Online" ? "Just now" : "Offline",
    bandwidth:         "N/A",
    lastLogoutTime:    "N/A",
    lastLogoutReason:  "N/A",
    onlineDuration:    "N/A",
    ponPort,
    vlanId:            0,
    oltPort:           onu.ponPort,
    lastOfflineRxPower: null,
    signalStability:   status === "Online" ? "Stable" : "Offline",
    onuType:           "EPON",
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
  return {
    totalOlts,
    totalOnus: onus.length,
    onlineOnus: onus.filter((o) => o.status === "Online").length,
    offlineOnus: onus.filter((o) => o.status === "Offline").length,
    offlineOlts: olts.filter((o) => o.status === "Offline").length,
    activeAlarms: alarms.filter((a) => !a.acknowledged).length,
    criticalAlarms: alarms.filter(
      (a) => a.severity === "Critical" && !a.acknowledged
    ).length,
    networkUptime,
    bandwidthUsage: "42.5 Tbps",
  };
}

const mockMetrics = buildMetrics(mockOlts, mockOnus, mockAlarms);

const ApiDataContext = createContext<ApiDataState | null>(null);

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

  return (
    <ApiDataContext.Provider value={state}>
      {children}
    </ApiDataContext.Provider>
  );
}

export function useApiData(): ApiDataState {
  const ctx = useContext(ApiDataContext);
  if (!ctx) {
    throw new Error("useApiData must be used inside <ApiDataProvider>");
  }
  return ctx;
}
