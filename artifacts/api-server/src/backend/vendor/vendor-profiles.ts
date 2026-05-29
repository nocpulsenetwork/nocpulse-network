/**
 * Vendor Profiles — read-only multi-vendor support structure.
 *
 * Each profile describes the default connectivity parameters and capability
 * flags for a supported OLT vendor. These are static reference data;
 * nothing here connects to real devices.
 *
 * Safety:
 *   - writeSupported is always false — no SNMP SET, no reboot/disable/enable
 *   - readOnlySupported covers SNMP GET/WALK only
 *   - No background processes; this is pure in-memory constant data
 */

import type { Vendor } from "../types/universal.types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SnmpVersion = "v1" | "v2c" | "v3";

export interface VendorProfile {
  vendorName: string;
  vendor: Vendor | "custom";
  defaultSnmpPort: number;
  defaultSshPort: number;
  defaultTelnetPort: number;
  supportedSnmpVersions: SnmpVersion[];
  readOnlySupported: boolean;
  /** Always false — write commands disabled until VPS real OLT testing. */
  writeSupported: false;
  notes: string;
}

// ─── Profiles ────────────────────────────────────────────────────────────────

const VENDOR_PROFILES: VendorProfile[] = [
  {
    vendorName:             "C-DATA",
    vendor:                 "cdata",
    defaultSnmpPort:        161,
    defaultSshPort:         22,
    defaultTelnetPort:      23,
    supportedSnmpVersions:  ["v2c", "v3"],
    readOnlySupported:      true,
    writeSupported:         false,
    notes:
      "FD1616GS / FD1104S tested on SNMP v2c. v3 authPriv supported on R1516+. " +
      "Telnet available but prefer SSH. SNMP community default: public.",
  },
  {
    vendorName:             "Huawei",
    vendor:                 "huawei",
    defaultSnmpPort:        161,
    defaultSshPort:         22,
    defaultTelnetPort:      23,
    supportedSnmpVersions:  ["v2c", "v3"],
    readOnlySupported:      true,
    writeSupported:         false,
    notes:
      "MA5800 / MA5600 series. SNMP v3 strongly recommended in production. " +
      "iManager NMS MIBs available. STB community often locked; use dedicated NMS community.",
  },
  {
    vendorName:             "BDCOM",
    vendor:                 "bdcom",
    defaultSnmpPort:        161,
    defaultSshPort:         22,
    defaultTelnetPort:      23,
    supportedSnmpVersions:  ["v1", "v2c"],
    readOnlySupported:      true,
    writeSupported:         false,
    notes:
      "P3310C / P3608 series. Primarily SNMP v2c; v3 support varies by firmware. " +
      "Telnet is common on older firmware — disable in production. Trap source IP must be set explicitly.",
  },
  {
    vendorName:             "ZTE",
    vendor:                 "zte",
    defaultSnmpPort:        161,
    defaultSshPort:         22,
    defaultTelnetPort:      23,
    supportedSnmpVersions:  ["v2c", "v3"],
    readOnlySupported:      true,
    writeSupported:         false,
    notes:
      "C300 / C600 series. SNMP v2c reliable; v3 available on V2.1+. " +
      "ONU optical data in ZXAN-ONU MIB. SSH preferred; Telnet disable recommended.",
  },
  {
    vendorName:             "VSOL",
    vendor:                 "vsol",
    defaultSnmpPort:        161,
    defaultSshPort:         22,
    defaultTelnetPort:      23,
    supportedSnmpVersions:  ["v2c"],
    readOnlySupported:      true,
    writeSupported:         false,
    notes:
      "V1600G series. SNMP v2c only; no v3 support as of V2.0.3. " +
      "Web UI on port 80 for basic monitoring. Trap community configurable.",
  },
  {
    vendorName:             "Custom",
    vendor:                 "custom",
    defaultSnmpPort:        161,
    defaultSshPort:         22,
    defaultTelnetPort:      23,
    supportedSnmpVersions:  ["v1", "v2c", "v3"],
    readOnlySupported:      true,
    writeSupported:         false,
    notes:
      "Generic fallback profile for unsupported or custom OLT hardware. " +
      "All SNMP versions listed as potentially supported — validate per device. " +
      "Fields are configurable in future provisioning UI.",
  },
];

// ─── Lookup map ──────────────────────────────────────────────────────────────

const PROFILE_MAP = new Map<string, VendorProfile>(
  VENDOR_PROFILES.map(p => [p.vendor.toLowerCase(), p])
);

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns the VendorProfile for the given vendor key (case-insensitive).
 * Falls back to the "custom" profile for unknown vendors.
 */
export function getVendorProfile(vendor: string): VendorProfile {
  return PROFILE_MAP.get(vendor.toLowerCase()) ?? (PROFILE_MAP.get("custom") as VendorProfile);
}

/**
 * Returns all registered vendor profiles.
 */
export function getAllVendorProfiles(): VendorProfile[] {
  return VENDOR_PROFILES;
}
