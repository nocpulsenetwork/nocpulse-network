/**
 * GenericMockAdapter — mock SNMP adapter using standard RFC MIBs only.
 *
 * Vendor: Generic (fallback for any unrecognised vendor)
 * Protocol (future): SNMP v2c/v3
 * MIBs: RFC 1213 (MIB-II), IF-MIB (RFC 2863), ENTITY-MIB (RFC 4133),
 *       HOST-RESOURCES-MIB (RFC 2790), SNMPv2-MIB (RFC 3418)
 *
 * ─── Mock behaviour ──────────────────────────────────────────────────────
 *
 *   The Generic adapter is used by the registry as a fallback when no
 *   vendor-specific adapter matches the OLT's vendor field. Since the mock
 *   dataset has one OLT per vendor (olt-001 to olt-005) and none with
 *   vendor="generic", the Generic adapter's methods will return OltNotFoundError
 *   for OLT IDs that don't match. This is correct — the registry should be
 *   called with a known OLT ID.
 *
 *   To test the Generic adapter directly in development, pass any valid OLT ID
 *   (e.g. "olt-001") regardless of its vendor — the base class will find it.
 *
 * ─── Capability limitations ──────────────────────────────────────────────
 *
 *   Standard MIBs provide:
 *     ✓ OLT system info (sysDescr, sysUpTime, hrProcessorLoad, hrStorageUsed)
 *     ✓ PON port list (IF-MIB ifTable — port state only, no ONU counts)
 *     ✗ ONU list  (requires vendor ONU table — not in standard MIBs)
 *     ✗ Optical power (requires vendor optics OID — not in standard MIBs)
 *     ✗ Full alarm table (standard MIBs only expose link-down via traps)
 *
 *   In mock mode, all capabilities return data from the MOCK_* arrays.
 *   In real SNMP mode, the capabilities() flags below will guide callers
 *   on what is and is not available.
 *
 * ─── Real SNMP implementation notes ──────────────────────────────────────
 *
 *   getOltInfo():
 *     - GET 1.3.6.1.2.1.1.1.0 (sysDescr)   — vendor/model/firmware string
 *     - GET 1.3.6.1.2.1.1.3.0 (sysUpTime)  — centiseconds since last boot
 *     - WALK 1.3.6.1.2.1.25.3.3.1.2 (hrProcessorLoad) — CPU % (1-min avg)
 *     - WALK 1.3.6.1.2.1.25.2.3 (hrStorageTable) — compute memory %
 *
 *   getPonPorts():
 *     - WALK 1.3.6.1.2.1.2.2 (ifTable) — filter by ifType = PON (gpon/epon)
 *     - ONU counts NOT available from standard MIBs — set to 0
 *
 *   getOnuList() / getOnuOpticalPower():
 *     - Not possible with standard MIBs alone — return []
 *     - Log a warning suggesting upgrade to a vendor-specific adapter
 *
 *   getAlarms():
 *     - Monitor 1.3.6.1.2.1.2.2.1.8 (ifOperStatus) transitions for link-down
 *     - Walk 1.3.6.1.2.1.118.1.2.2 (alarmActiveMIB) if device supports RFC 3877
 */

import { BaseMockSnmpAdapter } from "../base-mock-adapter";
import type { MockAdapterCapabilities } from "../base-mock-adapter";
import type { Vendor } from "../types";

export class GenericMockAdapter extends BaseMockSnmpAdapter {
  override readonly vendor: Vendor = "generic";

  // Generic/unknown devices — use conservative mid-range delays
  protected override connectMinMs = 20;
  protected override connectMaxMs = 80;
  protected override oltInfoMinMs = 30;
  protected override oltInfoMaxMs = 90;
  protected override ponPortsMinMs = 15;
  protected override ponPortsMaxMs = 45;
  protected override onuListMinMs = 100;
  protected override onuListMaxMs = 280;
  protected override opticalMinMs = 70;
  protected override opticalMaxMs = 180;
  protected override statusMinMs = 40;
  protected override statusMaxMs = 110;
  protected override alarmsMinMs = 25;
  protected override alarmsMaxMs = 80;

  /**
   * Real capability flags for standard-MIB-only mode.
   *
   * In mock mode these flags don't affect the data returned (all methods
   * still return mock data). They are informational for callers that want
   * to know what a real Generic adapter supports.
   */
  override capabilities(): MockAdapterCapabilities {
    return {
      oltInfo:      true,   // sysDescr + hrProcessorLoad + hrStorageUsed
      ponPorts:     true,   // IF-MIB ifTable (port state only, no ONU counts)
      onuList:      false,  // requires vendor ONU table — not in standard MIBs
      opticalPower: false,  // requires vendor optics OID — not in standard MIBs
      onuStatus:    false,  // requires vendor ONU state OID — not in standard MIBs
      alarmPolling: false,  // link-down traps only — no alarm table in std MIBs
    };
  }
}
