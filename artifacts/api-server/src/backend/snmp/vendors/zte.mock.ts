/**
 * ZteMockAdapter — mock SNMP adapter for ZTE ZXA10 C-series OLTs.
 *
 * Vendor: ZTE
 * Supported models: ZXA10 C300, C320, C600, C650
 * Protocol (future): SNMP v2c/v3 + NETCONF
 * Key MIBs (future): ZTE-AN-GPON-MIB, ZTE-AN-EPON-MIB, ZTE-AN-ALARM-MIB
 *
 * ─── Mock behaviour ──────────────────────────────────────────────────────
 *
 *   All methods delegate to BaseMockSnmpAdapter.
 *   The ZTE adapter uses slightly higher delays than Huawei, reflecting the
 *   slower SNMP response typical of C300 firmware in real deployments.
 *
 * ─── Real SNMP implementation notes ──────────────────────────────────────
 *
 *   getOltInfo():
 *     - Standard sysDescr / sysUpTime (RFC 1213)
 *     - GET 1.3.6.1.4.1.3902.3.103.1.2.1.2.1 (zxAnDevCpuUsage) for CPU %
 *     - GET 1.3.6.1.4.1.3902.3.103.1.2.2.2.1 (zxAnDevMemUsage) for memory %
 *     - WALK 1.3.6.1.4.1.3902.3.103.1.2.4.1.1.1.3 (zxAnDevTempValue) for °C
 *
 *   getOnuList() + getOnuOpticalPower():
 *     - WALK 1.3.6.1.4.1.3902.3.101.13.10.1.1 (zxAnGponOnuTable)
 *     - WALK 1.3.6.1.4.1.3902.3.101.13.10.3.1.1.1.3 (zxAnGponOnuRxPower)
 *     - WALK 1.3.6.1.4.1.3902.3.101.13.10.3.1.1.1.4 (zxAnGponOnuTxPower)
 *     - Optical units: raw int ÷ 100 = dBm (signed — may need int16 sign extension)
 *     - operState: 1 = online, 2 = offline
 *
 *   NOTE: Some C300 firmware versions shift OID subtrees between releases.
 *   Add a model detection step from sysObjectID before ONU walks.
 *
 *   getAlarms():
 *     - WALK 1.3.6.1.4.1.3902.3.103.3.1.1 (zxAnAlarmTable)
 *     - Severity: 1=critical 2=major 3=minor 4=warning
 */

import { BaseMockSnmpAdapter } from "../base-mock-adapter";
import type { Vendor } from "../types";

export class ZteMockAdapter extends BaseMockSnmpAdapter {
  override readonly vendor: Vendor = "zte";

  // ZTE C300 is slightly slower on SNMP walks than Huawei
  protected override connectMinMs = 15;
  protected override connectMaxMs = 55;
  protected override oltInfoMinMs = 25;
  protected override oltInfoMaxMs = 70;
  protected override ponPortsMinMs = 10;
  protected override ponPortsMaxMs = 35;
  protected override onuListMinMs = 90;
  protected override onuListMaxMs = 220;
  protected override opticalMinMs = 60;
  protected override opticalMaxMs = 140;
  protected override statusMinMs = 35;
  protected override statusMaxMs = 90;
  protected override alarmsMinMs = 20;
  protected override alarmsMaxMs = 65;
}
