/**
 * HuaweiMockAdapter — mock SNMP adapter for Huawei MA5800 / MA5600T OLTs.
 *
 * Vendor: Huawei
 * Supported models: MA5800-X7, MA5800-X15, MA5600T, MA5683T
 * Protocol (future): SNMP v2c/v3
 * Key MIBs (future): HUAWEI-GPON-MIB, HUAWEI-EPON-MIB, HUAWEI-DEVICE-MIB
 *
 * ─── Mock behaviour ──────────────────────────────────────────────────────
 *
 *   All methods delegate to BaseMockSnmpAdapter which filters MOCK_OLTS,
 *   MOCK_ONUS, and MOCK_ALARMS for the requested OLT ID.
 *
 *   The Huawei adapter uses the fastest delay profile — MA5800 series OLTs
 *   respond quickly to SNMP GETs in practice.
 *
 * ─── Real SNMP implementation notes ──────────────────────────────────────
 *
 *   getOltInfo():
 *     - GET 1.3.6.1.2.1.1.1.0 (sysDescr) for model/firmware string
 *     - GET 1.3.6.1.2.1.1.3.0 (sysUpTime) for uptime (centiseconds ÷ 100)
 *     - WALK 1.3.6.1.4.1.2011.6.3.9.1.1.1.3 (hwCpuUsage) for CPU %
 *     - WALK 1.3.6.1.4.1.2011.6.3.9.1.2.1.4 (hwMemUsage) for memory %
 *     - GET  1.3.6.1.4.1.2011.10.2.1.3.1.1.8 (hwEntityTemperature) for °C
 *
 *   getOnuList() + getOnuOpticalPower():
 *     - WALK 1.3.6.1.4.1.2011.6.139.9.3.8.100.1.1 (hwGponOnuTable)
 *     - WALK 1.3.6.1.4.1.2011.6.139.9.3.8.100.2.1.1.3 (hwGponOnuRxOpticalPower)
 *     - WALK 1.3.6.1.4.1.2011.6.139.9.3.8.100.2.1.1.4 (hwGponOnuTxOpticalPower)
 *     - Optical units: raw int ÷ 100 = dBm (e.g. -1872 → -18.72 dBm)
 *     - operState: 1 = online, 2 = offline
 *
 *   getAlarms():
 *     - WALK 1.3.6.1.4.1.2011.2.6.13.1.2.1 (hwAlarmActiveTable)
 *     - Severity: 1=critical 2=major 3=minor 4=warning
 */

import { BaseMockSnmpAdapter } from "../base-mock-adapter";
import type { Vendor } from "../types";

export class HuaweiMockAdapter extends BaseMockSnmpAdapter {
  override readonly vendor: Vendor = "huawei";

  // Huawei MA5800 responds quickly to SNMP — use the tightest delay window
  protected override connectMinMs = 10;
  protected override connectMaxMs = 40;
  protected override oltInfoMinMs = 15;
  protected override oltInfoMaxMs = 45;
  protected override ponPortsMinMs = 8;
  protected override ponPortsMaxMs = 25;
  protected override onuListMinMs = 60;
  protected override onuListMaxMs = 160;
  protected override opticalMinMs = 40;
  protected override opticalMaxMs = 100;
  protected override statusMinMs = 25;
  protected override statusMaxMs = 65;
  protected override alarmsMinMs = 15;
  protected override alarmsMaxMs = 50;
}
