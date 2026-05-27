export type OnuStatus = "online" | "offline" | "los" | "dying-gasp" | "degraded";

export type OnuAuthMode = "sn" | "password" | "sn+password";

export interface OnuOptical {
  txPowerDbm: number;
  rxPowerDbm: number;
  oltRxPowerDbm: number;
  biasMa: number;          // bias current in mA
  voltageV: number;
  temperatureCelsius: number;
}

export interface OnuEthPort {
  portId: number;
  adminStatus: "up" | "down";
  operStatus: "up" | "down";
  speedMbps: number;
  duplex: "full" | "half";
}

export interface OnuTraffic {
  rxBytesTotal: number;
  txBytesTotal: number;
  rxRateBps: number;
  txRateBps: number;
}

export interface OnuNormalized {
  id: string;
  oltId: string;
  oltPort: string;
  onuIndex: number;         // ONU index on the PON port
  serialNumber: string;
  authMode: OnuAuthMode;
  name: string;
  description: string;
  ipAddress: string;
  macAddress: string;
  vlan: number;
  profile: string;          // service profile / line profile name
  status: OnuStatus;
  optical: OnuOptical;
  ethPorts: OnuEthPort[];
  traffic: OnuTraffic;
  distanceMeters: number;
  firmware: string;
  model: string;
  lastPolled: Date;
  rawData?: Record<string, unknown>;
}

export interface OnuPollRequest {
  onuId: string;
  oltId: string;
  oltIp: string;
  vendor: string;
  onuIndex: number;
  portId: string;
}
