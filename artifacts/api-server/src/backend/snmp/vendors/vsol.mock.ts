/**
 * VsolMockAdapter — mock SNMP adapter for VSOL GPON OLTs.
 *
 * Vendor: VSOL
 * Supported models: V1600G4, V2801F, V2802G, V2804RGW
 * Protocol (future): SNMP v2c (limited MIB documentation)
 * Enterprise OID (tentative): 1.3.6.1.4.1.37950
 *
 * ─── Mock behaviour ──────────────────────────────────────────────────────
 *
 *   VSOL olt-004 is "offline" in the mock dataset (fiber cut simulation).
 *   getOltInfo() returns the offline OLT with null CPU/memory/temperature.
 *   getOnuList() returns ONUs with all optical fields null and status "offline".
 *   getAlarms() returns the critical "link-down" alarm for this OLT.
 *
 *   This tests that callers correctly handle the fully-offline OLT case:
 *   all nulls for metrics, no traffic data, alarm present.
 *
 * ─── Capability limitations ──────────────────────────────────────────────
 *
 *   VSOL has minimal public SNMP documentation. The real adapter will have:
 *     onuList:      TENTATIVE — OID paths unverified, may return empty
 *     opticalPower: TENTATIVE — units unknown, needs live device validation
 *     alarmPolling: LIMITED  — no confirmed alarm MIB; RFC trap fallback only
 *
 *   The mock returns full data regardless (from MOCK_* constants).
 *   Real implementation should degrade gracefully when proprietary OIDs fail.
 *
 * ─── Real SNMP implementation notes ──────────────────────────────────────
 *
 *   Step 1: GET sysObjectID.0 and confirm enterprise = 37950
 *     - If different, log warning and fall back to GenericMockAdapter
 *
 *   getOltInfo():
 *     - Standard sysDescr / sysUpTime (RFC 1213)
 *     - Try GET 1.3.6.1.4.1.37950.1.1.1.0 (vsolCpuUsage) — TENTATIVE
 *     - Try GET 1.3.6.1.4.1.37950.1.1.2.0 (vsolMemUsage) — TENTATIVE
 *     - On SNMP NOSUCHOBJECT: fall back to HOST-RESOURCES-MIB (hrProcessorLoad)
 *
 *   getOnuList() + getOnuOpticalPower():
 *     - WALK 1.3.6.1.4.1.37950.2.1.1.1 (vsolGponOnuTable) — TENTATIVE
 *     - If walk returns 0 rows: log info and return [] (CLI fallback may be needed)
 *     - Optical units: UNKNOWN — test against live device before assuming 0.01 dBm
 *
 *   getAlarms():
 *     - No confirmed VSOL alarm MIB
 *     - Monitor IF-MIB ifOperStatus transitions as proxy for link-down events
 */

import { BaseMockSnmpAdapter } from "../base-mock-adapter";
import type { MockAdapterCapabilities } from "../base-mock-adapter";
import type { Vendor } from "../types";

export class VsolMockAdapter extends BaseMockSnmpAdapter {
  override readonly vendor: Vendor = "vsol";

  // VSOL responds at mid-range speed; offline OLTs won't respond at all in real SNMP
  protected override connectMinMs = 20;
  protected override connectMaxMs = 70;
  protected override oltInfoMinMs = 25;
  protected override oltInfoMaxMs = 75;
  protected override ponPortsMinMs = 12;
  protected override ponPortsMaxMs = 38;
  protected override onuListMinMs = 90;
  protected override onuListMaxMs = 220;
  protected override opticalMinMs = 55;
  protected override opticalMaxMs = 130;
  protected override statusMinMs = 30;
  protected override statusMaxMs = 85;
  protected override alarmsMinMs = 20;
  protected override alarmsMaxMs = 60;

  /**
   * VSOL capabilities are marked as tentative for optical and alarm polling.
   * The mock returns full data; real implementation must probe before committing
   * to proprietary OID walks.
   */
  override capabilities(): MockAdapterCapabilities {
    return {
      oltInfo:      true,
      ponPorts:     true,
      onuList:      true,  // TENTATIVE in real SNMP — OID paths unverified
      opticalPower: true,  // TENTATIVE in real SNMP — units unknown
      onuStatus:    true,
      alarmPolling: false, // No confirmed alarm MIB; will use trap fallback
    };
  }
}
