/**
 * Vendor Registry — maps vendor names to adapter metadata and factory functions.
 *
 * This is the single place where all supported vendors are declared.
 * Route handlers, services, and the polling engine look up adapters here.
 *
 * ─── Adding a new vendor ─────────────────────────────────────────────────────
 *
 *   1. Create `adapters/<vendor>/<vendor>.adapter.ts` implementing DeviceAdapter.
 *   2. Add an entry to VENDOR_REGISTRY below.
 *   3. Add the vendor string to the Vendor union in types/universal.types.ts.
 *   4. Document supported models and firmware versions in the adapter file.
 *
 * ─── Registration vs instantiation ──────────────────────────────────────────
 *
 *   Adapters are registered as factory functions (not instances) so the
 *   polling engine can create one adapter instance per OLT connection — each
 *   instance holds its own session state (SNMP session, SSH channel, etc.)
 *   without sharing mutable state between concurrent OLT polls.
 */

import type { DeviceAdapter, AdapterCapabilities } from "./device-adapter";
import type { Vendor } from "../types/universal.types";

export interface VendorRegistryEntry {
  /** Vendor identifier (matches Vendor union). */
  vendor: Vendor;

  /** Human-readable display name for the UI. */
  displayName: string;

  /** Representative supported models (for documentation / UI hints). */
  supportedModels: string[];

  /** Primary protocol used by this vendor's adapter. */
  protocol: "snmp-v2c" | "snmp-v3" | "ssh-cli" | "netconf" | "http-rest" | "mixed";

  /**
   * Static capabilities reported before any live device connection.
   * Used by the UI to show/hide features (e.g. "Reboot ONU" button).
   */
  staticCapabilities: AdapterCapabilities;

  /**
   * Factory — creates a fresh, unconnected adapter instance.
   * Call connect() before using any other method.
   *
   * TODO: replace the placeholder return with a real adapter import, e.g.:
   *   factory: () => new HuaweiAdapter()
   */
  factory: () => DeviceAdapter;
}

// ─── Placeholder adapter factory ─────────────────────────────────────────────
//     Returned by all registry entries until real adapters are implemented.

function makePlaceholderAdapter(vendor: Vendor): DeviceAdapter {
  return {
    vendor,
    capabilities: () => VENDOR_REGISTRY[vendor]!.staticCapabilities,
    connect: async () => {
      throw new Error(`${vendor} adapter — connect() not yet implemented`);
    },
    getOltInfo: async () => {
      throw new Error(`${vendor} adapter — getOltInfo() not yet implemented`);
    },
    getOnuList: async () => {
      throw new Error(`${vendor} adapter — getOnuList() not yet implemented`);
    },
    getOnuDetails: async () => {
      throw new Error(`${vendor} adapter — getOnuDetails() not yet implemented`);
    },
    rebootOnu: async () => {
      throw new Error(`${vendor} adapter — rebootOnu() not yet implemented`);
    },
    disableOnu: async () => {
      throw new Error(`${vendor} adapter — disableOnu() not yet implemented`);
    },
  };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const VENDOR_REGISTRY: Record<Vendor, VendorRegistryEntry> = {

  huawei: {
    vendor: "huawei",
    displayName: "Huawei",
    supportedModels: ["MA5800-X2", "MA5800-X7", "MA5800-X15", "MA5600T", "MA5683T"],
    protocol: "snmp-v3",
    staticCapabilities: {
      oltInfo: true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: true,
      alarmPolling: true,
      onuReboot: false,   // requires SSH CLI (planned)
      onuDisable: false,
    },
    // TODO: factory: () => new HuaweiAdapter()
    factory: () => makePlaceholderAdapter("huawei"),
  },

  zte: {
    vendor: "zte",
    displayName: "ZTE",
    supportedModels: ["C300", "C320", "C600", "C650"],
    protocol: "snmp-v2c",
    staticCapabilities: {
      oltInfo: true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: true,
      alarmPolling: true,
      onuReboot: false,
      onuDisable: false,
    },
    // TODO: factory: () => new ZteAdapter()
    factory: () => makePlaceholderAdapter("zte"),
  },

  bdcom: {
    vendor: "bdcom",
    displayName: "BDCOM",
    supportedModels: ["P3310C", "P3310B", "P3608", "GP3600-08"],
    protocol: "snmp-v2c",
    staticCapabilities: {
      oltInfo: true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: false, // IF-MIB only on most BDCOM models
      alarmPolling: true,
      onuReboot: false,
      onuDisable: false,
    },
    // TODO: factory: () => new BdcomAdapter()
    factory: () => makePlaceholderAdapter("bdcom"),
  },

  vsol: {
    vendor: "vsol",
    displayName: "VSOL",
    supportedModels: ["V1600G", "V1600D", "V1600G4", "V1600G8"],
    protocol: "snmp-v2c",
    staticCapabilities: {
      oltInfo: true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: false,
      alarmPolling: false, // trap-based only; table walk not supported
      onuReboot: false,
      onuDisable: false,
    },
    // TODO: factory: () => new VsolAdapter()
    factory: () => makePlaceholderAdapter("vsol"),
  },

  cdata: {
    vendor: "cdata",
    displayName: "C-DATA",
    supportedModels: ["FD1616GS", "FD8920", "FD1104S", "FD1204S"],
    protocol: "snmp-v2c",
    staticCapabilities: {
      oltInfo: true,
      onuDiscovery: true,
      opticalPower: true,
      trafficStats: false,
      alarmPolling: true,
      onuReboot: false,
      onuDisable: false,
    },
    // TODO: factory: () => new CdataAdapter()
    factory: () => makePlaceholderAdapter("cdata"),
  },

  generic: {
    vendor: "generic",
    displayName: "Generic (RFC MIBs)",
    supportedModels: ["Any SNMP-capable device"],
    protocol: "snmp-v2c",
    staticCapabilities: {
      oltInfo: true,
      onuDiscovery: false, // requires vendor MIB
      opticalPower: false,
      trafficStats: true,  // IF-MIB counters only
      alarmPolling: false, // link-down traps only (no table)
      onuReboot: false,
      onuDisable: false,
    },
    // TODO: factory: () => new GenericAdapter()
    factory: () => makePlaceholderAdapter("generic"),
  },

};

/** Returns an unconnected adapter instance for the given vendor. */
export function createAdapter(vendor: Vendor): DeviceAdapter {
  const entry = VENDOR_REGISTRY[vendor];
  return entry.factory();
}

/** Returns all registered vendors and their metadata (for /api/vendors endpoint). */
export function listVendors(): Omit<VendorRegistryEntry, "factory">[] {
  return Object.values(VENDOR_REGISTRY).map(({ factory: _f, ...rest }) => rest);
}
