import { alarms, olts, onus, metrics } from '@/data/mockData';
import { MetricCard } from '@/components/MetricCard';
import {
  Server, Cpu, AlertTriangle, Shield, Users, RefreshCw,
  MapPin, ChevronDown, Clock, WifiOff, ServerCrash,
  Activity, CheckCircle2, XCircle, Signal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';

/* ── Static data ─────────────────────────────────────────────────────── */
const BW_DATA = [
  { t: '00:00', dl: 18, ul: 6 }, { t: '02:00', dl: 14, ul: 4 },
  { t: '04:00', dl: 11, ul: 3 }, { t: '06:00', dl: 15, ul: 5 },
  { t: '08:00', dl: 28, ul: 9 }, { t: '10:00', dl: 38, ul: 14 },
  { t: '12:00', dl: 45, ul: 18 }, { t: '14:00', dl: 42, ul: 16 },
  { t: '16:00', dl: 48, ul: 19 }, { t: '18:00', dl: 52, ul: 21 },
  { t: '20:00', dl: 44, ul: 17 }, { t: '22:00', dl: 30, ul: 11 },
];
const FIBER_DATA = [
  { name: 'Active',  value: 124, color: '#22c55e' },
  { name: 'In Use',  value: 38,  color: '#3b82f6' },
  { name: 'Spare',   value: 18,  color: '#f59e0b' },
  { name: 'Faulty',  value: 6,   color: '#ef4444' },
];
const FIBER_TOTAL = 186;

/* ── SVG topology positions (viewBox 560×296) ───────────────────────── */
const OLT_POS: Record<string, { x: number; y: number }> = {
  'olt-01': { x: 398, y: 62 },  // Data Center Alpha
  'olt-06': { x: 432, y: 82 },  // Data Center Alpha
  'olt-02': { x: 248, y: 40 },  // North Hub
  'olt-09': { x: 296, y: 50 },  // North Hub
  'olt-03': { x: 248, y: 252 }, // South Node
  'olt-10': { x: 296, y: 260 }, // South Node
  'olt-04': { x: 456, y: 132 }, // East Hub
  'olt-11': { x: 464, y: 162 }, // East Hub
  'olt-05': { x: 368, y: 90 },  // West Node (East-01)
  'olt-07': { x: 108, y: 68 },  // Metro Exchange
  'olt-08': { x: 120, y: 228 }, // Suburban Hub 1
};
const CORE = { x: 280, y: 148 };
const ONU_OFF = [
  [22, -18], [32, 2], [18, 22], [-22, 20], [-28, 2],
] as const;

/* ── Alarm severity map ──────────────────────────────────────────────── */
const SEV = {
  Critical: { dot: 'bg-red-500',   border: 'border-l-red-500',   badge: 'bg-red-500/10 text-red-400 border-red-500/20',   pulse: true },
  Major:    { dot: 'bg-amber-500', border: 'border-l-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', pulse: false },
  Minor:    { dot: 'bg-blue-500',  border: 'border-l-blue-500',  badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',  pulse: false },
  Info:     { dot: 'bg-slate-400', border: 'border-l-slate-400', badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20', pulse: false },
} as const;

const TT = {
  contentStyle: { backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '11px' },
  itemStyle:    { color: 'hsl(var(--foreground))' },
  labelStyle:   { color: 'hsl(var(--muted-foreground))', fontSize: '10px' },
};

/* ── SVG Network Topology ────────────────────────────────────────────── */
function NetworkTopology() {
  return (
    <div className="relative w-full overflow-hidden rounded-b-xl" style={{ height: 296 }}>
      {/* bg radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(59,130,246,0.07) 0%, transparent 70%)',
      }} />
      {/* dot grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.15] pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id="dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="currentColor" className="text-foreground" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>

      {/* main SVG topology */}
      <svg viewBox="0 0 560 296" className="relative w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="fg">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="fr">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="fa">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="fc">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* connection lines: core → each OLT */}
        {olts.map(olt => {
          const pos = OLT_POS[olt.id];
          if (!pos) return null;
          const stroke = olt.status === 'Online' ? '#22c55e' : olt.status === 'Degraded' ? '#f59e0b' : '#ef4444';
          const opacity = olt.status === 'Offline' ? 0.18 : 0.35;
          return (
            <line
              key={`ln-${olt.id}`}
              x1={CORE.x} y1={CORE.y} x2={pos.x} y2={pos.y}
              stroke={stroke}
              strokeWidth={olt.status === 'Offline' ? 0.6 : 1.2}
              strokeOpacity={opacity}
              strokeDasharray={olt.status === 'Offline' ? '4 5' : undefined}
            />
          );
        })}

        {/* ONU dots around each online OLT */}
        {olts.filter(o => o.status !== 'Offline').flatMap(olt => {
          const pos = OLT_POS[olt.id];
          if (!pos) return [];
          const count = Math.min(5, Math.max(2, Math.round(olt.activeOnus / 110)));
          return ONU_OFF.slice(0, count).map(([dx, dy], j) => (
            <circle key={`onu-${olt.id}-${j}`} cx={pos.x + dx} cy={pos.y + dy} r={2.8} fill="#3b82f6" fillOpacity={0.65} />
          ));
        })}

        {/* OLT nodes */}
        {olts.map(olt => {
          const pos = OLT_POS[olt.id];
          if (!pos) return null;
          const color  = olt.status === 'Online' ? '#22c55e' : olt.status === 'Degraded' ? '#f59e0b' : '#ef4444';
          const filter = olt.status === 'Online' ? 'fg' : olt.status === 'Degraded' ? 'fa' : 'fr';
          const label  = olt.name.replace('OLT-', '');
          const txtFill = olt.status === 'Online' ? '#86efac' : olt.status === 'Degraded' ? '#fcd34d' : '#fca5a5';
          const above  = pos.y < CORE.y;
          return (
            <g key={`olt-${olt.id}`} filter={`url(#${filter})`}>
              <circle cx={pos.x} cy={pos.y} r={8}  fill={color} fillOpacity={0.18} />
              <circle cx={pos.x} cy={pos.y} r={5}  fill={color} fillOpacity={0.9} />
              <text x={pos.x} y={pos.y + (above ? -13 : 18)} textAnchor="middle" fill={txtFill} fontSize="7.5" fontWeight="500" style={{ pointerEvents: 'none' }}>
                {label}
              </text>
            </g>
          );
        })}

        {/* Core node */}
        <g filter="url(#fc)">
          <circle cx={CORE.x} cy={CORE.y} r={22} fill="rgba(59,130,246,0.12)" />
          <circle cx={CORE.x} cy={CORE.y} r={14} fill="rgba(59,130,246,0.25)" />
          <circle cx={CORE.x} cy={CORE.y} r={8}  fill="#3b82f6" fillOpacity={0.9} />
        </g>
        <text x={CORE.x} y={CORE.y + 30} textAnchor="middle" fill="#93c5fd" fontSize="9.5" fontWeight="600" style={{ pointerEvents: 'none' }}>
          Network Core
        </text>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2.5 left-3 flex items-center gap-3 bg-card/80 backdrop-blur-sm rounded border border-border/40 px-2.5 py-1.5 text-[9px] font-semibold text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" />OLT Online</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />ONU</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Warning</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Offline</span>
      </div>

      {/* Zoom buttons */}
      <div className="absolute bottom-2.5 right-3 flex flex-col gap-1">
        <button className="h-6 w-6 rounded border border-border/60 bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-center text-sm font-bold transition-colors" aria-label="Zoom in">+</button>
        <button className="h-6 w-6 rounded border border-border/60 bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-center text-sm font-bold transition-colors" aria-label="Zoom out">−</button>
      </div>
    </div>
  );
}

/* ── Donut card helper ───────────────────────────────────────────────── */
interface DonutSegment { name: string; value: number; color: string }
interface DonutCardProps {
  title: string;
  desc: string;
  data: DonutSegment[];
  centerVal: string;
  centerSub: string;
  total: number;
}
function DonutCard({ title, desc, data, centerVal, centerSub, total }: DonutCardProps) {
  return (
    <Card className="border-border/60 shadow-sm flex flex-col h-full">
      <CardHeader className="pb-2 border-b border-border/50 shrink-0 py-3 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">{desc}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 flex-1 flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0" style={{ width: 90, height: 90 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={43} dataKey="value" strokeWidth={0}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm font-bold leading-none">{centerVal}</span>
              <span className="text-[9px] text-muted-foreground text-center leading-tight mt-0.5">{centerSub}</span>
            </div>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {data.map(d => {
              const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
              return (
                <div key={d.name} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-[10px] text-muted-foreground truncate">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] font-bold font-mono">{d.value}</span>
                      <span className="text-[9px] text-muted-foreground/60 w-7 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-0.5 bg-muted rounded-full overflow-hidden ml-3.5">
                    <div className="h-full rounded-full opacity-70" style={{ width: `${pct}%`, background: d.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const {
    totalOlts, totalOnus, onlineOnus, offlineOnus,
    offlineOlts, activeAlarms, criticalAlarms, networkUptime,
  } = metrics;

  const onlineOlts   = olts.filter(o => o.status === 'Online').length;
  const degradedOlts = olts.filter(o => o.status === 'Degraded').length;
  const degradedOnus = onus.filter(o => o.status === 'Degraded').length;
  const majorAlarms  = alarms.filter(a => !a.acknowledged && a.severity === 'Major').length;

  /* Device Health from real OLT data */
  const healthyOlts  = olts.filter(o => o.status === 'Online' && o.cpu < 80 && o.memory < 80).length;
  const warningOlts  = olts.filter(o => o.status === 'Degraded' || (o.status === 'Online' && (o.cpu >= 80 || o.memory >= 80))).length;
  const healthPct    = Math.round((healthyOlts / totalOlts) * 100);
  const deviceData   = [
    { name: 'Healthy Devices', value: healthyOlts, color: '#22c55e' },
    { name: 'Warning Devices', value: warningOlts,  color: '#f59e0b' },
    { name: 'Offline Devices', value: offlineOlts,  color: '#ef4444' },
  ];

  /* ONU status donut */
  const onuData = [
    { name: 'Online',   value: onlineOnus,  color: '#22c55e' },
    { name: 'Degraded', value: degradedOnus, color: '#f59e0b' },
    { name: 'Offline',  value: offlineOnus,  color: '#ef4444' },
  ];

  /* Recent alarms */
  const recentAlarms = [...alarms]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  /* Top OLT bar */
  const oltBar = [...olts]
    .filter(o => o.activeOnus > 0)
    .sort((a, b) => b.activeOnus - a.activeOnus)
    .slice(0, 6)
    .map(o => ({ name: o.name.replace('OLT-', ''), onus: o.activeOnus }));

  /* Top clients */
  const topClients = [...onus]
    .filter(o => o.status === 'Online')
    .sort((a, b) => b.signalLevel - a.signalLevel)
    .slice(0, 7);

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

      {/* ── 2. KPI Cards ─────────────────────────────────────────────────
           Order: Total OLTs · Total ONUs · Total Clients ·
                  Offline OLTs · Offline ONUs · Active Alarms · Uptime
      ─────────────────────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
        <MetricCard title="Total OLTs"    value={totalOlts}    icon={Server}        accentColor="cyan"  description={`${onlineOlts} online · ${degradedOlts} degraded`} href="/olts" />
        <MetricCard title="Total ONUs"    value={totalOnus}    icon={Cpu}           accentColor="cyan"  description={`${onlineOnus} active connections`}               href="/onus" />
        <MetricCard title="Total Clients" value={totalOnus}    icon={Users}         accentColor="cyan"  description="Subscriber premises"                              href="/onus" />
        <MetricCard title="Offline OLTs"  value={offlineOlts}  icon={ServerCrash}   accentColor={offlineOlts  > 0 ? 'red' : 'green'} alert={offlineOlts  > 0} description={offlineOlts  > 0 ? 'Require immediate action' : 'All OLTs online'}  href="/olts" />
        <MetricCard title="Offline ONUs"  value={offlineOnus}  icon={WifiOff}       accentColor={offlineOnus  > 0 ? 'red' : 'green'} alert={offlineOnus  > 0} description={offlineOnus  > 0 ? 'Disconnected premises'   : 'All ONUs online'}   href="/onus" />
        <MetricCard title="Active Alarms" value={activeAlarms} icon={AlertTriangle} accentColor={criticalAlarms > 0 ? 'red' : 'amber'} alert={activeAlarms > 0} pulse={criticalAlarms > 0} description={`${criticalAlarms} critical · ${majorAlarms} major`} href="/alarms" />
        <MetricCard title="Uptime"        value={`${networkUptime}%`} icon={Shield} accentColor="green" description="Network SLA target" />
      </div>

      {/* ── 3. Network Map + right column (Fiber + Device Health) ─────── */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">

        {/* Network Map — SVG topology */}
        <Card className="xl:col-span-7 border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-sm font-semibold">Network Map</CardTitle>
                <CardDescription className="text-xs mt-0.5">{olts.length} OLT nodes · live topology</CardDescription>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="px-2 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-green-400 text-[10px]">{onlineOlts} Online</span>
                <span className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]">{degradedOlts} Warning</span>
                <span className="px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-[10px]">{offlineOlts} Offline</span>
              </div>
            </div>
          </CardHeader>
          <NetworkTopology />
        </Card>

        {/* Right stacked column */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          <DonutCard
            title="Fiber Overview"
            desc="Total fiber core usage"
            data={FIBER_DATA}
            centerVal={String(FIBER_TOTAL)}
            centerSub={'Total Fiber\nCores'}
            total={FIBER_TOTAL}
          />
          <DonutCard
            title="Device Health"
            desc="OLT operational condition"
            data={deviceData}
            centerVal={`${healthPct}%`}
            centerSub="Healthy"
            total={totalOlts}
          />
        </div>
      </div>

      {/* ── 4. Recent Alarms · Top OLT · System Info ─────────────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">

        {/* Recent Alarms */}
        <Card className="border-border/60 shadow-sm flex flex-col">
          <CardHeader className="pb-3 border-b border-border/50 shrink-0 py-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Recent Alarms</CardTitle>
                <CardDescription className="text-xs">{activeAlarms} unacknowledged</CardDescription>
              </div>
              <Link href="/alarms" className="text-[11px] font-medium text-primary hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[280px]">
            {recentAlarms.map(alarm => {
              const sev = SEV[alarm.severity];
              return (
                <div
                  key={alarm.id}
                  className={`flex items-start gap-3 px-3 py-2 border-b border-border/40 border-l-2 ${sev.border} hover:bg-muted/30 transition-colors last:border-b-0 ${alarm.acknowledged ? 'opacity-50' : ''}`}
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${sev.dot} ${!alarm.acknowledged && sev.pulse ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold truncate">{alarm.deviceName}</span>
                      <span className={`inline-flex px-1 py-0.5 rounded text-[9px] font-bold border shrink-0 ${sev.badge}`}>{alarm.severity}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{alarm.description}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 pt-0.5">
                    {formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Top OLT by Bandwidth */}
        <Card className="border-border/60 shadow-sm flex flex-col">
          <CardHeader className="pb-2 border-b border-border/50 shrink-0 py-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Top OLT by Bandwidth</CardTitle>
                <CardDescription className="text-xs">Active subscribers per node</CardDescription>
              </div>
              <Link href="/olts" className="text-[11px] font-medium text-primary hover:underline">All →</Link>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pt-3 pr-2 pb-2" style={{ minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={oltBar} layout="vertical" margin={{ top: 0, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={62} />
                <Tooltip {...TT} />
                <Bar dataKey="onus" name="Active ONUs" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} maxBarSize={14} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50 py-3">
            <CardTitle className="text-sm font-semibold">System Information</CardTitle>
            <CardDescription className="text-xs">Platform operational status</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {[
              { label: 'Platform',        value: 'NOCpulse v1.0',                color: '' },
              { label: 'Network SLA',     value: `${networkUptime}%`,            color: 'text-green-400' },
              { label: 'OLT Online',      value: `${onlineOlts} / ${totalOlts}`, color: onlineOlts === totalOlts ? 'text-green-400' : 'text-amber-400' },
              { label: 'OLT Degraded',    value: String(degradedOlts),           color: degradedOlts > 0 ? 'text-amber-400' : 'text-green-400' },
              { label: 'OLT Offline',     value: String(offlineOlts),            color: offlineOlts  > 0 ? 'text-red-400'   : 'text-green-400' },
              { label: 'ONU Online',      value: `${onlineOnus} / ${totalOnus}`, color: offlineOnus  === 0 ? 'text-green-400' : 'text-amber-400' },
              { label: 'Active Alarms',   value: String(activeAlarms),           color: activeAlarms === 0 ? 'text-green-400' : criticalAlarms > 0 ? 'text-red-400' : 'text-amber-400' },
              { label: 'Total Bandwidth', value: metrics.bandwidthUsage,         color: '' },
              { label: 'Last Sync',       value: 'Just now',                     color: 'text-green-400' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span className={`text-[11px] font-semibold font-mono shrink-0 ${item.color}`}>{item.value}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>OLT Health Score</span>
                <span className="font-mono font-bold text-green-400">{healthPct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400" style={{ width: `${healthPct}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 5. Bottom: Bandwidth · ONU Status · Top Clients ─────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">

        {/* Bandwidth Usage */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 border-b border-border/50 py-3">
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
          <CardContent className="h-[180px] pt-3 pr-2 pb-2">
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
                <Tooltip {...TT} />
                <Area type="monotone" dataKey="dl" name="Download" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#gDl)" dot={false} activeDot={{ r: 3 }} />
                <Area type="monotone" dataKey="ul" name="Upload"   stroke="#22d3ee"             strokeWidth={1.5} fill="url(#gUl)" dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ONU Status */}
        <DonutCard
          title="ONU Status"
          desc="Live subscriber connection states"
          data={onuData}
          centerVal={String(totalOnus)}
          centerSub="Total ONU"
          total={totalOnus}
        />

        {/* Top Clients */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50 py-3">
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
                const good   = o.signalLevel > -22;
                const warn   = !good && o.signalLevel > -25;
                const sigC   = good ? 'text-green-400' : warn ? 'text-cyan-400' : 'text-amber-400';
                const barC   = good ? 'bg-green-500'  : warn ? 'bg-cyan-500'  : 'bg-amber-500';
                const barW   = Math.max(15, Math.min(100, ((o.signalLevel + 40) / 25) * 100));
                return (
                  <Link key={o.id} href={`/onus/${o.id}`}>
                    <div className="px-3 py-2 flex items-center gap-2.5 hover:bg-muted/20 transition-colors cursor-pointer">
                      <span className="text-[10px] font-bold text-muted-foreground/40 w-4 shrink-0">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold truncate leading-none">{o.customerName}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="h-1 w-14 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barC}`} style={{ width: `${barW}%` }} />
                          </div>
                          <span className={`text-[10px] font-mono ${sigC}`}>{o.signalLevel} dBm</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-mono text-muted-foreground">{o.bandwidth}</p>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <Signal className={`h-2.5 w-2.5 ${sigC}`} />
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
