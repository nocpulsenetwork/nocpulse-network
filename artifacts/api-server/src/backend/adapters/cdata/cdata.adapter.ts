import type { VendorAdapter, AdapterCapabilities } from "../../core/adapter-registry";
import type { OltNormalized, OltPollRequest } from "../../types/olt.types";
import type { OnuNormalized, OnuPollRequest } from "../../types/onu.types";
import type { AlarmNormalized } from "../../types/alarm.types";
import type { OnuDiscoveryResult, OnuDiscoverySummary, RealPonPort } from "../../types/onu-discovery.types";
import { RealSnmpClient, detectCdataPonType } from "../../snmp/real-snmp-client";
import type { ReadOnuTableResult } from "../../snmp/real-snmp-client";

/**
 * C-DATA OLT Adapter
 *
 * Supported models:
 *   GPON — FD1616GS, FD8920, FD1204SN
 *   EPON — FD1208S, FD1104S, FD1204S
 *
 * Protocol: SNMP v2c
 * MIBs:
 *   CDATA-GPON-MIB: cdataGponOnuTable (1.3.6.1.4.1.34592.5.1.3.1)
 *   CDATA-EPON-MIB: cdataEponOnuTable (1.3.6.1.4.1.34592.1.1.3.1)
 *
 * ─── PON type detection ───────────────────────────────────────────────────
 *  discoverOnus() reads sysDescr first, then selects the correct MIB table:
 *    • sysDescr contains "EPON" or matches FD12xxS- pattern → EPON table
 *    • sysDescr contains "GPON" or matches FD16xxGS pattern → GPON table
 *    • Unknown → tries GPON first, falls back to EPON if 0 results
 *
 * ─── Implemented ─────────────────────────────────────────────────────────
 *  • discoverOnus() — auto-selects EPON or GPON MIB, read-only SNMP
 *
 * ─── TODO ────────────────────────────────────────────────────────────────
 *  • pollOlt()    — system table
 *  • pollOnu()    — optical + stats tables
 *  • pollAlarms() — alarm table
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
   * Discover ONUs via read-only SNMP.
   *
   * Automatically detects whether the device is EPON or GPON by reading
   * sysDescr, then queries the correct MIB table. If the PON type cannot
   * be determined from sysDescr alone, tries GPON first and falls back to
   * EPON when the GPON table returns 0 entries.
   *
   * Safety contract:
   *   • Read-only: getSysInfo() GET + GETBULK + GET (3 PDUs max)
   *   • At most 50 ONUs (bounded by RealSnmpClient.readOnuTable limit)
   *   • Timeout: 3 000 ms, retries: 1
   *   • No SNMP SET, no background polling, no persistent session
   */
  async discoverOnus(request: OltPollRequest): Promise<OnuDiscoveryResult> {
    const client = new RealSnmpClient({
      host:      request.ipAddress,
      community: request.community ?? "public",
      port:      request.port      ?? 161,
      timeoutMs: 5_000,
      retries:   1,
    });

    // ── Step 1: Read sysDescr + sysObjectID to detect PON type and firmware ─
    const sysInfo  = await client.getSysInfo();

    // ── EasyPath firmware (FD1208S-B0 V1.6.0, sysObjId 1.3.6.1.4.1.17409) ─
    // Different OID tree — bypass the generic EPON/GPON readOnuTable flow.
    if (sysInfo.sysObjectID.startsWith("1.3.6.1.4.1.17409")) {
      const snmpResult   = await client.readEasyPathOnuTable(500);
      const onlineCount  = snmpResult.onus.filter(o => o.status === "online").length;
      const offlineCount = snmpResult.onus.filter(o => o.status === "offline").length;
      const unknownCount = snmpResult.onus.filter(o => o.status === "unknown").length;
      const portMap      = new Map<string, { total: number; online: number; offline: number; unknown: number }>();
      for (const onu of snmpResult.onus) {
        const e = portMap.get(onu.ponPort) ?? { total: 0, online: 0, offline: 0, unknown: 0 };
        e.total++;
        if (onu.status === "online")       e.online++;
        else if (onu.status === "offline") e.offline++;
        else                               e.unknown++;
        portMap.set(onu.ponPort, e);
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
        hasData:      true,
        oltId:        request.oltId,
        totalOnus:    snmpResult.totalFound,
        onlineOnus:   onlineCount,
        offlineOnus:  offlineCount,
        unknownOnus:  unknownCount,
        ponPortCount: portMap.size,
        ponPorts,
        onus,
        discoveredAt: new Date().toISOString(),
        latencyMs:    snmpResult.latencyMs,
        source:       "live-snmp",
        vendor:       "CDATA",
        mibUsed:      snmpResult.mibUsed,
        message:      snmpResult.message + " (EasyPath EPON)",
      };
    }

    const ponType  = detectCdataPonType(sysInfo.sysDescr);

    // ── Step 2: Select primary MIB table based on detected PON type ──────
    const primaryKey   = ponType === "EPON" ? "CDATA-EPON" : "CDATA-GPON";
    const fallbackKey  = ponType === "EPON" ? "CDATA-GPON" : "CDATA-EPON";
    const useFallback  = ponType === "unknown"; // try both when type is ambiguous

    let snmpResult: ReadOnuTableResult = await client.readOnuTable(primaryKey, 50);

    // ── Step 3: Dynamic probe fallback (EPON only) ───────────────────────
    // When the static CDATA-EPON table returns 0 ONUs, the table OID path
    // may differ from what the firmware exposes. The probe walks the C-DATA
    // EPON enterprise subtree (1.3.6.1.4.1.34592.1.*), finds all 6-byte
    // OctetStrings (ONU MAC/LLID addresses), and derives the table structure
    // at runtime — so it works regardless of firmware version.
    if (snmpResult.totalFound === 0 && (ponType === "EPON" || primaryKey === "CDATA-EPON")) {
      const probeResult = await client.readCdataEponOnusProbe(50);
      if (probeResult.totalFound > 0) {
        snmpResult = probeResult;
      }
    }

    // ── Step 4: Fallback — try opposite PON-type table if still 0 ────────
    // Only fall back when:
    //   a) PON type was unknown (we guessed GPON first), OR
    //   b) PON type was detected but both static table and probe returned 0
    if (snmpResult.totalFound === 0) {
      const altResult = await client.readOnuTable(
        useFallback ? fallbackKey : (ponType === "EPON" ? "CDATA-GPON" : "CDATA-EPON"),
        50,
      );
      if (altResult.totalFound > 0) {
        snmpResult = altResult;
      }
    }

    // ── Derive counts ──────────────────────────────────────────────────────
    const onlineCount  = snmpResult.onus.filter(o => o.status === "online").length;
    const offlineCount = snmpResult.onus.filter(o => o.status === "offline").length;
    const unknownCount = snmpResult.onus.filter(o => o.status === "unknown").length;

    // ── Per-PON-port breakdown ─────────────────────────────────────────────
    const portMap = new Map<string, { total: number; online: number; offline: number; unknown: number }>();
    for (const onu of snmpResult.onus) {
      const entry = portMap.get(onu.ponPort) ?? { total: 0, online: 0, offline: 0, unknown: 0 };
      entry.total++;
      if (onu.status === "online")       entry.online++;
      else if (onu.status === "offline") entry.offline++;
      else                               entry.unknown++;
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

    // ── Build human-readable message including PON type ────────────────────
    const ponLabel  = snmpResult.mibUsed.toLowerCase().includes("epon") ? "EPON" : "GPON";
    const typeNote  = ponType === "unknown" ? ` (PON type auto-detected as ${ponLabel} via fallback)` : ` (${ponLabel})`;
    const baseMsg   = snmpResult.message;
    const message   = baseMsg + typeNote;

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
      message,
    };
  }
}
