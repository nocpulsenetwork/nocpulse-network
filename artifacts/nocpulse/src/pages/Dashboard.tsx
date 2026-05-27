import { alarms, olts, onus, metrics } from '@/data/mockData';
import { MetricCard } from '@/components/MetricCard';
import {
  Server, Cpu, AlertTriangle, Shield, Users,
  RefreshCw, MapPin, ChevronDown, Clock,
  WifiOff, ServerCrash, Activity, CheckCircle2, XCircle,
  TrendingUp, Signal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';

/* ── Static 24-hour bandwidth mock (Gbps) ───────────────────────────── */
const BW_DATA = [
  { t: '00:00', dl: 18, ul: 6 }, { t: '02:00', dl: 14, ul: 4 },
  { t: '04:00', dl: 11, ul: 3 }, { t: '06:00', dl: 15, ul: 5 },
  { t: '08:00', dl: 28, ul: 9 }, { t: '10:00', dl: 38, ul: 14 },
  { t: '12:00', dl: 45, ul: 18 }, { t: '14:00', dl: 42, ul: 16 },
  { t: '16:00', dl: 48, ul: 19 }, { t: '18:00', dl: 52, ul: 21 },
  { t: '20:00', dl: 44, ul: 17 }, { t: '22:00', dl: 30, ul: 11 },
];

/* ── Severity style map ──────────────────────────────────────────────── */
const SEV = {
  Critical: { dot: 'bg-red-500',   border: 'border-l-red-500',   badge: 'bg-red-500/10 text-red-400 border-red-500/20',   pulse: true },
  Major:    { dot: 'bg-amber-500', border: 'border-l-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', pulse: false },
  Minor:    { dot: 'bg-blue-500',  border: 'border-l-blue-500',  badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',  pulse: false },
  Info:     { dot: 'bg-slate-400', border: 'border-l-slate-400', badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20', pulse: false },
} as const;

/* ── Shared recharts tooltip style ───────────────────────────────────── */
const TT_STYLE = {
  contentStyle: { backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '11px' },
  itemStyle:    { color: 'hsl(var(--foreground))' },
  labelStyle:   { color: 'hsl(var(--muted-foreground))', fontSize: '10px' },
};

/* ── Site grouping from OLT location data ────────────────────────────── */
type SiteRow = { site: string; total: number; online: number; degraded: number; offline: number; onus: number };

export default function Dashboard() {
  const {
    totalOlts, totalOnus, onlineOnus, offlineOnus,
    offlineOlts, activeAlarms, criticalAlarms, networkUptime,
  } = metrics;

  const onlineOlts   = olts.filter(o => o.status === 'Online').length;
  const degradedOlts = olts.filter(o => o.status === 'Degraded').length;
  const degradedOnus = onus.filter(o => o.status === 'Degraded').length;
  const majorAlarms  = alarms.filter(a => !a.acknowledged && a.severity === 'Major').length;

  /* Site summary ─────────────────────────────────────────────────────── */
  const siteMap = new Map<string, SiteRow>();
  for (const o of olts) {
    const prev = siteMap.get(o.location) ?? { site: o.location, total: 0, online: 0, degraded: 0, offline: 0, onus: 0 };
    siteMap.set(o.location, {
      ...prev,
      total:    prev.total + 1,
      online:   prev.online   + (o.status === 'Online'   ? 1 : 0),
      degraded: prev.degraded + (o.status === 'Degraded' ? 1 : 0),
      offline:  prev.offline  + (o.status === 'Offline'  ? 1 : 0),
      onus:     prev.onus     + o.activeOnus,
    });
  }
  const sites = [...siteMap.values()];

  /* Recent alarms ────────────────────────────────────────────────────── */
  const recentAlarms = [...alarms]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  /* ONU status pie ───────────────────────────────────────────────────── */
  const onuPie = [
    { name: 'Online',   value: onlineOnus,   color: '#22c55e' },
    { name: 'Degraded', value: degradedOnus,  color: '#f59e0b' },
    { name: 'Offline',  value: offlineOnus,   color: '#ef4444' },
  ];

  /* Top OLT bar (horizontal) ─────────────────────────────────────────── */
  const oltBar = [...olts]
    .filter(o => o.activeOnus > 0)
    .sort((a, b) => b.activeOnus - a.activeOnus)
    .slice(0, 6)
    .map(o => ({ name: o.name.replace('OLT-', ''), onus: o.activeOnus }));

  /* Top Clients (top ONUs by signal quality & online) ────────────────── */
  const topClients = [...onus]
    .filter(o => o.status === 'Online')
    .sort((a, b) => b.signalLevel - a.signalLevel)
    .slice(0, 7);

  /* Signal counts ─────────────────────────────────────────────────────── */
  const sigGood = onus.filter(o => o.signalLevel > -25 && o.status !== 'Offline').length;
  const sigWeak = onus.filter(o => o.signalLevel <= -25 && o.signalLevel > -28).length;
  const sigPoor = onus.filter(o => o.signalLevel <= -28 && o.status !== 'Offline').length;

  /* ─────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4 pb-6">

      {/* ── 1. Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time network monitoring and management</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
            <MapPin className="h-3 w-3 shrink-0" /> All Sites <ChevronDown className="h-3 w-3 shrink-0" />
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
            <Clock className="h-3 w-3 shrink-0" /> Last 5 Minutes <ChevronDown className="h-3 w-3 shrink-0" />
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
            <RefreshCw className="h-3 w-3 shrink-0" /> Refresh
          </button>
        </div>
      </div>

      {/* ── 2. KPI Cards (7) ───────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
        <MetricCard title="Total OLTs"    value={totalOlts}    icon={Server}      accentColor="cyan"  description={`${onlineOlts} online · ${degradedOlts} degraded`}   href="/olts" />
        <MetricCard title="Total ONUs"    value={totalOnus}    icon={Cpu}         accentColor="cyan"  description={`${onlineOnus} active connections`}                   href="/onus" />
        <MetricCard title="Total Clients" value={totalOnus}    icon={Users}       accentColor="cyan"  description="Subscriber premises"                                  href="/onus" />
        <MetricCard title="Active Alarms" value={activeAlarms} icon={AlertTriangle} accentColor={criticalAlarms > 0 ? 'red' : 'amber'} alert={activeAlarms > 0} pulse={criticalAlarms > 0} description={`${criticalAlarms} critical · ${majorAlarms} major`} href="/alarms" />
        <MetricCard title="Offline OLTs"  value={offlineOlts}  icon={ServerCrash} accentColor={offlineOlts > 0 ? 'red' : 'green'} alert={offlineOlts > 0} description={offlineOlts > 0 ? 'Require immediate action' : 'All terminals online'} href="/olts" />
        <MetricCard title="Offline ONUs"  value={offlineOnus}  icon={WifiOff}     accentColor={offlineOnus > 0 ? 'red' : 'green'} alert={offlineOnus > 0} description={offlineOnus > 0 ? 'Disconnected premises' : 'All premises online'}    href="/onus" />
        <MetricCard title="Uptime"        value={`${networkUptime}%`} icon={Shield} accentColor="green" description="Network SLA target" />
      </div>

      {/* ── 3a. Network Map + Recent Alarms ────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">

        {/* Network Map — location-based site summary (NOT an OLT tile grid) */}
        <Card className="xl:col-span-7 border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-sm font-semibold">Network Map</CardTitle>
                <CardDescription className="text-xs mt-0.5">Site-by-site operational overview</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_4px_#22c55e]" />Online</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Degraded</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Offline</span>
              </div>
            </div>
          </CardHeader>

          {/* Overall network health bar */}
          <div className="px-4 py-3 border-b border-border/40 grid grid-cols-4 gap-4">
            {[
              { label: 'OLTs Healthy',    pct: Math.round((onlineOlts / totalOlts) * 100),  color: 'bg-green-500' },
              { label: 'ONUs Active',     pct: Math.round((onlineOnus / totalOnus) * 100),  color: 'bg-cyan-500' },
              { label: 'Alarm Resolved',  pct: Math.round(((alarms.length - activeAlarms) / alarms.length) * 100), color: 'bg-blue-500' },
              { label: 'Network Uptime',  pct: networkUptime, color: 'bg-emerald-500' },
            ].map(m => (
              <div key={m.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground/70">{m.label}</span>
                  <span className="text-[9px] font-mono font-bold">{m.pct}%</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${m.color}`} style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Site table */}
          <CardContent className="p-0">
            <div className="overflow-x-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border/30 bg-muted/20">
                <span className="col-span-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Site / Location</span>
                <span className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-center">OLTs</span>
                <span className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-center">Active ONUs</span>
                <span className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-center">Status</span>
                <span className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 text-right">Health</span>
              </div>
              {sites.map(site => {
                const allOnline   = site.offline === 0 && site.degraded === 0;
                const hasDegraded = site.degraded > 0 && site.offline === 0;
                const hasOffline  = site.offline > 0;
                const statusColor = hasOffline ? 'text-red-400' : hasDegraded ? 'text-amber-400' : 'text-green-400';
                const dotColor    = hasOffline ? 'bg-red-500' : hasDegraded ? 'bg-amber-500 animate-pulse' : 'bg-green-500 shadow-[0_0_4px_#22c55e]';
                const statusLabel = hasOffline ? 'Degraded' : hasDegraded ? 'Warning' : 'Healthy';
                const healthPct   = Math.round((site.online / site.total) * 100);
                return (
                  <div key={site.site} className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-border/30 hover:bg-muted/20 transition-colors items-center last:border-b-0">
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                      <span className="text-xs font-medium truncate">{site.site}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-xs font-mono">{site.online}/{site.total}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-xs font-mono font-semibold">{site.onus.toLocaleString()}</span>
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <span className={`text-[10px] font-bold ${statusColor}`}>{statusLabel}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5 justify-end">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-[50px]">
                        <div
                          className={`h-full rounded-full ${hasOffline ? 'bg-red-500' : hasDegraded ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${healthPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">{healthPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Alarms */}
        <Card className="xl:col-span-5 border-border/60 shadow-sm flex flex-col">
          <CardHeader className="pb-3 border-b border-border/50 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Recent Alarms</CardTitle>
                <CardDescription className="text-xs mt-0.5">{activeAlarms} unacknowledged events</CardDescription>
              </div>
              <Link href="/alarms" className="text-[11px] font-medium text-primary hover:underline">
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[400px]">
            {recentAlarms.map(alarm => {
              const sev = SEV[alarm.severity];
              return (
                <div
                  key={alarm.id}
                  className={`flex items-start gap-3 px-4 py-2.5 border-b border-border/40 border-l-2 ${sev.border} hover:bg-muted/30 transition-colors last:border-b-0 ${alarm.acknowledged ? 'opacity-50' : ''}`}
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${sev.dot} ${!alarm.acknowledged && sev.pulse ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold truncate">{alarm.deviceName}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${sev.badge}`}>
                        {alarm.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{alarm.description}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap pt-0.5">
                    {formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── 3b. Fiber Overview + Device Health + Top OLT ───────────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">

        {/* Fiber Overview */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">Fiber Overview</CardTitle>
            <CardDescription className="text-xs">ONU connection health breakdown</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Donut */}
            <div className="flex items-center gap-4">
              <div className="h-[88px] w-[88px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={onuPie} cx="50%" cy="50%" innerRadius={26} outerRadius={42} dataKey="value" strokeWidth={0}>
                      {onuPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {onuPie.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                    <span className="text-xs font-bold font-mono">{d.value}</span>
                    <span className="text-[10px] text-muted-foreground/60 w-8 text-right">{Math.round((d.value / totalOnus) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Signal quality */}
            <div className="space-y-2 border-t border-border/50 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">Signal Quality</p>
              {[
                { label: 'Good  > −25 dBm',  count: sigGood, color: 'bg-green-500' },
                { label: 'Weak  −25 to −28', count: sigWeak, color: 'bg-amber-500' },
                { label: 'Poor  < −28 dBm',  count: sigPoor, color: 'bg-red-500' },
              ].map(s => {
                const pct = Math.round((s.count / totalOnus) * 100);
                return (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.color}`} />
                        <span className="text-[10px] text-muted-foreground font-mono">{s.label}</span>
                      </div>
                      <span className="text-[10px] font-bold">{s.count}</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden ml-3">
                      <div className={`h-full rounded-full ${s.color} opacity-80`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Device Health */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">Device Health</CardTitle>
            <CardDescription className="text-xs">CPU · Memory · Temp per active OLT</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {olts.filter(o => o.status !== 'Offline').slice(0, 8).map(olt => (
                <Link key={olt.id} href={`/olts/${olt.id}`}>
                  <div className="px-4 py-2 flex items-center gap-2.5 hover:bg-muted/20 transition-colors cursor-pointer">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${olt.status === 'Online' ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                    <span className="text-[11px] font-medium w-20 shrink-0 truncate">{olt.name.replace('OLT-', '')}</span>
                    <div className="flex-1 grid grid-cols-3 gap-1.5 min-w-0">
                      {[
                        { v: olt.cpu,         u: '%', hi: 80, med: 60, hiB: 'bg-red-500',  medB: 'bg-amber-500', loB: 'bg-green-500', hiT: 'text-red-400',  medT: 'text-amber-400', loT: 'text-green-400',  p: olt.cpu },
                        { v: olt.memory,      u: '%', hi: 80, med: 60, hiB: 'bg-red-500',  medB: 'bg-amber-500', loB: 'bg-cyan-500',  hiT: 'text-red-400',  medT: 'text-amber-400', loT: 'text-cyan-400',   p: olt.memory },
                        { v: olt.temperature, u: '°', hi: 55, med: 50, hiB: 'bg-red-500',  medB: 'bg-amber-500', loB: 'bg-blue-500',  hiT: 'text-red-400',  medT: 'text-amber-400', loT: 'text-blue-400',   p: Math.min(100, olt.temperature * 1.5) },
                      ].map((m, idx) => {
                        const isHi = m.v > m.hi; const isMed = !isHi && m.v > m.med;
                        return (
                          <div key={idx}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`text-[9px] font-mono ${isHi ? m.hiT : isMed ? m.medT : m.loT}`}>{m.v}{m.u}</span>
                            </div>
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isHi ? m.hiB : isMed ? m.medB : m.loB}`} style={{ width: `${m.p}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">System Information</CardTitle>
            <CardDescription className="text-xs">Platform operational status</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {[
              { label: 'Platform',        value: 'NOCpulse v1.0',                color: '' },
              { label: 'Network SLA',     value: `${networkUptime}%`,            color: 'text-green-400' },
              { label: 'OLT Online',      value: `${onlineOlts} / ${totalOlts}`, color: onlineOlts === totalOlts ? 'text-green-400' : 'text-amber-400' },
              { label: 'OLT Degraded',    value: `${degradedOlts}`,              color: degradedOlts > 0 ? 'text-amber-400' : 'text-green-400' },
              { label: 'OLT Offline',     value: `${offlineOlts}`,               color: offlineOlts > 0 ? 'text-red-400' : 'text-green-400' },
              { label: 'ONU Online',      value: `${onlineOnus} / ${totalOnus}`, color: offlineOnus === 0 ? 'text-green-400' : 'text-amber-400' },
              { label: 'Active Alarms',   value: `${activeAlarms}`,              color: activeAlarms === 0 ? 'text-green-400' : criticalAlarms > 0 ? 'text-red-400' : 'text-amber-400' },
              { label: 'Total Bandwidth', value: metrics.bandwidthUsage,         color: '' },
              { label: 'Last Sync',       value: 'Just now',                     color: 'text-green-400' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span className={`text-[11px] font-semibold font-mono shrink-0 ${item.color}`}>{item.value}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                <span>OLT Health Score</span>
                <span className="font-mono font-bold text-green-400">{Math.round((onlineOlts / totalOlts) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400" style={{ width: `${Math.round((onlineOlts / totalOlts) * 100)}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Top OLT by Bandwidth (spans full width) ─────────────────── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-2 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Top OLT by Bandwidth</CardTitle>
              <CardDescription className="text-xs">Ranked by active subscriber count</CardDescription>
            </div>
            <Link href="/olts" className="text-[11px] font-medium text-primary hover:underline">View all →</Link>
          </div>
        </CardHeader>
        <CardContent className="h-[160px] pt-3 pr-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={oltBar} layout="vertical" margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={65} />
              <Tooltip {...TT_STYLE} />
              <Bar dataKey="onus" name="Active ONUs" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} maxBarSize={14} fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── 5. Bottom: Bandwidth + ONU Status + Top Clients ────────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">

        {/* Bandwidth Usage */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Bandwidth Usage</CardTitle>
                <CardDescription className="text-xs">DL · UL — last 24h (Gbps)</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />DL</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-400" />UL</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[175px] pt-3 pr-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={BW_DATA} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gDl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gUl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} interval={1} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                <Tooltip {...TT_STYLE} />
                <Area type="monotone" dataKey="dl" name="Download" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#gDl)" dot={false} activeDot={{ r: 3 }} />
                <Area type="monotone" dataKey="ul" name="Upload"   stroke="#22d3ee"             strokeWidth={1.5} fill="url(#gUl)" dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ONU Status */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">ONU Status</CardTitle>
            <CardDescription className="text-xs">Live subscriber connection states</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {[
              { label: 'Online',   value: onlineOnus,   icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', bar: 'bg-green-500' },
              { label: 'Degraded', value: degradedOnus,  icon: Activity,     color: 'text-amber-400', bg: 'bg-amber-500/10', bar: 'bg-amber-500' },
              { label: 'Offline',  value: offlineOnus,   icon: XCircle,      color: 'text-red-400',   bg: 'bg-red-500/10',   bar: 'bg-red-500' },
            ].map(s => {
              const pct = Math.round((s.value / totalOnus) * 100);
              return (
                <div key={s.label} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded ${s.bg}`}>
                      <s.icon className={`h-3 w-3 ${s.color}`} />
                    </div>
                    <span className="text-xs font-medium flex-1">{s.label}</span>
                    <span className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</span>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}

            <div className="mt-2 pt-3 border-t border-border/50 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Recent Disconnections</p>
              {onus.filter(o => o.status === 'Offline').slice(0, 3).map(o => (
                <div key={o.id} className="flex items-center gap-2">
                  <WifiOff className="h-3 w-3 text-red-400 shrink-0" />
                  <span className="text-[11px] font-medium flex-1 truncate">{o.customerName}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{o.lastSync}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Top Clients</CardTitle>
                <CardDescription className="text-xs">Best-signal active subscribers</CardDescription>
              </div>
              <Link href="/onus" className="text-[11px] font-medium text-primary hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {topClients.map((o, idx) => {
                const sigColor = o.signalLevel > -22 ? 'text-green-400' : o.signalLevel > -25 ? 'text-cyan-400' : 'text-amber-400';
                const sigBar   = o.signalLevel > -22 ? 'bg-green-500' : o.signalLevel > -25 ? 'bg-cyan-500' : 'bg-amber-500';
                const barW     = Math.max(20, Math.min(100, ((o.signalLevel + 40) / 25) * 100));
                return (
                  <Link key={o.id} href={`/onus/${o.id}`}>
                    <div className="px-4 py-2 flex items-center gap-3 hover:bg-muted/20 transition-colors cursor-pointer">
                      <span className="text-[10px] font-bold text-muted-foreground/40 w-4 shrink-0">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate leading-none">{o.customerName}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${sigBar}`} style={{ width: `${barW}%` }} />
                          </div>
                          <span className={`text-[10px] font-mono ${sigColor}`}>{o.signalLevel} dBm</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-mono text-muted-foreground">{o.bandwidth}</p>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <Signal className={`h-2.5 w-2.5 ${sigColor}`} />
                          <span className="text-[9px] text-muted-foreground/60">{o.onuNo}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
