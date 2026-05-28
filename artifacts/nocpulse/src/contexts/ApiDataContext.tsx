/**
 * ApiDataContext — provides fetched backend data app-wide.
 *
 * Rules:
 *  - Single fetch on mount via Promise.all; no intervals, no background refresh
 *  - Starts with mock data synchronously so pages never render empty
 *  - On API success: replaces data with live backend data
 *  - On API failure: keeps mock data, sets error for debugging
 *  - CPU safe: one effect, no timers, no polling loops
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
} from "@/data/mockData";

type DataSource = "api" | "mock";

export interface ApiMetrics {
  totalOlts: number;
  totalOnus: number;
  onlineOnus: number;
  offlineOnus: number;
  offlineOlts: number;
  activeAlarms: number;
  criticalAlarms: number;
  networkUptime: number;
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
  return {
    totalOlts: olts.length,
    totalOnus: onus.length,
    onlineOnus: onus.filter((o) => o.status === "Online").length,
    offlineOnus: onus.filter((o) => o.status === "Offline").length,
    offlineOlts: olts.filter((o) => o.status === "Offline").length,
    activeAlarms: alarms.filter((a) => !a.acknowledged).length,
    criticalAlarms: alarms.filter(
      (a) => a.severity === "Critical" && !a.acknowledged
    ).length,
    networkUptime: 99.98,
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

    /* Safety net: loading screen must never persist longer than 1500 ms.
       If the fetch resolves first, it clears this timer. */
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
    }, 1500);

    Promise.all([fetchOlts(), fetchOnus(), fetchAlarms()])
      .then(([olts, onus, alarms]) => {
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
