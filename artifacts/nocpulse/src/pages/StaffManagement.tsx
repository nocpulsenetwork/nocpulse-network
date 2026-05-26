import { useState } from 'react';
import {
  Users, Shield, ShieldCheck, ShieldAlert, Crown,
  Plus, MoreHorizontal, Lock, Unlock, Check, X, UserCog,
  Mail, Clock, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Role = 'Super Admin' | 'Admin' | 'Staff';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  lastLogin: string;
  joinDate: string;
  actionsToday: number;
}

const STAFF: StaffMember[] = [
  { id: 's1', name: 'John Doe', email: 'john.doe@isp.net', role: 'Super Admin', initials: 'JD', status: 'Active', lastLogin: '2 mins ago', joinDate: '2022-01-10', actionsToday: 14 },
  { id: 's2', name: 'Sarah Chen', email: 'sarah.chen@isp.net', role: 'Admin', initials: 'SC', status: 'Active', lastLogin: '15 mins ago', joinDate: '2022-03-15', actionsToday: 8 },
  { id: 's3', name: 'Mike Torres', email: 'mike.torres@isp.net', role: 'Admin', initials: 'MT', status: 'Active', lastLogin: '1 hour ago', joinDate: '2022-06-01', actionsToday: 3 },
  { id: 's4', name: 'Lisa Park', email: 'lisa.park@isp.net', role: 'Staff', initials: 'LP', status: 'Active', lastLogin: '3 hours ago', joinDate: '2023-01-20', actionsToday: 6 },
  { id: 's5', name: 'David Kim', email: 'david.kim@isp.net', role: 'Staff', initials: 'DK', status: 'Active', lastLogin: 'Yesterday', joinDate: '2023-04-05', actionsToday: 0 },
  { id: 's6', name: 'Emma Wilson', email: 'emma.wilson@isp.net', role: 'Staff', initials: 'EW', status: 'Inactive', lastLogin: '5 days ago', joinDate: '2023-07-12', actionsToday: 0 },
  { id: 's7', name: 'James Lee', email: 'james.lee@isp.net', role: 'Staff', initials: 'JL', status: 'Suspended', lastLogin: '2 weeks ago', joinDate: '2023-02-28', actionsToday: 0 },
];

interface Permission {
  action: string;
  superAdmin: boolean | 'limited';
  admin: boolean | 'limited';
  staff: boolean | 'limited';
}

const PERMISSIONS: { category: string; items: Permission[] }[] = [
  {
    category: 'OLT Management',
    items: [
      { action: 'View OLT list & details', superAdmin: true, admin: true, staff: true },
      { action: 'Acknowledge alarms', superAdmin: true, admin: true, staff: true },
      { action: 'Reboot OLT', superAdmin: true, admin: true, staff: false },
      { action: 'Modify OLT credentials', superAdmin: true, admin: 'limited', staff: false },
      { action: 'Delete / provision OLT', superAdmin: true, admin: false, staff: false },
    ],
  },
  {
    category: 'ONU Management',
    items: [
      { action: 'View ONU list & details', superAdmin: true, admin: true, staff: true },
      { action: 'Reboot ONU', superAdmin: true, admin: true, staff: 'limited' },
      { action: 'Disable / enable ONU', superAdmin: true, admin: true, staff: false },
      { action: 'Update bandwidth profile', superAdmin: true, admin: true, staff: false },
      { action: 'Register new ONU', superAdmin: true, admin: true, staff: false },
      { action: 'Delete ONU', superAdmin: true, admin: false, staff: false },
    ],
  },
  {
    category: 'Alarm Center',
    items: [
      { action: 'View all alarms', superAdmin: true, admin: true, staff: true },
      { action: 'Acknowledge alarms', superAdmin: true, admin: true, staff: true },
      { action: 'Resolve / close alarms', superAdmin: true, admin: true, staff: 'limited' },
      { action: 'Configure alarm thresholds', superAdmin: true, admin: 'limited', staff: false },
    ],
  },
  {
    category: 'System & Users',
    items: [
      { action: 'View activity logs', superAdmin: true, admin: true, staff: false },
      { action: 'Manage staff & roles', superAdmin: true, admin: false, staff: false },
      { action: 'Configure notifications', superAdmin: true, admin: true, staff: false },
      { action: 'Run smart diagnostics', superAdmin: true, admin: true, staff: true },
      { action: 'Modify system settings', superAdmin: true, admin: false, staff: false },
      { action: 'Export & audit reports', superAdmin: true, admin: 'limited', staff: false },
    ],
  },
];

const ROLE_CONFIG: Record<Role, { color: string; bg: string; border: string; icon: React.ElementType; description: string }> = {
  'Super Admin': {
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: Crown,
    description: 'Full unrestricted access to all system functions, credentials, and user management.',
  },
  Admin: {
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    icon: ShieldCheck,
    description: 'Broad operational access. Can manage OLTs, ONUs, and alarms. Cannot manage users or credentials.',
  },
  Staff: {
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    icon: Shield,
    description: 'Read-only + limited action access. Cannot reboot OLTs, delete devices, or view logs.',
  },
};

const STATUS_CONFIG = {
  Active: { cls: 'bg-green-500/10 text-green-400 border-green-500/20', dot: 'bg-green-500' },
  Inactive: { cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20', dot: 'bg-slate-500' },
  Suspended: { cls: 'bg-red-500/10 text-red-400 border-red-500/20', dot: 'bg-red-500' },
};

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Icon className="h-2.5 w-2.5" />
      {role}
    </span>
  );
}

function PermCell({ value }: { value: boolean | 'limited' }) {
  if (value === true) return (
    <div className="flex justify-center">
      <div className="h-5 w-5 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
        <Check className="h-3 w-3 text-green-400" />
      </div>
    </div>
  );
  if (value === 'limited') return (
    <div className="flex justify-center">
      <div className="h-5 w-5 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
        <span className="text-[9px] font-black text-amber-400">~</span>
      </div>
    </div>
  );
  return (
    <div className="flex justify-center">
      <div className="h-5 w-5 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <X className="h-3 w-3 text-red-400" />
      </div>
    </div>
  );
}

export default function StaffManagement() {
  const [showInvite, setShowInvite] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>('Staff');

  const activeCount = STAFF.filter(s => s.status === 'Active').length;
  const adminCount = STAFF.filter(s => s.role === 'Admin' || s.role === 'Super Admin').length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff & Permissions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage NOC staff accounts, roles, and access permissions
          </p>
        </div>
        <Button
          onClick={() => setShowInvite(s => !s)}
          className="gap-2 text-sm"
        >
          <Plus className="h-4 w-4" /> Invite Staff
        </Button>
      </div>

      {/* Invite placeholder */}
      {showInvite && (
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Invite new staff member</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] h-9 rounded-md border border-border/60 bg-muted/30 px-3 flex items-center">
              <span className="text-sm text-muted-foreground">email@company.net</span>
            </div>
            <div className="flex gap-2">
              {(['Super Admin', 'Admin', 'Staff'] as Role[]).map(r => (
                <button
                  key={r}
                  onClick={() => setSelectedRole(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedRole === r ? `${ROLE_CONFIG[r].bg} ${ROLE_CONFIG[r].color} ${ROLE_CONFIG[r].border}` : 'border-border/60 text-muted-foreground hover:border-border'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Button size="sm" className="h-9 gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Send Invite
            </Button>
            <Button size="sm" variant="ghost" className="h-9" onClick={() => setShowInvite(false)}>Cancel</Button>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Invite links expire after 48 hours. Staff must set a password on first login.
          </p>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Staff', value: STAFF.length, icon: Users, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
          { label: 'Active Now', value: activeCount, icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
          { label: 'Admins', value: adminCount, icon: ShieldCheck, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          { label: 'Suspended', value: STAFF.filter(s => s.status === 'Suspended').length, icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-xl border ${stat.border} ${stat.bg} p-4 flex items-center gap-3`}>
              <div className={`h-9 w-9 rounded-lg bg-card/60 flex items-center justify-center border ${stat.border}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="staff" className="w-full">
        <TabsList className="bg-transparent border-b border-border/60 rounded-none h-auto p-0 gap-0 w-full justify-start mb-6">
          {[
            { value: 'staff', label: 'Staff Members' },
            { value: 'permissions', label: 'Permission Matrix' },
            { value: 'roles', label: 'Role Overview' },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* STAFF MEMBERS */}
        <TabsContent value="staff" className="m-0">
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border/60">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Staff Member</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Login</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions Today</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {STAFF.map(member => {
                    const statusCfg = STATUS_CONFIG[member.status];
                    return (
                      <tr key={member.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-primary">{member.initials}</span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{member.name}</p>
                              <p className="text-[11px] text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={member.role} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold ${statusCfg.cls}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot} ${member.status === 'Active' ? 'animate-pulse' : ''}`} />
                            {member.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {member.lastLogin}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono font-semibold">{member.actionsToday}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">actions</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {member.role !== 'Super Admin' && (
                              <>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                  <UserCog className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-400">
                                  {member.status === 'Suspended' ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                                </Button>
                              </>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* PERMISSION MATRIX */}
        <TabsContent value="permissions" className="m-0">
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground px-1 flex-wrap">
              {[
                { icon: Check, color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30', label: 'Allowed' },
                { icon: null, color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30', label: 'Limited access' },
                { icon: X, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Restricted' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={`h-4 w-4 rounded border flex items-center justify-center ${item.bg}`}>
                    {item.icon ? <item.icon className={`h-2.5 w-2.5 ${item.color}`} /> : <span className={`text-[9px] font-black ${item.color}`}>~</span>}
                  </div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border/60">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground w-1/2">Action</th>
                    <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-400">Super Admin</th>
                    <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary">Admin</th>
                    <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {PERMISSIONS.map(section => (
                    <>
                      <tr key={section.category} className="bg-muted/20">
                        <td colSpan={4} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {section.category}
                        </td>
                      </tr>
                      {section.items.map(perm => (
                        <tr key={perm.action} className="hover:bg-muted/10">
                          <td className="px-4 py-2.5 text-xs">{perm.action}</td>
                          <td className="px-4 py-2.5"><PermCell value={perm.superAdmin} /></td>
                          <td className="px-4 py-2.5"><PermCell value={perm.admin} /></td>
                          <td className="px-4 py-2.5"><PermCell value={perm.staff} /></td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ROLE OVERVIEW */}
        <TabsContent value="roles" className="m-0">
          <div className="grid gap-4 md:grid-cols-3">
            {(['Super Admin', 'Admin', 'Staff'] as Role[]).map(role => {
              const cfg = ROLE_CONFIG[role];
              const Icon = cfg.icon;
              const count = STAFF.filter(s => s.role === role).length;
              return (
                <div key={role} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-5 space-y-4`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${cfg.color}`} />
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm ${cfg.color}`}>{role}</h3>
                        <p className="text-[11px] text-muted-foreground">{count} member{count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{cfg.description}</p>
                  <div className="space-y-1.5">
                    {STAFF.filter(s => s.role === role).map(s => (
                      <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-card/50 border border-border/40">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-primary">{s.initials}</span>
                        </div>
                        <span className="text-xs font-medium flex-1 truncate">{s.name}</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[s.status].dot}`} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-4 rounded-xl border border-border/60 bg-muted/20 flex items-start gap-3">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold">Role assignment is protected</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Only Super Admins can assign or change roles. Role changes are logged in Activity Logs and cannot be undone without audit trail.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
