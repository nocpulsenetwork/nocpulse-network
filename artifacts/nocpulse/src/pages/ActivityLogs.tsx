import { useState, useMemo, Fragment } from 'react';
import {
  ClipboardList, Search, Filter, Download, RefreshCw,
  LogIn, Server, Cpu, Bell, Settings, User, ChevronDown,
  CheckCircle2, AlertTriangle, XCircle, RotateCcw, Eye,
  Power, Wifi, WifiOff, Shield, Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type LogCategory = 'All' | 'Login' | 'OLT' | 'ONU' | 'Alarm' | 'System' | 'Staff';
type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

interface LogEntry {
  id: string;
  timestamp: string;
  category: Exclude<LogCategory, 'All'>;
  level: LogLevel;
  actor: string;
  actorRole: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
}

const LOGS: LogEntry[] = [
  { id: 'l001', timestamp: '2026-05-22T10:24:11Z', category: 'Alarm', level: 'SUCCESS', actor: 'John Doe', actorRole: 'Super Admin', action: 'Alarm acknowledged', target: 'OLT-West-02', detail: 'Critical alarm alm-101 acknowledged and submitted for verification', ip: '192.168.1.5' },
  { id: 'l002', timestamp: '2026-05-22T10:21:05Z', category: 'ONU', level: 'INFO', actor: 'Sarah Chen', actorRole: 'Admin', action: 'ONU rebooted', target: 'ONU-007 (Bakery Shop)', detail: 'Remote reboot command sent via PON port PON-1', ip: '192.168.1.12' },
  { id: 'l003', timestamp: '2026-05-22T10:19:44Z', category: 'Login', level: 'SUCCESS', actor: 'Mike Torres', actorRole: 'Admin', action: 'Login successful', target: 'NOCpulse Portal', detail: 'Authenticated via password from Chrome 124 / Windows 11', ip: '10.0.0.48' },
  { id: 'l004', timestamp: '2026-05-22T10:18:30Z', category: 'OLT', level: 'INFO', actor: 'Sarah Chen', actorRole: 'Admin', action: 'OLT credentials viewed', target: 'OLT-Core-01', detail: 'SSH credentials accessed for configuration review', ip: '192.168.1.12' },
  { id: 'l005', timestamp: '2026-05-22T10:15:00Z', category: 'Staff', level: 'INFO', actor: 'John Doe', actorRole: 'Super Admin', action: 'Staff role changed', target: 'Lisa Park', detail: 'Role updated from Staff → Admin', ip: '192.168.1.5' },
  { id: 'l006', timestamp: '2026-05-22T10:12:17Z', category: 'ONU', level: 'WARN', actor: 'System', actorRole: 'Auto', action: 'ONU offline detected', target: 'ONU-003 (Global Logistics)', detail: 'ONU did not respond to keep-alive for 120s — alarm triggered', ip: '—' },
  { id: 'l007', timestamp: '2026-05-22T10:08:55Z', category: 'Alarm', level: 'ERROR', actor: 'System', actorRole: 'Auto', action: 'Critical alarm triggered', target: 'OLT-West-02', detail: 'Power failure detected on device — BGP session dropped', ip: '—' },
  { id: 'l008', timestamp: '2026-05-22T09:59:42Z', category: 'OLT', level: 'INFO', actor: 'Mike Torres', actorRole: 'Admin', action: 'OLT detail viewed', target: 'OLT-South-01', detail: 'PON port summary and ONU quick access viewed', ip: '10.0.0.48' },
  { id: 'l009', timestamp: '2026-05-22T09:55:30Z', category: 'Login', level: 'ERROR', actor: 'Unknown', actorRole: '—', action: 'Login failed', target: 'NOCpulse Portal', detail: '3 failed attempts with email admin@isp.net — account not locked', ip: '185.220.101.7' },
  { id: 'l010', timestamp: '2026-05-22T09:50:00Z', category: 'System', level: 'INFO', actor: 'System', actorRole: 'Auto', action: 'Daily backup completed', target: 'Config Backup', detail: 'All OLT configurations archived to backup storage', ip: '—' },
  { id: 'l011', timestamp: '2026-05-22T09:44:12Z', category: 'ONU', level: 'SUCCESS', actor: 'Lisa Park', actorRole: 'Staff', action: 'ONU detail viewed', target: 'ONU-009 (Valley High School)', detail: 'Signal history and bandwidth usage reviewed', ip: '192.168.1.20' },
  { id: 'l012', timestamp: '2026-05-22T09:40:00Z', category: 'Login', level: 'SUCCESS', actor: 'Lisa Park', actorRole: 'Staff', action: 'Login successful', target: 'NOCpulse Portal', detail: 'Authenticated via password from Firefox 125 / macOS', ip: '192.168.1.20' },
  { id: 'l013', timestamp: '2026-05-22T09:35:18Z', category: 'OLT', level: 'WARN', actor: 'System', actorRole: 'Auto', action: 'High CPU alert', target: 'OLT-West-01', detail: 'CPU sustained at 89% for 15 minutes — Major alarm created', ip: '—' },
  { id: 'l014', timestamp: '2026-05-22T09:28:05Z', category: 'Alarm', level: 'INFO', actor: 'Sarah Chen', actorRole: 'Admin', action: 'Alarm resolved', target: 'ONU (Bakery Shop)', detail: 'Minor alarm for low TX power resolved after equipment check', ip: '192.168.1.12' },
  { id: 'l015', timestamp: '2026-05-22T09:20:00Z', category: 'System', level: 'INFO', actor: 'System', actorRole: 'Auto', action: 'SNMP poll completed', target: 'All OLTs', detail: '11 OLTs polled — 10 responded, 1 timeout (OLT-West-02)', ip: '—' },
  { id: 'l016', timestamp: '2026-05-22T09:15:44Z', category: 'ONU', level: 'INFO', actor: 'Mike Torres', actorRole: 'Admin', action: 'Bandwidth profile updated', target: 'ONU-012 (City Hospital)', detail: 'Profile changed from 100/20 Mbps → 200/50 Mbps', ip: '10.0.0.48' },
  { id: 'l017', timestamp: '2026-05-22T09:05:30Z', category: 'Staff', level: 'WARN', actor: 'John Doe', actorRole: 'Super Admin', action: 'Staff account suspended', target: 'James Lee', detail: 'Account suspended pending security review — access revoked immediately', ip: '192.168.1.5' },
  { id: 'l018', timestamp: '2026-05-22T08:58:00Z', category: 'OLT', level: 'SUCCESS', actor: 'John Doe', actorRole: 'Super Admin', action: 'OLT credentials updated', target: 'OLT-Core-02', detail: 'SSH password rotated — previous session tokens invalidated', ip: '192.168.1.5' },
  { id: 'l019', timestamp: '2026-05-22T08:45:00Z', category: 'Login', level: 'SUCCESS', actor: 'John Doe', actorRole: 'Super Admin', action: 'Login successful', target: 'NOCpulse Portal', detail: 'Authenticated via password from Edge 124 / Windows 11', ip: '192.168.1.5' },
  { id: 'l020', timestamp: '2026-05-22T08:30:12Z', category: 'System', level: 'INFO', actor: 'System', actorRole: 'Auto', action: 'NOCpulse started', target: 'System', detail: 'Application initialized — all services nominal', ip: '—' },
  { id: 'l021', timestamp: '2026-05-21T23:58:00Z', category: 'System', level: 'SUCCESS', actor: 'System', actorRole: 'Auto', action: 'Maintenance window completed', target: 'OLT-Core-01', detail: 'Scheduled firmware maintenance completed — OLT back online', ip: '—' },
  { id: 'l022', timestamp: '2026-05-21T22:30:00Z', category: 'ONU', level: 'INFO', actor: 'System', actorRole: 'Auto', action: 'Firmware upgraded', target: 'ONU (Main Library)', detail: 'ONU firmware upgraded to v3.2.1 automatically', ip: '—' },
  { id: 'l023', timestamp: '2026-05-21T18:20:00Z', category: 'Alarm', level: 'SUCCESS', actor: 'Mike Torres', actorRole: 'Admin', action: 'Alarm acknowledged', target: 'OLT-South-01', detail: 'Memory elevation alarm acknowledged — monitoring continues', ip: '10.0.0.48' },
  { id: 'l024', timestamp: '2026-05-21T14:05:00Z', category: 'OLT', level: 'INFO', actor: 'Sarah Chen', actorRole: 'Admin', action: 'OLT rebooted', target: 'OLT-East-01', detail: 'Scheduled maintenance reboot — 34 ONUs briefly disconnected', ip: '192.168.1.12' },
  { id: 'l025', timestamp: '2026-05-21T10:00:00Z', category: 'Login', level: 'SUCCESS', actor: 'Sarah Chen', actorRole: 'Admin', action: 'Login successful', target: 'NOCpulse Portal', detail: 'Start of shift login — 8h session', ip: '192.168.1.12' },
];

const CATEGORY_CONFIG: Record<Exclude<LogCategory, 'All'>, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  Login: { icon: LogIn, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  OLT: { icon: Server, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  ONU: { icon: Cpu, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  Alarm: { icon: Bell, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  System: { icon: Settings, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  Staff: { icon: User, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
};

const LEVEL_CONFIG: Record<LogLevel, { color: string; bg: string; border: string }> = {
  INFO: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  WARN: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  ERROR: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  SUCCESS: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
};

function CategoryBadge({ category }: { category: Exclude<LogCategory, 'All'> }) {
  const cfg = CATEGORY_CONFIG[category];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Icon className="h-2.5 w-2.5" />
      {category}
    </span>
  );
}

function LevelBadge({ level }: { level: LogLevel }) {
  const cfg = LEVEL_CONFIG[level];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      {level}
    </span>
  );
}

export default function ActivityLogs() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<LogCategory>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return LOGS.filter(log => {
      const matchCat = category === 'All' || log.category === category;
      const q = search.toLowerCase();
      const matchSearch = !q || log.actor.toLowerCase().includes(q) || log.action.toLowerCase().includes(q) || log.target.toLowerCase().includes(q) || log.detail.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [search, category]);

  const categories: LogCategory[] = ['All', 'Login', 'OLT', 'ONU', 'Alarm', 'System', 'Staff'];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Full audit trail of all staff actions and system events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: LOGS.length, color: 'text-foreground' },
          { label: 'Today', value: LOGS.filter(l => l.timestamp.startsWith('2026-05-22')).length, color: 'text-primary' },
          { label: 'Warnings / Errors', value: LOGS.filter(l => l.level === 'WARN' || l.level === 'ERROR').length, color: 'text-amber-400' },
          { label: 'Login Events', value: LOGS.filter(l => l.category === 'Login').length, color: 'text-cyan-400' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-border/60 bg-card/60 p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search actor, action, target..."
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-border/60 bg-card/60 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                category === cat
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Log table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border/60">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Level</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Action</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Target</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No log entries match your filter
                  </td>
                </tr>
              )}
              {filtered.map(log => (
                <Fragment key={log.id}>
                  <tr
                    className={`hover:bg-muted/20 transition-colors cursor-pointer ${expandedId === log.id ? 'bg-muted/20' : ''} ${log.level === 'ERROR' ? 'border-l-2 border-l-red-500' : log.level === 'WARN' ? 'border-l-2 border-l-amber-500' : ''}`}
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <p className="text-xs font-mono">{new Date(log.timestamp).toLocaleDateString()}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{new Date(log.timestamp).toLocaleTimeString()}</p>
                    </td>
                    <td className="px-4 py-2.5"><CategoryBadge category={log.category} /></td>
                    <td className="px-4 py-2.5"><LevelBadge level={log.level} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-[8px] font-bold text-primary">
                            {log.actor === 'System' || log.actor === 'Unknown' ? '⚙' : log.actor.split(' ').map(w => w[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-medium">{log.actor}</p>
                          <p className="text-[10px] text-muted-foreground">{log.actorRole}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium">{log.action}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.target}</td>
                    <td className="px-4 py-2.5">
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expandedId === log.id ? 'rotate-180' : ''}`} />
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-detail`} className="bg-muted/10">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex items-start gap-6 text-xs flex-wrap">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Detail</p>
                            <p className="text-foreground">{log.detail}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Source IP</p>
                            <p className="font-mono">{log.ip}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Log ID</p>
                            <p className="font-mono text-muted-foreground">{log.id}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Showing {filtered.length} of {LOGS.length} entries</span>
          <span className="flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            Audit logs are read-only and tamper-evident
          </span>
        </div>
      </div>
    </div>
  );
}
