import { useState } from 'react';
import {
  Users, Plus, Search, ShieldCheck, AlertTriangle, Clock, XCircle,
  CheckCircle2, BarChart3, Server, Cpu, ChevronDown, ChevronUp,
  Calendar, UserCheck, MoreHorizontal, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PermissionBanner } from '@/components/PermissionBanner';
import { usePermissions } from '@/lib/permissions';

interface Subscriber {
  id: string;
  name: string;
  email: string;
  plan: 'Trial' | 'Starter' | 'Professional' | 'Enterprise';
  oltLimit: number;
  onuLimit: number;
  staffLimit: number;
  oltUsed: number;
  onuUsed: number;
  staffUsed: number;
  activeSince: string;
  expiry: string;
  status: 'Active' | 'Trial' | 'Expiring' | 'Expired' | 'Suspended';
  region: string;
}

const SUBSCRIBERS: Subscriber[] = [
  {
    id: 'sub-001', name: 'ISP Network Alpha', email: 'noc@ispnetwork.io', plan: 'Enterprise',
    oltLimit: 50, onuLimit: 5000, staffLimit: 20, oltUsed: 11, onuUsed: 247, staffUsed: 4,
    activeSince: '2024-01-15', expiry: '2027-01-15', status: 'Active', region: 'Asia Pacific',
  },
  {
    id: 'sub-002', name: 'TeleCom Beta Ltd', email: 'admin@telecombeta.net', plan: 'Professional',
    oltLimit: 10, onuLimit: 500, staffLimit: 5, oltUsed: 6, onuUsed: 142, staffUsed: 3,
    activeSince: '2023-08-30', expiry: '2026-08-30', status: 'Active', region: 'Southeast Asia',
  },
  {
    id: 'sub-003', name: 'QuickNet Services', email: 'ops@quicknet.local', plan: 'Starter',
    oltLimit: 5, onuLimit: 100, staffLimit: 3, oltUsed: 3, onuUsed: 67, staffUsed: 2,
    activeSince: '2025-06-01', expiry: '2026-06-01', status: 'Expiring', region: 'East Asia',
  },
  {
    id: 'sub-004', name: 'MetroFiber Corp', email: 'tech@metrofiber.co', plan: 'Professional',
    oltLimit: 10, onuLimit: 500, staffLimit: 5, oltUsed: 0, onuUsed: 0, staffUsed: 0,
    activeSince: '2022-01-01', expiry: '2025-12-31', status: 'Expired', region: 'South Asia',
  },
  {
    id: 'sub-005', name: 'City ISP Pvt Ltd', email: 'hello@cityisp.io', plan: 'Trial',
    oltLimit: 2, onuLimit: 50, staffLimit: 2, oltUsed: 1, onuUsed: 12, staffUsed: 1,
    activeSince: '2026-05-15', expiry: '2026-06-15', status: 'Trial', region: 'Southeast Asia',
  },
  {
    id: 'sub-006', name: 'FiberLink Global', email: 'noc@fiberlink.global', plan: 'Enterprise',
    oltLimit: 50, onuLimit: 5000, staffLimit: 20, oltUsed: 28, onuUsed: 1204, staffUsed: 11,
    activeSince: '2023-03-10', expiry: '2026-03-10', status: 'Active', region: 'Middle East',
  },
  {
    id: 'sub-007', name: 'NetPro Systems', email: 'admin@netpro.systems', plan: 'Starter',
    oltLimit: 5, onuLimit: 100, staffLimit: 3, oltUsed: 0, onuUsed: 0, staffUsed: 0,
    activeSince: '2024-07-01', expiry: '2025-07-01', status: 'Suspended', region: 'Africa',
  },
];

const PLAN_CONFIG = {
  Trial: { cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20', price: 'Free' },
  Starter: { cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20', price: '$49/mo' },
  Professional: { cls: 'bg-primary/10 text-primary border-primary/20', price: '$199/mo' },
  Enterprise: { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', price: 'Custom' },
};

const STATUS_CONFIG = {
  Active: { cls: 'bg-green-500/10 text-green-400 border-green-500/20', icon: CheckCircle2 },
  Trial: { cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Clock },
  Expiring: { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertTriangle },
  Expired: { cls: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
  Suspended: { cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: XCircle },
};

function UsageBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : color;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground font-mono">{used}/{limit}</span>
        <span className={pct >= 90 ? 'text-red-400 font-semibold' : 'text-muted-foreground'}>{Math.round(pct)}%</span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SubscriberRow({ sub, expanded, onToggle }: { sub: Subscriber; expanded: boolean; onToggle: () => void }) {
  const plan = PLAN_CONFIG[sub.plan];
  const status = STATUS_CONFIG[sub.status];
  const StatusIcon = status.icon;
  const daysToExpiry = Math.ceil((new Date(sub.expiry).getTime() - Date.now()) / 86400000);

  return (
    <div className={`rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden transition-all ${sub.status === 'Expired' || sub.status === 'Suspended' ? 'opacity-60' : ''}`}>
      {/* ── Mobile card layout (hidden on sm+) ── */}
      <div className="sm:hidden px-3 py-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{sub.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{sub.email}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${status.cls}`}>
              <StatusIcon className="h-2.5 w-2.5" /> {sub.status}
            </span>
            <button
              onClick={onToggle}
              className="h-7 w-7 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${plan.cls}`}>
            {sub.plan} · {plan.price}
          </span>
          <span className="text-[10px] text-muted-foreground">{sub.region}</span>
          <span className="text-[10px] font-mono text-muted-foreground ml-auto">Exp: {sub.expiry}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
              <Server className="h-2.5 w-2.5" /> OLT
            </p>
            <UsageBar used={sub.oltUsed} limit={sub.oltLimit} color="bg-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
              <Cpu className="h-2.5 w-2.5" /> ONU
            </p>
            <UsageBar used={sub.onuUsed} limit={sub.onuLimit} color="bg-cyan-500" />
          </div>
        </div>
      </div>

      {/* ── Desktop grid layout (hidden on mobile) ── */}
      <div className="hidden sm:grid grid-cols-12 gap-3 items-center px-4 py-3">
        {/* Name + Email */}
        <div className="col-span-3 min-w-0">
          <p className="text-sm font-semibold truncate">{sub.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{sub.email}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{sub.region}</p>
        </div>

        {/* Plan */}
        <div className="col-span-1">
          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${plan.cls}`}>
            {sub.plan}
          </span>
          <p className="text-[10px] text-muted-foreground mt-1">{plan.price}</p>
        </div>

        {/* OLT usage */}
        <div className="col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <Server className="h-2.5 w-2.5" /> OLT
          </p>
          <UsageBar used={sub.oltUsed} limit={sub.oltLimit} color="bg-primary" />
        </div>

        {/* ONU usage */}
        <div className="col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <Cpu className="h-2.5 w-2.5" /> ONU
          </p>
          <UsageBar used={sub.onuUsed} limit={sub.onuLimit} color="bg-cyan-500" />
        </div>

        {/* Staff usage */}
        <div className="col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <Users className="h-2.5 w-2.5" /> Staff
          </p>
          <UsageBar used={sub.staffUsed} limit={sub.staffLimit} color="bg-violet-500" />
        </div>

        {/* Expiry */}
        <div className="col-span-1 text-center">
          <p className="text-[10px] text-muted-foreground">Expiry</p>
          <p className="text-[11px] font-mono font-medium">{sub.expiry}</p>
          {daysToExpiry > 0 && daysToExpiry < 60 ? (
            <p className="text-[9px] text-amber-400 font-semibold">{daysToExpiry}d left</p>
          ) : daysToExpiry <= 0 ? (
            <p className="text-[9px] text-red-400 font-semibold">Expired</p>
          ) : null}
        </div>

        {/* Status + Actions */}
        <div className="col-span-2 flex items-center justify-end gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${status.cls}`}>
            <StatusIcon className="h-2.5 w-2.5" /> {sub.status}
          </span>
          <button
            onClick={onToggle}
            className="h-7 w-7 rounded-lg border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/10 px-4 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Limits detail */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Plan Limits</p>
            {[
              { label: 'OLT Devices', used: sub.oltUsed, limit: sub.oltLimit, icon: Server, color: 'text-primary' },
              { label: 'ONU Terminals', used: sub.onuUsed, limit: sub.onuLimit, icon: Cpu, color: 'text-cyan-400' },
              { label: 'Staff Accounts', used: sub.staffUsed, limit: sub.staffLimit, icon: Users, color: 'text-violet-400' },
            ].map(l => {
              const Icon = l.icon;
              return (
                <div key={l.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${l.color}`} />
                    <span className="text-xs text-muted-foreground">{l.label}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold">{l.used} / {l.limit}</span>
                </div>
              );
            })}
          </div>

          {/* Account info */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account Info</p>
            {[
              { label: 'Active Since', val: sub.activeSince, icon: UserCheck },
              { label: 'Subscription Expiry', val: sub.expiry, icon: Calendar },
              { label: 'Plan', val: `${sub.plan} — ${PLAN_CONFIG[sub.plan].price}`, icon: BarChart3 },
              { label: 'Region', val: sub.region, icon: CheckCircle2 },
            ].map(r => {
              const Icon = r.icon;
              return (
                <div key={r.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{r.label}</span>
                  </div>
                  <span className="text-xs font-mono">{r.val}</span>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actions</p>
            <Button size="sm" variant="outline" className="w-full text-xs h-8 gap-1.5" disabled>
              <RefreshCw className="h-3.5 w-3.5" /> Renew Subscription
            </Button>
            <Button size="sm" variant="outline" className="w-full text-xs h-8 gap-1.5" disabled>
              <MoreHorizontal className="h-3.5 w-3.5" /> Edit Limits
            </Button>
            {(sub.status === 'Active' || sub.status === 'Trial') && (
              <Button size="sm" variant="outline" className="w-full text-xs h-8 gap-1.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10" disabled>
                <XCircle className="h-3.5 w-3.5" /> Suspend Account
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground text-center mt-1">Actions require backend API</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubscriberManagement() {
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = SUBSCRIBERS.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: SUBSCRIBERS.length,
    active: SUBSCRIBERS.filter(s => s.status === 'Active').length,
    trial: SUBSCRIBERS.filter(s => s.status === 'Trial').length,
    expiring: SUBSCRIBERS.filter(s => s.status === 'Expiring').length,
    expired: SUBSCRIBERS.filter(s => s.status === 'Expired' || s.status === 'Suspended').length,
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriber Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage ISP client accounts, plan limits, and subscription status</p>
        </div>
        <Button
          className="gap-2 text-sm"
          disabled={!can('subscribers.manage')}
          title={!can('subscribers.manage') ? 'Requires Admin or higher' : undefined}
        >
          <Plus className="h-4 w-4" /> Add Subscriber
          {can('subscribers.manage') ? (
            <span className="text-[9px] opacity-60 ml-1">· API required</span>
          ) : (
            <span className="text-[9px] opacity-60 ml-1">· Restricted</span>
          )}
        </Button>
      </div>

      <PermissionBanner context="Subscriber Management — account administration" />

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Subscribers', val: counts.total, color: 'text-foreground', border: 'border-border/60', bg: 'bg-card/80', icon: Users },
          { label: 'Active', val: counts.active, color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/5', icon: CheckCircle2 },
          { label: 'Trial', val: counts.trial, color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/5', icon: Clock },
          { label: 'Expiring Soon', val: counts.expiring, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5', icon: AlertTriangle },
          { label: 'Expired / Suspended', val: counts.expired, color: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-500/5', icon: XCircle },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-4 flex items-center gap-3 cursor-pointer`}
              onClick={() => setStatusFilter(
                s.label === 'Total Subscribers' ? 'all' :
                s.label === 'Active' ? 'Active' :
                s.label === 'Trial' ? 'Trial' :
                s.label === 'Expiring Soon' ? 'Expiring' : 'Expired'
              )}>
              <div className={`h-9 w-9 rounded-lg bg-card/60 flex items-center justify-center border ${s.border}`}>
                <Icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Backend notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-foreground font-semibold">Frontend-only mode — </span>
          Subscriber data shown is mock/demo. Connect the NOCpulse backend API to enable live subscriber creation, plan management, limit enforcement, billing integration, and real-time usage tracking.
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search subscribers…"
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'Active', 'Trial', 'Expiring', 'Expired', 'Suspended'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/60 text-muted-foreground hover:bg-muted/30'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 rounded-lg bg-muted/30 border border-border/40">
        {['Subscriber', 'Plan', 'OLT Usage', 'ONU Usage', 'Staff', 'Expiry', 'Status'].map((h, i) => (
          <div key={h} className={`text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${
            i === 0 ? 'col-span-3' : i === 1 ? 'col-span-1' : i === 2 || i === 3 ? 'col-span-2' : i === 4 || i === 5 ? 'col-span-1' : 'col-span-2 text-right'
          }`}>
            {h}
          </div>
        ))}
      </div>

      {/* Subscriber rows */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Users className="h-8 w-8 opacity-30" />
            <p className="text-sm">No subscribers match your filters</p>
          </div>
        ) : (
          filtered.map(sub => (
            <SubscriberRow
              key={sub.id}
              sub={sub}
              expanded={expandedId === sub.id}
              onToggle={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
            />
          ))
        )}
      </div>

      {/* Pagination placeholder */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">Showing {filtered.length} of {SUBSCRIBERS.length} subscribers</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8" disabled>← Previous</Button>
          <span className="px-3 py-1 rounded border border-primary/30 bg-primary/10 text-xs font-bold text-primary">1</span>
          <Button variant="outline" size="sm" className="text-xs h-8" disabled>Next →</Button>
        </div>
      </div>
    </div>
  );
}
