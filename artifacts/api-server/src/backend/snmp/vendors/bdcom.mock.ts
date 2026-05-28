/**
 * BdcomMockAdapter — mock SNMP adapter for BDCOM EPON/GPON OLTs.
 *
 * Vendor: BDCOM
 * Supported models: P3310C, P3310B, P3608, GP3600
 * Protocol (future): SNMP v2c
 * Key MIBs (future): BDCOM-EPON-MIB, BDCOM-GPON-MIB, BDCOM-SYSTEM-MIB
 *
 * ─── Mock behaviour ──────────────────────────────────────────────────────
 *
 *   All methods delegate to BaseMockSnmpAdapter.
 *
 *   BDCOM OLTs run with elevated CPU and temperature in the mock dataset
 *   (olt-003 is in "degraded" state) — the alarm list for this OLT includes
 *   both high-temp and cpu-overload alarms, simulating a real degraded state.
 *
 *   The delay profile is wider than Huawei/ZTE, reflecting BDCOM's slower
 *   SNMP response under load (consistent with the degraded state mock).
 *
 * ─── Real SNMP implementation notes ──────────────────────────────────────
 *
 *   getOltInfo():
 *     - Standard sysDescr / sysUpTime (RFC 1213)
 *     - GET 1.3.6.1.4.1.3320.11.2.3.0 (bdCpuUsage5Min) — 5-minute CPU avg
 *     - GET 1.3.6.1.4.1.3320.11.1.1.0 (bdMemFree) + .11.1.2.0 (bdMemUsed)
 *       → compute memUsagePercent = bdMemUsed / (bdMemFree + bdMemUsed) × 100
 *     - GET 1.3.6.1.4.1.3320.18.1.0 (bdTemperature) — CHECK availability per model
 *       P3608 may not expose this OID; fall back to null if SNMP NOSUCHOBJECT
 *
 *   getOnuList() + getOnuOpticalPower():
 *     - WALK 1.3.6.1.4.1.3320.9.1.3.3.1 (bdEponOnuTable) for EPON
 *     - WALK 1.3.6.1.4.1.3320.9.2.1.1.1 (bdGponOnuTable) for GPON
 *     - WALK 1.3.6.1.4.1.3320.9.1.3.4.1.1.2 (bdEponOnuRxPower) — units: 0.1 dBm
 *     - WALK 1.3.6.1.4.1.3320.9.2.1.2.1.1.3 (bdGponOnuRxPower) — units: 0.01 dBm
 *
 *   NOTE: BDCOM optical power units differ between EPON (0.1 dBm) and GPON (0.01 dBm).
 *   Detect via sysDescr before deciding the divisor.
 *
 *   getAlarms():
 *     - BDCOM alarm MIB path is unconfirmed for all models.
 *     - Fall back to standard IF-MIB trap monitoring for link-down events.
 *     - WALK 1.3.6.1.4.1.3320.18.10.1 (bdAlarmTable) — VERIFY per firmware.
 */

import { BaseMockSnmpAdapter } from "../base-mock-adapter";
import type { MockAdapterCapabilities } from "../base-mock-adapter";
import type { Vendor } from "../types";

export class BdcomMockAdapter extends BaseMockSnmpAdapter {
  override readonly vendor: Vendor = "bdcom";

  // BDCOM under degraded conditions (olt-003) responds more slowly
  protected override connectMinMs = 15;
  protected override connectMaxMs = 60;
  protected override oltInfoMinMs = 30;
  protected override oltInfoMaxMs = 90;
  protected override ponPortsMinMs = 12;
  protected override ponPortsMaxMs = 40;
  protected override onuListMinMs = 100;
  protected override onuListMaxMs = 250;
  protected override opticalMinMs = 70;
  protected override opticalMaxMs = 160;
  protected override statusMinMs = 40;
  protected override statusMaxMs = 100;
  protected override alarmsMinMs = 25;
  protected override alarmsMaxMs = 80;

  /**
   * BDCOM alarm MIB support is model-dependent.
   * Mark alarmPolling as true because the mock returns data from MOCK_ALARMS,
   * but note that real implementation needs per-model MIB verification.
   *
   * TODO (real SNMP): add alarmPolling: false for models where MIB is unverified,
   * and fall back to link-down trap monitoring only.
   */
  override capabilities(): MockAdapterCapabilities {
    return {
      ...super.capabilities(),
      alarmPolling: true, // Mock returns data; real needs firmware verification
    };
  }
}
