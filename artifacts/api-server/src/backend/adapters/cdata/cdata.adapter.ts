import type { VendorAdapter, AdapterCapabilities } from "../../core/adapter-registry";
import type { OltNormalized, OltPollRequest } from "../../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../../types/onu.types";
import type { AlarmNormalized } from "../../types/alarm.types";
import type { OnuDiscoveryResult, OnuDiscoverySummary, RealPonPort } from "../../types/onu-discovery.types";
import { RealSnmpClient } from "../../snmp/real-snmp-client";

/**
 * C-DATA OLT Adapter
 *
 * Supported models: FD1616GS, FD8920, FD1104S, FD1204S
 * Protocol: SNMP v2c
 * MIB: CDATA-GPON-MIB (cdataGponOnuTable — Enterprise OID 1.3.6.1.4.1.34592)
 *
 * ─── Implemented ─────────────────────────────────────────────────────────────
 *  • discoverOnus() — reads cdataGponOnuTable via GETBULK + GET (read-only)
 *    Returns: total count, online/offline counts, per-PON breakdown, ONU list
 *
 * ─── TODO ────────────────────────────────────────────────────────────────────
 *  • pollOlt()    — SNMP walk CDATA-GPON-MIB system table
 *  • pollOnu()    — cdataGponOnuInfoEntry, cdataGponOnuOpticalEntry
 *  • pollAlarms() — cdataAlarmTable
 */
export class CdataAdapter implements VendorAdapter {
  readonly vendor = "cdata" as const;

  capabilities(): AdapterCapabilities {
    return {
      oltInfo:      true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: false,
      alarmPolling: true,
      configRead:   false,
      configWrite:  false,
    };
  }

  async pollOlt(_request: OltPollRequest): Promise<OltNormalized> {
    throw new Error("CdataAdapter.pollOlt — not yet implemented");
  }

  async pollOnu(_request: OnuPollRequest): Promise<OnuNormalized> {
    throw new Error("CdataAdapter.pollOnu — not yet implemented");
  }

  async pollAlarms(_oltRequest: OltPollRequest): Promise<AlarmNormalized[]> {
    throw new Error("CdataAdapter.pollAlarms — not yet implemented");
  }

  /**
   * Discover ONUs via read-only SNMP walk of cdataGponOnuTable.
   *
   * Safety contract:
   *   • Read-only: GETBULK (index column) + GET (attribute columns)
   *   • At most 50 ONUs (bounded by RealSnmpClient.readOnuTable limit)
   *   • Timeout: 3 000 ms, retries: 1
   *   • No SNMP SET, no background polling, no persistent session
   */
  async discoverOnus(request: OltPollRequest): Promise<OnuDiscoveryResult> {
    const client = new RealSnmpClient({
      host:      request.ipAddress,
      community: request.community ?? "public",
      port:      request.port      ?? 161,
      timeoutMs: 3_000,
      retries:   1,
    });

    const snmpResult = await client.readOnuTable("CDATA", 50);

    // ── Derive counts ──────────────────────────────────────────────────────
    const onlineCount  = snmpResult.onus.filter(o => o.status === "online").length;
    const offlineCount = snmpResult.onus.filter(o => o.status === "offline").length;
    const unknownCount = snmpResult.onus.filter(o => o.status === "unknown").length;

    // ── Per-PON-port breakdown ─────────────────────────────────────────────
    const portMap = new Map<string, { total: number; online: number; offline: number; unknown: number }>();
    for (const onu of snmpResult.onus) {
      const entry = portMap.get(onu.ponPort) ?? { total: 0, online: 0, offline: 0, unknown: 0 };
      entry.total++;
      if (onu.status === "online")  entry.online++;
      else if (onu.status === "offline") entry.offline++;
      else entry.unknown++;
      portMap.set(onu.ponPort, entry);
    }

    const ponPorts: RealPonPort[] = [...portMap.entries()].map(([id, counts]) => ({ id, ...counts }));

    const onus: OnuDiscoverySummary[] = snmpResult.onus.map(o => ({
      onuId:   o.onuId,
      ponPort: o.ponPort,
      status:  o.status,
      serial:  o.serial,
      type:    o.type,
    }));

    return {
      hasData:       true,
      oltId:         request.oltId,
      totalOnus:     snmpResult.totalFound,
      onlineOnus:    onlineCount,
      offlineOnus:   offlineCount,
      unknownOnus:   unknownCount,
      ponPortCount:  portMap.size,
      ponPorts,
      onus,
      discoveredAt:  new Date().toISOString(),
      latencyMs:     snmpResult.latencyMs,
      source:        "live-snmp",
      vendor:        "CDATA",
      mibUsed:       snmpResult.mibUsed,
      message:       snmpResult.message,
    };
  }
}
