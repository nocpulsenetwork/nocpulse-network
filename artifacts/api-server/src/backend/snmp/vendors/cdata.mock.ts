/**
 * CdataMockAdapter — mock SNMP adapter for C-DATA GPON/XPON OLTs.
 *
 * Vendor: C-DATA (also known as FiberDesk)
 * Supported models: FD1616GS, FD8920, FD1204SN, FD7920E
 * Protocol (future): SNMP v2c
 * Enterprise OID: 1.3.6.1.4.1.34592
 * Key MIBs (future): CDATA-GPON-MIB, CDATA-EPON-MIB, CDATA-SYSTEM-MIB
 *
 * ─── Mock behaviour ──────────────────────────────────────────────────────
 *
 *   C-DATA olt-005 (West-OLT-CDATA-01) is "online" with XPON ports.
 *   The ONU dataset includes two XPON ONUs (onu-009, onu-010) both online
 *   with valid optical power, traffic counters, and service profiles.
 *
 *   One warning-level alarm is present (auth-fail on onu-010), testing
 *   that callers can handle an online OLT with a low-severity alarm.
 *
 * ─── Real SNMP implementation notes ──────────────────────────────────────
 *
 *   getOltInfo():
 *     - Standard sysDescr / sysUpTime (RFC 1213)
 *     - GET 1.3.6.1.4.1.34592.1.2.1.1.4.0 (cdataCpuUsage) for CPU %
 *     - GET 1.3.6.1.4.1.34592.1.2.1.1.5.0 (cdataMemTotal)
 *     - GET 1.3.6.1.4.1.34592.1.2.1.1.6.0 (cdataMemUsed)
 *       → memUsagePercent = cdataMemUsed / cdataMemTotal × 100
 *     - GET 1.3.6.1.4.1.34592.1.2.1.1.7.0 (cdataTemperature) for °C
 *     - NOTE: FD7920E may use a different OID subtree — check sysObjectID first
 *
 *   getOnuList() + getOnuOpticalPower():
 *     - WALK 1.3.6.1.4.1.34592.5.1.3.1 (cdataGponOnuTable) for GPON/XPON ONUs
 *     - WALK 1.3.6.1.4.1.34592.5.1.4.1.1.3 (cdataGponOnuRxPower) for RX dBm
 *     - WALK 1.3.6.1.4.1.34592.5.1.4.1.1.4 (cdataGponOnuTxPower) for TX dBm
 *     - Optical units for GPON/XPON: raw int ÷ 100 = dBm (signed)
 *     - Optical units for EPON: raw int ÷ 10 = dBm (signed)
 *     - operState: 1 = online, 2 = offline
 *
 *   getAlarms():
 *     - WALK 1.3.6.1.4.1.34592.1.4.1.1 (cdataAlarmTable) — verify per firmware
 *     - Severity map: 1=critical 2=major 3=minor 4=warning
 *     - MIB bundle is downloadable from device HTTP UI at /mib/ on most firmware
 */

import { BaseMockSnmpAdapter } from "../base-mock-adapter";
import type { Vendor } from "../types";

export class CdataMockAdapter extends BaseMockSnmpAdapter {
  override readonly vendor: Vendor = "cdata";

  // C-DATA FD1616GS responds at mid-to-fast speed
  protected override connectMinMs = 12;
  protected override connectMaxMs = 45;
  protected override oltInfoMinMs = 20;
  protected override oltInfoMaxMs = 60;
  protected override ponPortsMinMs = 8;
  protected override ponPortsMaxMs = 28;
  protected override onuListMinMs = 70;
  protected override onuListMaxMs = 180;
  protected override opticalMinMs = 45;
  protected override opticalMaxMs = 110;
  protected override statusMinMs = 28;
  protected override statusMaxMs = 75;
  protected override alarmsMinMs = 18;
  protected override alarmsMaxMs = 55;
}
