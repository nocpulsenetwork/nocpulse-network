export type Status = 'Online' | 'Offline' | 'Degraded';
export type Severity = 'Critical' | 'Major' | 'Minor' | 'Info';

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
}

export interface OnuDevice {
  id: string;
  oltId: string;
  signalLevel: number;
  status: Status;
  macAddress: string;
  customerName: string;
  lastSync: string;
  bandwidth: string;
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
  { id: 'olt-01', name: 'OLT-Core-01', ip: '10.0.1.10', portCount: 16, activeOnus: 450, status: 'Online', uptime: '45d 12h', lastSeen: 'Just now', location: 'Data Center Alpha' },
  { id: 'olt-02', name: 'OLT-North-02', ip: '10.0.2.15', portCount: 8, activeOnus: 210, status: 'Online', uptime: '120d 4h', lastSeen: 'Just now', location: 'North Hub' },
  { id: 'olt-03', name: 'OLT-South-01', ip: '10.0.3.20', portCount: 16, activeOnus: 380, status: 'Degraded', uptime: '15d 2h', lastSeen: '1m ago', location: 'South Node' },
  { id: 'olt-04', name: 'OLT-East-01', ip: '10.0.4.11', portCount: 8, activeOnus: 150, status: 'Online', uptime: '90d 18h', lastSeen: 'Just now', location: 'East Hub' },
  { id: 'olt-05', name: 'OLT-West-02', ip: '10.0.5.50', portCount: 16, activeOnus: 0, status: 'Offline', uptime: '0d 0h', lastSeen: '2h ago', location: 'West Node' },
  { id: 'olt-06', name: 'OLT-Core-02', ip: '10.0.1.11', portCount: 16, activeOnus: 520, status: 'Online', uptime: '300d 5h', lastSeen: 'Just now', location: 'Data Center Alpha' },
  { id: 'olt-07', name: 'OLT-Metro-01', ip: '10.0.6.10', portCount: 8, activeOnus: 195, status: 'Online', uptime: '45d 12h', lastSeen: 'Just now', location: 'Metro Exchange' },
  { id: 'olt-08', name: 'OLT-Sub-01', ip: '10.0.7.22', portCount: 4, activeOnus: 85, status: 'Online', uptime: '12d 8h', lastSeen: 'Just now', location: 'Suburban Hub 1' },
];

export const onus: OnuDevice[] = [
  { id: 'onu-001', oltId: 'olt-01', signalLevel: -18.5, status: 'Online', macAddress: '00:1A:2B:3C:4D:5E', customerName: 'Acme Corp', lastSync: 'Just now', bandwidth: '1G/1G' },
  { id: 'onu-002', oltId: 'olt-01', signalLevel: -22.1, status: 'Online', macAddress: '00:1A:2B:3C:4D:5F', customerName: 'TechStart Inc', lastSync: 'Just now', bandwidth: '500M/500M' },
  { id: 'onu-003', oltId: 'olt-02', signalLevel: -28.4, status: 'Degraded', macAddress: '00:1A:2B:3C:4D:60', customerName: 'Global Logistics', lastSync: '5m ago', bandwidth: '1G/1G' },
  { id: 'onu-004', oltId: 'olt-03', signalLevel: -15.2, status: 'Online', macAddress: '00:1A:2B:3C:4D:61', customerName: 'City Library', lastSync: 'Just now', bandwidth: '2G/2G' },
  { id: 'onu-005', oltId: 'olt-05', signalLevel: -40.0, status: 'Offline', macAddress: '00:1A:2B:3C:4D:62', customerName: 'Westside Cafe', lastSync: '2h ago', bandwidth: '100M/100M' },
  { id: 'onu-006', oltId: 'olt-01', signalLevel: -19.8, status: 'Online', macAddress: '00:1A:2B:3C:4D:63', customerName: 'Downtown Medical', lastSync: 'Just now', bandwidth: '1G/1G' },
  { id: 'onu-007', oltId: 'olt-04', signalLevel: -24.5, status: 'Online', macAddress: '00:1A:2B:3C:4D:64', customerName: 'Sunrise Bakery', lastSync: 'Just now', bandwidth: '200M/200M' },
  { id: 'onu-008', oltId: 'olt-02', signalLevel: -21.0, status: 'Online', macAddress: '00:1A:2B:3C:4D:65', customerName: 'Oceanview Apartments', lastSync: 'Just now', bandwidth: '1G/1G' },
  { id: 'onu-009', oltId: 'olt-03', signalLevel: -29.1, status: 'Degraded', macAddress: '00:1A:2B:3C:4D:66', customerName: 'Valley High School', lastSync: '12m ago', bandwidth: '500M/500M' },
  { id: 'onu-010', oltId: 'olt-06', signalLevel: -16.4, status: 'Online', macAddress: '00:1A:2B:3C:4D:67', customerName: 'Enterprise Towers', lastSync: 'Just now', bandwidth: '10G/10G' },
];

export const alarms: Alarm[] = [
  { id: 'alm-101', severity: 'Critical', deviceId: 'olt-05', deviceName: 'OLT-West-02', timestamp: '2023-10-25T08:15:00Z', description: 'Device offline. Power failure detected.', acknowledged: false },
  { id: 'alm-102', severity: 'Major', deviceId: 'onu-003', deviceName: 'ONU (Global Logistics)', timestamp: '2023-10-25T09:30:00Z', description: 'High optical attenuation (-28.4 dBm)', acknowledged: false },
  { id: 'alm-103', severity: 'Minor', deviceId: 'olt-03', deviceName: 'OLT-South-01', timestamp: '2023-10-25T10:05:00Z', description: 'Uplink port utilization > 80%', acknowledged: true },
  { id: 'alm-104', severity: 'Info', deviceId: 'olt-01', deviceName: 'OLT-Core-01', timestamp: '2023-10-25T10:45:00Z', description: 'Configuration backup successful', acknowledged: true },
  { id: 'alm-105', severity: 'Major', deviceId: 'onu-009', deviceName: 'ONU (Valley High School)', timestamp: '2023-10-25T11:10:00Z', description: 'Signal degradation trend detected', acknowledged: false },
  { id: 'alm-106', severity: 'Critical', deviceId: 'olt-05', deviceName: 'OLT-West-02', timestamp: '2023-10-25T08:14:00Z', description: 'BGP session down', acknowledged: true },
  { id: 'alm-107', severity: 'Info', deviceId: 'sys', deviceName: 'System', timestamp: '2023-10-25T00:01:00Z', description: 'Daily report generated', acknowledged: true },
];

export const metrics = {
  totalOlts: olts.length,
  totalOnus: 1990, // mock total
  activeAlarms: alarms.filter(a => !a.acknowledged).length,
  criticalAlarms: alarms.filter(a => a.severity === 'Critical' && !a.acknowledged).length,
  networkUptime: 99.98,
  bandwidthUsage: '42.5 Tbps',
};
