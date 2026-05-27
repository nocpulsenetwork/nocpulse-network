import { alarms, olts, onus, metrics } from '@/data/mockData';
import { MetricCard } from '@/components/MetricCard';
import {
  Server, Cpu, AlertTriangle, Shield, Users,
  RefreshCw, MapPin, ChevronDown, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';

// ── Static 24-hour bandwidth mock (Gbps) ────────────────────────────────────
const BW_DATA = [
  { t: '00:00', dl: 18, ul: 6 }, { t: '02:00', dl: 14, ul: 4 },
  { t: '04:00', dl: 11, ul: 3 }, { t: '06:00', dl: 15, ul: 5 },
  { t: '08:00', dl: 28, ul: 9 }, { t: '10:00', dl: 38, ul: 14 },
  { t: '12:00', dl: 45, ul: 18 }, { t: '14:00', dl: 42, ul: 16 },
  { t: '16:00', dl: 48, ul: 19 }, { t: '18:00', dl: 52, ul: 21 },
  { t: '20:00', dl: 44, ul: 17 }, { t: '22:00', dl: 30, ul: 11 },
];

const SEV_STYLE = {
  Critical: { dot: 'bg-red-500',    border: 'border-l-red-500',    badge: 'bg-red-500/10 text-red-400 border-red-500/20',    pulse: true },
  Major:    { dot: 'bg-amber-500',  border: 'border-l-amber-500',  badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', pulse: false },
  Minor:    { dot: 'bg-blue-500',   border: 'border-l-blue-500',   badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',   pulse: false },
  Info:     { dot: 'bg-slate-500',  border: 'border-l-slate-500',  badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20', pulse: false },
} as const;

const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    borderColor: 'hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '11px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  itemStyle: { color: 'hsl(var(--foreground))' },
  labelStyle: { color: 'hsl(var(--muted-foreground))', fontSize: '10px' },
};

export default function Dashboard() {
  const {
    totalOlts, totalOnus, onlineOnus, offlineOnus,
    offlineOlts, activeAlarms, criticalAlarms, networkUptime,
  } = metrics;

  const onlineOlts   = olts.filter(o => o.status === 'Online').length;
  const degradedOnus = onus.filter(o => o.status === 'Degraded').length;
  const majorAlarms  = alarms.filter(a => !a.acknowledged && a.severity === 'Major').length;
  const totalClients = totalOnus;

  const recentAlarms = [...alarms]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  const onuStatusData = [
    { name: 'Online',   value: onlineOnus,   color: '#22c55e' },
    { name: 'Degraded', value: degradedOnus,  color: '#f59e0b' },
    { name: 'Offline',  value: offlineOnus,   color: '#ef4444' },
  ];

  const oltLoadData = [...olts]
    .filter(o => o.activeOnus > 0)
    .sort((a, b) => b.activeOnus - a.activeOnus)
    .slice(0, 7)
    .map(o => ({
      name: o.name.replace('OLT-', ''),
      onus: o.activeOnus,
    }));

  const goodSignal = onus.filter(o => o.signalLevel > -25 && o.status !== 'Offline').length;
  const weakSignal = onus.filter(o => o.signalLevel <= -25 && o.signalLevel > -28).length;
  const poorSignal = onus.filter(o => o.signalLevel <= -28 && o.status !== 'Offline').length;

  return (
    <div className="space-y-4 pb-6">

      {/* ── 1. Page Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time network monitoring and management</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
            <MapPin className="h-3 w-3 shrink-0" /> All Sites <ChevronDown className="h-3 w-3 shrink-0" />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
            <Clock className="h-3 w-3 shrink-0" /> Last 5 Minutes <ChevronDown className="h-3 w-3 shrink-0" />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
            <RefreshCw className="h-3 w-3 shrink-0" /> Refresh
          </button>
        </div>
      </div>

      {/* ── 2. KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          title="Total OLTs"
          value={totalOlts}
          icon={Server}
          accentColor="cyan"
          description={`${onlineOlts} online · ${offlineOlts} offline`}
          href="/olts"
        />
        <MetricCard
          title="Total ONUs"
          value={totalOnus}
          icon={Cpu}
          accentColor="cyan"
          description={`${onlineOnus} active connections`}
          href="/onus"
        />
        <MetricCard
          title="Total Clients"
          value={totalClients}
          icon={Users}
          accentColor="cyan"
          description="Subscriber premises"
          href="/onus"
        />
        <MetricCard
          title="Active Alarms"
          value={activeAlarms}
          icon={AlertTriangle}
          accentColor={criticalAlarms > 0 ? 'red' : 'amber'}
          alert={activeAlarms > 0}
          pulse={criticalAlarms > 0}
          description={`${criticalAlarms} critical · ${majorAlarms} major`}
          href="/alarms"
        />
        <MetricCard
          title="Uptime"
          value={`${networkUptime}%`}
          icon={Shield}
          accentColor="green"
          description="Network SLA target"
        />
      </div>

      {/* ── 3. Network Map + Recent Alarms ───────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">

        {/* Network Status Map */}
        <Card className="xl:col-span-7 border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-sm font-semibold">Network Status Map</CardTitle>
                <CardDescription className="text-xs mt-0.5">{olts.length} OLT nodes · {onlineOlts} operational</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_4px_#22c55e]" />Online</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Degraded</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Offline</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {olts.map(olt => {
                const isOnline  = olt.status === 'Online';
                const isDeg     = olt.status === 'Degraded';
                const isOffline = olt.status === 'Offline';
                return (
                  <Link key={olt.id} href={`/olts/${olt.id}`}>
                    <div className={`p-2.5 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 duration-150 ${
                      isOnline  ? 'border-green-500/20 bg-green-500/[0.04] hover:bg-green-500/[0.08]' :
                      isDeg     ? 'border-amber-500/20 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]' :
                                  'border-red-500/20 bg-red-500/[0.04] hover:bg-red-500/[0.08]'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${
                            isOnline  ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' :
                            isDeg     ? 'bg-amber-500 shadow-[0_0_5px_#f59e0b] animate-pulse' :
                                        'bg-red-500'
                          }`} />
                          <span className="text-[11px] font-semibold truncate leading-none">
                            {olt.name.replace('OLT-', '')}
                          </span>
                        </div>
                        <Server className={`h-3 w-3 shrink-0 ${
                          isOnline ? 'text-green-400' : isDeg ? 'text-amber-400' : 'text-red-400'
                        }`} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                        <span>{olt.activeOnus} ONUs</span>
                        <span className="font-mono">{olt.ip}</span>
                      </div>
                      {!isOffline ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-muted-foreground/60 w-7 shrink-0">CPU</span>
                            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${olt.cpu > 80 ? 'bg-red-500' : olt.cpu > 60 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${olt.cpu}%` }} />
                            </div>
                            <span className="text-[9px] font-mono text-muted-foreground/70 w-7 text-right shrink-0">{olt.cpu}%</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-muted-foreground/60 w-7 shrink-0">MEM</span>
                            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${olt.memory > 80 ? 'bg-red-500' : olt.memory > 60 ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${olt.memory}%` }} />
                            </div>
                            <span className="text-[9px] font-mono text-muted-foreground/70 w-7 text-right shrink-0">{olt.memory}%</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-red-400 font-semibold">Device offline</div>
                      )}
                    </div>
                  </Link>
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
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[380px]">
            {recentAlarms.map(alarm => {
              const sev = SEV_STYLE[alarm.severity];
              return (
                <div
                  key={alarm.id}
                  className={`flex items-start gap-3 px-4 py-2.5 border-b border-border/40 border-l-2 ${sev.border} hover:bg-muted/30 transition-colors last:border-b-0 ${alarm.acknowledged ? 'opacity-55' : ''}`}
                >
                  <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${sev.dot} ${!alarm.acknowledged && sev.pulse ? 'animate-pulse' : ''}`} />
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

      {/* ── 4. Device Health + Fiber Overview ────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">

        {/* Device Health */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">Device Health</CardTitle>
            <CardDescription className="text-xs">CPU · Memory · Temperature per active OLT</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {olts.filter(o => o.status !== 'Offline').map(olt => (
                <Link key={olt.id} href={`/olts/${olt.id}`}>
                  <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/20 transition-colors cursor-pointer">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${olt.status === 'Online' ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                    <span className="text-xs font-medium w-28 shrink-0 truncate">{olt.name.replace('OLT-', '')}</span>
                    <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
                      {[
                        { label: 'CPU', val: olt.cpu, unit: '%', hi: 80, med: 60, hiC: 'bg-red-500', medC: 'bg-amber-500', loC: 'bg-green-500', hiT: 'text-red-400', medT: 'text-amber-400', loT: 'text-green-400' },
                        { label: 'MEM', val: olt.memory, unit: '%', hi: 80, med: 60, hiC: 'bg-red-500', medC: 'bg-amber-500', loC: 'bg-cyan-500', hiT: 'text-red-400', medT: 'text-amber-400', loT: 'text-cyan-400' },
                        { label: 'TEMP', val: olt.temperature, unit: '°', pct: Math.min(100, olt.temperature * 1.5), hi: 55, med: 50, hiC: 'bg-red-500', medC: 'bg-amber-500', loC: 'bg-blue-500', hiT: 'text-red-400', medT: 'text-amber-400', loT: 'text-blue-400' },
                      ].map(m => {
                        const isHi  = m.val > m.hi;
                        const isMed = !isHi && m.val > m.med;
                        const barW  = m.pct !== undefined ? m.pct : m.val;
                        const barC  = isHi ? m.hiC : isMed ? m.medC : m.loC;
                        const txtC  = isHi ? m.hiT : isMed ? m.medT : m.loT;
                        return (
                          <div key={m.label} className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-muted-foreground">{m.label}</span>
                              <span className={`text-[9px] font-mono font-bold ${txtC}`}>{m.val}{m.unit}</span>
                            </div>
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barC}`} style={{ width: `${barW}%` }} />
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

        {/* Fiber Overview */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">Fiber Overview</CardTitle>
            <CardDescription className="text-xs">ONU connection & signal health</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Donut */}
            <div className="flex items-center gap-4">
              <div className="h-[96px] w-[96px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={onuStatusData} cx="50%" cy="50%" innerRadius={28} outerRadius={45} dataKey="value" strokeWidth={0}>
                      {onuStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 flex-1">
                {onuStatusData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                    <span className="text-xs font-bold font-mono">{d.value}</span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {Math.round((d.value / totalOnus) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Signal levels */}
            <div className="space-y-2 border-t border-border/50 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">Signal Quality</p>
              {[
                { label: 'Good  (> −25 dBm)', count: goodSignal, color: 'bg-green-500', pct: Math.round((goodSignal / totalOnus) * 100) },
                { label: 'Weak  (−25 to −28)', count: weakSignal, color: 'bg-amber-500', pct: Math.round((weakSignal / totalOnus) * 100) },
                { label: 'Poor  (< −28 dBm)',  count: poorSignal,  color: 'bg-red-500',   pct: Math.round((poorSignal / totalOnus) * 100) },
              ].map(s => (
                <div key={s.label} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.color}`} />
                      <span className="text-[10px] text-muted-foreground font-mono">{s.label}</span>
                    </div>
                    <span className="text-[10px] font-bold">{s.count}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden ml-3">
                    <div className={`h-full rounded-full ${s.color} opacity-70`} style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 5. Bottom: Bandwidth + Top OLT + System Info ─────────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-12">

        {/* Bandwidth Usage */}
        <Card className="lg:col-span-5 border-border/60 shadow-sm">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Bandwidth Usage</CardTitle>
                <CardDescription className="text-xs">Download · Upload — last 24h (Gbps)</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Download</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" />Upload</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[175px] pt-3 pr-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={BW_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradUl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} interval={1} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                <Tooltip {...CHART_TOOLTIP} />
                <Area type="monotone" dataKey="dl" name="Download" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#gradDl)" dot={false} activeDot={{ r: 3 }} />
                <Area type="monotone" dataKey="ul" name="Upload"   stroke="#22d3ee"             strokeWidth={1.5} fill="url(#gradUl)" dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top OLT by Bandwidth */}
        <Card className="lg:col-span-4 border-border/60 shadow-sm">
          <CardHeader className="pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Top OLT by Load</CardTitle>
                <CardDescription className="text-xs">Ranked by active subscribers</CardDescription>
              </div>
              <Link href="/olts" className="text-[11px] font-medium text-primary hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent className="h-[175px] pt-3 pr-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={oltLoadData} layout="vertical" margin={{ top: 0, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={60} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="onus" name="Active ONUs" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} maxBarSize={12} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card className="lg:col-span-3 border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">System Information</CardTitle>
            <CardDescription className="text-xs">Platform operational status</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {[
                { label: 'Platform',        value: 'NOCpulse v1.0',              color: '' },
                { label: 'Network SLA',     value: `${networkUptime}%`,          color: 'text-green-400' },
                { label: 'OLT Online',      value: `${onlineOlts} / ${totalOlts}`, color: onlineOlts === totalOlts ? 'text-green-400' : 'text-amber-400' },
                { label: 'ONU Online',      value: `${onlineOnus} / ${totalOnus}`, color: offlineOnus === 0 ? 'text-green-400' : 'text-amber-400' },
                { label: 'Active Alarms',   value: String(activeAlarms),         color: activeAlarms === 0 ? 'text-green-400' : criticalAlarms > 0 ? 'text-red-400' : 'text-amber-400' },
                { label: 'Total Bandwidth', value: metrics.bandwidthUsage,       color: '' },
                { label: 'Last Sync',       value: 'Just now',                   color: 'text-green-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">{item.label}</span>
                  <span className={`text-[11px] font-semibold font-mono ${item.color} shrink-0`}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                <span>OLT Health Score</span>
                <span className="font-mono font-bold text-green-400">{Math.round((onlineOlts / totalOlts) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400"
                  style={{ width: `${Math.round((onlineOlts / totalOlts) * 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
