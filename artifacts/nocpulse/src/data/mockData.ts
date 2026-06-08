export type Status = 'Online' | 'Offline' | 'Degraded';
export type Severity = 'Critical' | 'Major' | 'Minor' | 'Info';
export type SignalStability = 'Stable' | 'Weak Signal' | 'High Loss' | 'Unstable' | 'Offline';
export type OnuType = 'GPON' | 'EPON' | 'XPON';
export type OltMode = 'GPON' | 'EPON' | 'BOTH';

export interface OltDevice {
  id: string;
  name: string;
  ip: string;
  portCount: number;
  activeOnus: number;
  status: Status;
  uptime: string;
  lastSeen: string;
  location: string;
  brand: string;
  type: 'GPON' | 'EPON';
  mode: OltMode;
  cpu: number;
  memory: number;
  temperature: number;
  lastSync: string;
  uplinkStatus: 'Active' | 'Standby' | 'Down';
  uplinkPort: string;
  ponPortCount: number;
}

export interface OnuDevice {
  id: string;
  oltId: string;
  onuNo: string;           // e.g. "1/1/1" → slot/pon/onu
  description: string;
  distance: string;
  signalLevel: number;     // Current RX power dBm
  txPower: number;         // Current TX power dBm
  status: Status;
  macAddress: string;      // ONU MAC
  clientMac: string;       // Router/client-side MAC
  customerName: string;
  lastSync: string;
  bandwidth: string;
  lastLogoutTime: string;
  lastLogoutReason: string;
  onlineDuration: string;
  ponPort: string;         // e.g. "PON-1"
  vlanId: number;          // Service VLAN
  oltPort: string;         // OLT hardware port e.g. "GPON-0/1/0"
  lastOfflineRxPower: number | null;  // Last RX snapshot before offline
  signalStability: SignalStability;
  onuType: OnuType;
  /** True for ONUs discovered via real SNMP polling. Suppresses mock/generated data in the UI. */
  isReal?: boolean;
}

export interface Alarm {
  id: string;
  severity: Severity;
  deviceId: string;
  deviceName: string;
  timestamp: string;
  description: string;
  acknowledged: boolean;
}

export const olts: OltDevice[] = [
  { id: 'olt-01', name: 'OLT-North-01', ip: '10.0.1.10', portCount: 16, activeOnus: 450, status: 'Online', uptime: '45d 12h', lastSeen: 'Just now', location: 'Data Center Alpha', brand: 'Huawei', type: 'GPON', mode: 'GPON', cpu: 45, memory: 62, temperature: 48, lastSync: '2024-01-16T10:00:00Z', uplinkStatus: 'Active', uplinkPort: '10GE0/0/1', ponPortCount: 8 },
  { id: 'olt-02', name: 'OLT-North-02', ip: '10.0.2.15', portCount: 8, activeOnus: 210, status: 'Online', uptime: '120d 4h', lastSeen: 'Just now', location: 'North Hub', brand: 'ZTE', type: 'GPON', mode: 'GPON', cpu: 38, memory: 55, temperature: 44, lastSync: '2024-01-16T09:45:00Z', uplinkStatus: 'Active', uplinkPort: '10GE0/0/2', ponPortCount: 8 },
  { id: 'olt-03', name: 'OLT-South-01', ip: '10.0.3.20', portCount: 16, activeOnus: 380, status: 'Degraded', uptime: '15d 2h', lastSeen: '1m ago', location: 'South Node', brand: 'Nokia', type: 'GPON', mode: 'GPON', cpu: 72, memory: 78, temperature: 52, lastSync: '2024-01-16T09:30:00Z', uplinkStatus: 'Active', uplinkPort: '10GE0/0/1', ponPortCount: 16 },
  { id: 'olt-04', name: 'OLT-South-02', ip: '10.0.4.11', portCount: 8, activeOnus: 150, status: 'Offline', uptime: '90d 18h', lastSeen: 'Just now', location: 'East Hub', brand: 'Huawei', type: 'EPON', mode: 'EPON', cpu: 0, memory: 0, temperature: 0, lastSync: '2024-01-14T08:00:00Z', uplinkStatus: 'Down', uplinkPort: '10GE0/0/2', ponPortCount: 8 },
  { id: 'olt-05', name: 'OLT-East-01', ip: '10.0.5.50', portCount: 16, activeOnus: 0, status: 'Online', uptime: '0d 0h', lastSeen: '2h ago', location: 'West Node', brand: 'Fiberhome', type: 'GPON', mode: 'GPON', cpu: 55, memory: 67, temperature: 49, lastSync: '2024-01-16T09:50:00Z', uplinkStatus: 'Active', uplinkPort: '10GE0/0/1', ponPortCount: 8 },
  { id: 'olt-06', name: 'OLT-East-02', ip: '10.0.1.11', portCount: 16, activeOnus: 520, status: 'Online', uptime: '300d 5h', lastSeen: 'Just now', location: 'Data Center Alpha', brand: 'ZTE', type: 'EPON', mode: 'EPON', cpu: 12, memory: 35, temperature: 38, lastSync: '2024-01-16T09:55:00Z', uplinkStatus: 'Standby', uplinkPort: '10GE0/0/2', ponPortCount: 4 },
  { id: 'olt-07', name: 'OLT-West-01', ip: '10.0.6.10', portCount: 8, activeOnus: 195, status: 'Online', uptime: '45d 12h', lastSeen: 'Just now', location: 'Metro Exchange', brand: 'Calix', type: 'GPON', mode: 'GPON', cpu: 89, memory: 88, temperature: 61, lastSync: '2024-01-16T09:40:00Z', uplinkStatus: 'Active', uplinkPort: '10GE0/0/1', ponPortCount: 16 },
  { id: 'olt-08', name: 'OLT-West-02', ip: '10.0.7.22', portCount: 4, activeOnus: 85, status: 'Offline', uptime: '12d 8h', lastSeen: 'Just now', location: 'Suburban Hub 1', brand: 'Huawei', type: 'GPON', mode: 'GPON', cpu: 0, memory: 0, temperature: 0, lastSync: '2024-01-13T12:00:00Z', uplinkStatus: 'Down', uplinkPort: '10GE0/0/2', ponPortCount: 8 },
  { id: 'olt-09', name: 'OLT-Core-01', ip: '10.0.2.16', portCount: 8, activeOnus: 0, status: 'Online', uptime: '0d 0h', lastSeen: '1h ago', location: 'North Hub', brand: 'Nokia', type: 'GPON', mode: 'BOTH', cpu: 34, memory: 48, temperature: 42, lastSync: '2024-01-16T10:05:00Z', uplinkStatus: 'Active', uplinkPort: '10GE0/0/1', ponPortCount: 32 },
  { id: 'olt-10', name: 'OLT-Central-01', ip: '10.0.3.21', portCount: 16, activeOnus: 200, status: 'Online', uptime: '2d 1h', lastSeen: '1m ago', location: 'South Node', brand: 'Fiberhome', type: 'EPON', mode: 'EPON', cpu: 67, memory: 71, temperature: 53, lastSync: '2024-01-16T09:58:00Z', uplinkStatus: 'Active', uplinkPort: '10GE0/0/1', ponPortCount: 16 },
  { id: 'olt-11', name: 'OLT-Central-02', ip: '10.0.4.12', portCount: 8, activeOnus: 110, status: 'Online', uptime: '10d 5h', lastSeen: 'Just now', location: 'East Hub', brand: 'ZTE', type: 'GPON', mode: 'GPON', cpu: 29, memory: 44, temperature: 41, lastSync: '2024-01-16T10:02:00Z', uplinkStatus: 'Active', uplinkPort: '10GE0/0/2', ponPortCount: 8 },
];

// OLT type → default ONU type lookup
const OLT_ONU_TYPE: Record<string, OnuType> = {
  'olt-01': 'GPON', 'olt-02': 'GPON', 'olt-03': 'GPON', 'olt-04': 'EPON',
  'olt-05': 'GPON', 'olt-06': 'EPON', 'olt-07': 'GPON', 'olt-08': 'GPON',
  'olt-09': 'GPON', 'olt-10': 'EPON', 'olt-11': 'GPON',
};

export const onus: OnuDevice[] = [
  { id: 'onu-001', oltId: 'olt-01', onuNo: '1/1/1', description: 'Acme Corp - HQ', distance: '1.24 km', signalLevel: -18.5, txPower: 2.5, status: 'Online', macAddress: '00:1A:2B:3C:4D:5E', clientMac: 'A4:C3:F0:85:12:33', customerName: 'Acme Corp', lastSync: 'Just now', bandwidth: '1G/1G', lastLogoutTime: 'N/A', lastLogoutReason: 'N/A', onlineDuration: '12d 4h 32m', ponPort: 'PON-1', vlanId: 100, oltPort: 'GPON-0/1/0', lastOfflineRxPower: null, signalStability: 'Stable', onuType: 'GPON' },
  { id: 'onu-002', oltId: 'olt-01', onuNo: '1/1/2', description: 'TechStart Office', distance: '2.10 km', signalLevel: -22.1, txPower: 2.1, status: 'Online', macAddress: '00:1A:2B:3C:4D:5F', clientMac: 'A4:C3:F0:85:12:34', customerName: 'TechStart Inc', lastSync: 'Just now', bandwidth: '500M/500M', lastLogoutTime: '2024-01-15 14:22:00', lastLogoutReason: 'Admin Reboot', onlineDuration: '5d 2h 10m', ponPort: 'PON-1', vlanId: 200, oltPort: 'GPON-0/1/0', lastOfflineRxPower: -25.3, signalStability: 'Stable', onuType: 'GPON' },
  { id: 'onu-003', oltId: 'olt-02', onuNo: '1/2/1', description: 'Logistics Warehouse', distance: '4.50 km', signalLevel: -28.4, txPower: -0.5, status: 'Degraded', macAddress: '00:1A:2B:3C:4D:60', clientMac: 'A4:C3:F0:85:12:35', customerName: 'Global Logistics', lastSync: '5m ago', bandwidth: '1G/1G', lastLogoutTime: '2024-01-16 09:10:00', lastLogoutReason: 'Signal Lost', onlineDuration: '1d 1h 5m', ponPort: 'PON-2', vlanId: 300, oltPort: 'GPON-0/2/0', lastOfflineRxPower: -30.1, signalStability: 'High Loss', onuType: 'GPON' },
  { id: 'onu-004', oltId: 'olt-03', onuNo: '2/1/1', description: 'Main Library', distance: '0.80 km', signalLevel: -15.2, txPower: 3.1, status: 'Online', macAddress: '00:1A:2B:3C:4D:61', clientMac: 'A4:C3:F0:85:12:36', customerName: 'City Library', lastSync: 'Just now', bandwidth: '2G/2G', lastLogoutTime: 'N/A', lastLogoutReason: 'N/A', onlineDuration: '45d 10h 20m', ponPort: 'PON-1', vlanId: 400, oltPort: 'GPON-0/1/0', lastOfflineRxPower: null, signalStability: 'Stable', onuType: 'GPON' },
  { id: 'onu-005', oltId: 'olt-05', onuNo: '1/3/1', description: 'Cafe Branch', distance: '3.20 km', signalLevel: -40.0, txPower: -5.0, status: 'Offline', macAddress: '00:1A:2B:3C:4D:62', clientMac: 'A4:C3:F0:85:12:37', customerName: 'Westside Cafe', lastSync: '2h ago', bandwidth: '100M/100M', lastLogoutTime: '2024-01-18 11:45:00', lastLogoutReason: 'Power Loss', onlineDuration: 'N/A', ponPort: 'PON-3', vlanId: 500, oltPort: 'GPON-0/3/0', lastOfflineRxPower: -38.5, signalStability: 'Offline', onuType: 'GPON' },
  { id: 'onu-006', oltId: 'olt-01', onuNo: '1/1/3', description: 'Medical Center', distance: '1.50 km', signalLevel: -19.8, txPower: 2.2, status: 'Online', macAddress: '00:1A:2B:3C:4D:63', clientMac: 'A4:C3:F0:85:12:38', customerName: 'Downtown Medical', lastSync: 'Just now', bandwidth: '1G/1G', lastLogoutTime: 'N/A', lastLogoutReason: 'N/A', onlineDuration: '30d 5h 12m', ponPort: 'PON-1', vlanId: 100, oltPort: 'GPON-0/1/0', lastOfflineRxPower: null, signalStability: 'Stable', onuType: 'GPON' },
  { id: 'onu-007', oltId: 'olt-04', onuNo: '1/1/1', description: 'Bakery Shop', distance: '2.40 km', signalLevel: -24.5, txPower: 1.8, status: 'Online', macAddress: '00:1A:2B:3C:4D:64', clientMac: 'A4:C3:F0:85:12:39', customerName: 'Sunrise Bakery', lastSync: 'Just now', bandwidth: '200M/200M', lastLogoutTime: '2024-01-10 08:30:00', lastLogoutReason: 'Admin Reboot', onlineDuration: '8d 14h 22m', ponPort: 'PON-1', vlanId: 200, oltPort: 'EPON-0/1/0', lastOfflineRxPower: -27.0, signalStability: 'Weak Signal', onuType: 'EPON' },
  { id: 'onu-008', oltId: 'olt-02', onuNo: '1/2/2', description: 'Apt Complex', distance: '1.90 km', signalLevel: -21.0, txPower: 2.0, status: 'Online', macAddress: '00:1A:2B:3C:4D:65', clientMac: 'A4:C3:F0:85:12:3A', customerName: 'Oceanview Apartments', lastSync: 'Just now', bandwidth: '1G/1G', lastLogoutTime: 'N/A', lastLogoutReason: 'N/A', onlineDuration: '100d 2h 45m', ponPort: 'PON-2', vlanId: 300, oltPort: 'GPON-0/2/0', lastOfflineRxPower: null, signalStability: 'Stable', onuType: 'GPON' },
  { id: 'onu-009', oltId: 'olt-03', onuNo: '2/1/2', description: 'High School', distance: '5.10 km', signalLevel: -29.1, txPower: -1.0, status: 'Degraded', macAddress: '00:1A:2B:3C:4D:66', clientMac: 'A4:C3:F0:85:12:3B', customerName: 'Valley High School', lastSync: '12m ago', bandwidth: '500M/500M', lastLogoutTime: '2024-01-17 15:20:00', lastLogoutReason: 'Signal Lost', onlineDuration: '10h 5m', ponPort: 'PON-1', vlanId: 400, oltPort: 'GPON-0/1/0', lastOfflineRxPower: -31.5, signalStability: 'High Loss', onuType: 'GPON' },
  { id: 'onu-010', oltId: 'olt-06', onuNo: '1/1/1', description: 'Corp Tower', distance: '0.50 km', signalLevel: -16.4, txPower: 2.8, status: 'Online', macAddress: '00:1A:2B:3C:4D:67', clientMac: 'A4:C3:F0:85:12:3C', customerName: 'Enterprise Towers', lastSync: 'Just now', bandwidth: '10G/10G', lastLogoutTime: 'N/A', lastLogoutReason: 'N/A', onlineDuration: '200d 12h 1m', ponPort: 'PON-1', vlanId: 600, oltPort: 'EPON-0/1/0', lastOfflineRxPower: null, signalStability: 'Stable', onuType: 'XPON' },
  ...Array.from({length: 15}).map((_, i) => {
    const id = `onu-01${i + 1}`;
    const isOffline = i % 5 === 0;
    const isDegraded = i % 7 === 0;
    const derivedOltId = `olt-0${(i % 8) + 1}`;
    const onuType: OnuType = OLT_ONU_TYPE[derivedOltId] ?? 'GPON';
    const rxLevel = isOffline ? -40.0 : -20 - (i % 8);
    const isWeak = !isOffline && rxLevel <= -25 && rxLevel > -28;
    const isHighLoss = !isOffline && rxLevel <= -28;
    const stability: SignalStability = isOffline ? 'Offline' : isDegraded ? 'Unstable' : isHighLoss ? 'High Loss' : isWeak ? 'Weak Signal' : 'Stable';
    return {
      id,
      oltId: derivedOltId,
      onuNo: `1/${(i % 4) + 1}/${(i % 8) + 1}`,
      description: `Customer Site ${i + 1}`,
      distance: `${(1 + i * 0.3).toFixed(2)} km`,
      signalLevel: rxLevel,
      txPower: isOffline ? -5.0 : 2.0 - (i * 0.1),
      status: (isOffline ? 'Offline' : (isDegraded ? 'Degraded' : 'Online')) as Status,
      macAddress: `00:1A:2B:3C:4D:${(70 + i).toString(16).toUpperCase()}`,
      clientMac: `A4:C3:F0:85:12:${(40 + i).toString(16).toUpperCase()}`,
      customerName: `Client ${i + 1}`,
      lastSync: isOffline ? '2h ago' : 'Just now',
      bandwidth: '1G/1G',
      lastLogoutTime: isOffline ? '2024-01-18 10:00:00' : 'N/A',
      lastLogoutReason: isOffline ? 'Power Loss' : 'N/A',
      onlineDuration: isOffline ? 'N/A' : `${i + 2}d 5h`,
      ponPort: `PON-${(i % 3) + 1}`,
      vlanId: 100 + ((i * 100) % 800),
      oltPort: `${onuType === 'EPON' ? 'EPON' : 'GPON'}-0/${(i % 4) + 1}/0`,
      lastOfflineRxPower: isOffline ? (-36.0 - (i % 4)) : (isDegraded ? (-30.5 - (i % 2)) : null),
      signalStability: stability,
      onuType,
    };
  })
];

export const alarms: Alarm[] = [
  { id: 'alm-101', severity: 'Critical', deviceId: 'olt-05', deviceName: 'OLT-West-02', timestamp: '2023-10-25T08:15:00Z', description: 'Device offline. Power failure detected.', acknowledged: false },
  { id: 'alm-102', severity: 'Major', deviceId: 'onu-003', deviceName: 'ONU (Global Logistics)', timestamp: '2023-10-25T09:30:00Z', description: 'High optical attenuation (-28.4 dBm)', acknowledged: false },
  { id: 'alm-103', severity: 'Minor', deviceId: 'olt-03', deviceName: 'OLT-South-01', timestamp: '2023-10-25T10:05:00Z', description: 'Uplink port utilization > 80%', acknowledged: true },
  { id: 'alm-104', severity: 'Info', deviceId: 'olt-01', deviceName: 'OLT-Core-01', timestamp: '2023-10-25T10:45:00Z', description: 'Configuration backup successful', acknowledged: true },
  { id: 'alm-105', severity: 'Major', deviceId: 'onu-009', deviceName: 'ONU (Valley High School)', timestamp: '2023-10-25T11:10:00Z', description: 'Signal degradation trend detected', acknowledged: false },
  { id: 'alm-106', severity: 'Critical', deviceId: 'olt-05', deviceName: 'OLT-West-02', timestamp: '2023-10-25T08:14:00Z', description: 'BGP session down', acknowledged: true },
  { id: 'alm-107', severity: 'Info', deviceId: 'sys', deviceName: 'System', timestamp: '2023-10-25T00:01:00Z', description: 'Daily report generated', acknowledged: true },
  { id: 'alarm-008', deviceId: 'olt-07', deviceName: 'OLT-West-01', severity: 'Major', description: 'CPU usage critical — 89% sustained for 15 minutes', timestamp: '2024-01-16T08:30:00Z', acknowledged: false },
  { id: 'alarm-009', deviceId: 'onu-007', deviceName: 'ONU (Bakery Shop)', severity: 'Minor', description: 'TX power slightly low — 0.8 dBm', timestamp: '2024-01-16T07:45:00Z', acknowledged: false },
  { id: 'alarm-010', deviceId: 'olt-03', deviceName: 'OLT-South-01', severity: 'Minor', description: 'Memory usage elevated — 78%', timestamp: '2024-01-16T06:00:00Z', acknowledged: true },
  { id: 'alarm-011', deviceId: 'olt-09', deviceName: 'OLT-Core-01', severity: 'Info', description: 'Scheduled maintenance window completed successfully', timestamp: '2024-01-15T23:00:00Z', acknowledged: true },
  { id: 'alarm-012', deviceId: 'onu-004', deviceName: 'ONU (Main Library)', severity: 'Info', description: 'ONU firmware upgraded to v3.2.1', timestamp: '2024-01-15T22:30:00Z', acknowledged: true },
];

export interface NocStaff {
  id: string;
  name: string;
  role: string;
  initials: string;
}

export const NOC_STAFF: NocStaff[] = [
  { id: 'staff-01', name: 'John Doe', role: 'NOC Engineer', initials: 'JD' },
  { id: 'staff-02', name: 'Sarah Chen', role: 'Senior NOC', initials: 'SC' },
  { id: 'staff-03', name: 'Mike Torres', role: 'NOC Lead', initials: 'MT' },
  { id: 'staff-04', name: 'Lisa Park', role: 'NOC Engineer', initials: 'LP' },
];

export const metrics = {
  totalOlts: olts.length,
  totalOnus: onus.length,
  onlineOnus: onus.filter(o => o.status === 'Online').length,
  offlineOnus: onus.filter(o => o.status === 'Offline').length,
  offlineOlts: olts.filter(o => o.status === 'Offline').length,
  activeAlarms: alarms.filter(a => !a.acknowledged).length,
  criticalAlarms: alarms.filter(a => a.severity === 'Critical' && !a.acknowledged).length,
  networkUptime: olts.length > 0 ? Math.round((olts.filter(o => o.status === 'Online').length / olts.length) * 1000) / 10 : null,
  bandwidthUsage: '42.5 Tbps',
};
