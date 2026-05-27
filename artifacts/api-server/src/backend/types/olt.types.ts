export type OltVendor = "huawei" | "zte" | "bdcom" | "vsol" | "cdata" | "generic";

export type OltStatus = "online" | "offline" | "degraded" | "unreachable";

export interface OltPort {
  portId: string;
  name: string;
  type: "gpon" | "epon" | "xgs-pon" | "10g-epon" | "uplink" | "ethernet";
  onuCount: number;
  maxOnu: number;
  status: "active" | "inactive" | "error";
}

export interface OltBoard {
  boardId: string;
  slot: number;
  type: string;
  status: "normal" | "failure" | "absent";
  ports: OltPort[];
}

export interface OltTemperature {
  sensor: string;
  celsius: number;
  threshold: number;
}

export interface OltHardware {
  boards: OltBoard[];
  temperature: OltTemperature[];
  cpuUsagePercent: number;
  memUsagePercent: number;
  uptime: number; // seconds
}

export interface OltNormalized {
  id: string;
  vendor: OltVendor;
  model: string;
  name: string;
  ipAddress: string;
  location: string;
  status: OltStatus;
  firmware: string;
  serialNumber: string;
  totalOnuCapacity: number;
  registeredOnu: number;
  onlineOnu: number;
  offlineOnu: number;
  hardware: OltHardware;
  lastPolled: Date;
  rawData?: Record<string, unknown>; // vendor-specific raw payload for debug
}

export interface OltPollRequest {
  oltId: string;
  ipAddress: string;
  vendor: OltVendor;
  community?: string;  // SNMP v1/v2c
  username?: string;   // SNMP v3 / SSH
  authKey?: string;
  privKey?: string;
  port?: number;
}
