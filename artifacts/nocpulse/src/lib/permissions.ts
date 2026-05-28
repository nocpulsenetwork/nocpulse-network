import { useRole, type UserRole } from '@/contexts/RoleContext';

// ── Permission declarations ────────────────────────────────────────────────
export type Permission =
  | 'olt.manage'           // add / edit / delete / enable-disable OLTs
  | 'olt.test'             // test SNMP connection to an OLT
  | 'inventory.manage'     // add / edit / delete / enable-disable inventory devices
  | 'inventory.test'       // test connection to any inventory device
  | 'onu.manage'           // reboot / disable / enable / edit ONUs
  | 'alarm.acknowledge'    // acknowledge + verify alarms
  | 'alarm.manage'         // bulk close, delete alarms
  | 'diagnostics.run'      // trigger a scan/sync
  | 'staff.manage'         // invite / suspend / change roles
  | 'subscribers.manage'   // add / edit / suspend subscribers
  | 'settings.admin';      // system config, credentials, OLT auth

// ── Permission matrix ──────────────────────────────────────────────────────
// Everything NOT listed here is view-only / read-only for that role.
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  super_admin: [
    'olt.manage', 'olt.test',
    'inventory.manage', 'inventory.test',
    'onu.manage',
    'alarm.acknowledge', 'alarm.manage',
    'diagnostics.run',
    'staff.manage', 'subscribers.manage', 'settings.admin',
  ],
  admin: [
    'olt.manage', 'olt.test',
    'inventory.manage', 'inventory.test',
    'onu.manage',
    'alarm.acknowledge', 'alarm.manage',
    'diagnostics.run',
    'subscribers.manage',
  ],
  noc_engineer: [
    'olt.test',
    'inventory.test',
    'alarm.acknowledge',
    'diagnostics.run',
  ],
  viewer: [],
} as const;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);
}

// ── React hook ────────────────────────────────────────────────────────────
// Usage in any component:
//   const { can } = usePermissions();
//   if (can('onu.manage')) { ... }
export function usePermissions() {
  const { role } = useRole();
  return {
    can: (permission: Permission) => hasPermission(role, permission),
  };
}

// ── Role capability descriptions (for UI display) ─────────────────────────
export const ROLE_MATRIX: Record<UserRole, {
  canDo: string[];
  cantDo: string[];
}> = {
  super_admin: {
    canDo:  ['Full system access — all operations permitted'],
    cantDo: [],
  },
  admin: {
    canDo:  ['OLT & ONU management', 'Alarm acknowledgement & management', 'Run diagnostics', 'Subscriber management'],
    cantDo: ['Staff management', 'System credentials & security settings'],
  },
  noc_engineer: {
    canDo:  ['View all devices & inventory', 'Test device connections', 'Acknowledge alarms', 'Run diagnostics'],
    cantDo: ['Add/Edit/Delete devices', 'ONU configuration', 'Staff & subscriber management'],
  },
  viewer: {
    canDo:  ['Read-only access to all pages & data'],
    cantDo: ['All write, action, and management operations'],
  },
};
