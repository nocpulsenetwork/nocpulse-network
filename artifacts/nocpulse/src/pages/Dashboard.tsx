import { alarms, olts, onus, metrics } from '@/data/mockData';
import { MetricCard } from '@/components/MetricCard';
import {
  Server, Cpu, AlertTriangle, Shield, Users, RefreshCw,
  MapPin, ChevronDown, Clock, WifiOff, ServerCrash, Signal,
  AlertCircle, Info as InfoIcon, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';

/* ── Static mock data ────────────────────────────────────────────────── */
const BW_DATA = [
  { t: '00:00', dl: 18, ul: 6 }, { t: '02:00', dl: 14, ul: 4 },
  { t: '04:00', dl: 11, ul: 3 }, { t: '06:00', dl: 15, ul: 5 },
  { t: '08:00', dl: 28, ul: 9 }, { t: '10:00', dl: 38, ul: 14 },
  { t: '12:00', dl: 45, ul: 18 }, { t: '14:00', dl: 42, ul: 16 },
  { t: '16:00', dl: 48, ul: 19 }, { t: '18:00', dl: 52, ul: 21 },
  { t: '20:00', dl: 44, ul: 17 }, { t: '22:00', dl: 30, ul: 11 },
];
const FIBER_DATA = [
  { name: 'Active', value: 124, color: '#22c55e' },
  { name: 'In Use', value: 38,  color: '#3b82f6' },
  { name: 'Spare',  value: 18,  color: '#f59e0b' },
  { name: 'Faulty', value: 6,   color: '#ef4444' },
];
const FIBER_TOTAL = 186;

/* ── SVG topology — node positions in 580 × 320 viewBox ─────────────── */
const OLT_POS: Record<string, { x: number; y: number }> = {
  'olt-01': { x: 430, y: 62 },   // Data Center Alpha
  'olt-06': { x: 465, y: 86 },   // Data Center Alpha
  'olt-02': { x: 250, y: 42 },   // North Hub
  'olt-09': { x: 302, y: 52 },   // North Hub
  'olt-03': { x: 250, y: 278 },  // South Node
  'olt-10': { x: 304, y: 288 },  // South Node
  'olt-04': { x: 494, y: 138 },  // East Hub
  'olt-11': { x: 502, y: 172 },  // East Hub
  'olt-05': { x: 374, y: 92 },   // West Node (East-01)
  'olt-07': { x: 102, y: 68 },   // Metro Exchange
  'olt-08': { x: 112, y: 248 },  // Suburban Hub 1
};
const CORE = { x: 290, y: 165 };
/* ONU satellite dot offsets around each OLT */
const ONU_OFF = [[24, -20], [35, 2], [22, 24], [-24, 22], [-30, 2]] as const;

/* Cluster label positions (separate from OLT nodes) */
const CLUSTER_LABELS = [
  { label: 'Data Center α', x: 448, y: 44 },
  { label: 'North Hub',     x: 276, y: 26 },
  { label: 'South Node',    x: 276, y: 308 },
  { label: 'East Hub',      x: 498, y: 118 },
  { label: 'Metro Exch.',   x: 102, y: 50 },
  { label: 'Sub Hub 1',     x: 112, y: 232 },
];

/* ── Alarm severity map ──────────────────────────────────────────────── */
const SEV = {
  Critical: { dot: 'bg-red-500',   border: 'border-l-red-500',   badge: 'bg-red-500/10 text-red-400 border-red-500/30',     iconBg: 'bg-red-500/10',   iconColor: 'text-red-500',   glowBar: 'bg-red-500',   pulse: true  },
  Major:    { dot: 'bg-amber-500', border: 'border-l-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500', glowBar: 'bg-amber-500', pulse: false },
  Minor:    { dot: 'bg-blue-500',  border: 'border-l-blue-500',  badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',   iconBg: 'bg-blue-500/10',  iconColor: 'text-blue-500',  glowBar: 'bg-blue-500',  pulse: false },
  Info:     { dot: 'bg-slate-400', border: 'border-l-slate-400', badge: 'bg-slate-500/10 text-slate-400 border-slate-500/30', iconBg: 'bg-slate-500/10', iconColor: 'text-slate-400', glowBar: 'bg-slate-400', pulse: false },
} as const;

const TT = {
  contentStyle: { backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '11px' },
  itemStyle:    { color: 'hsl(var(--foreground))' },
  labelStyle:   { color: 'hsl(var(--muted-foreground))', fontSize: '10px' },
};

/* ══════════════════════════════════════════════════════════════════════
   Legend dot helper
══════════════════════════════════════════════════════════════════════ */
function LegendDot({ color, glow, label }: { color: string; glow?: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400">
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ background: color, boxShadow: glow ? `0 0 7px 1px ${color}` : 'none' }}
      />
      {label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SVG Network Topology  ─  premium ISP/NOC map
   • Always dark background (NOC standard — readable in both themes)
   • Radial-gradient filled nodes with specular highlights
   • Per-status glow filters: green / amber / red / blue
   • "Dhaka Core" centre label
══════════════════════════════════════════════════════════════════════ */
function NetworkTopology() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-b-xl"
      style={{
        height: 340,
        /* fixed NOC dark background — identical in light & dark themes */
        background: 'linear-gradient(160deg, #07111f 0%, #0b1a2e 45%, #091522 70%, #080e1c 100%)',
      }}
    >
      {/* Central blue radial atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 46% 54% at 50% 52%, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0.04) 48%, transparent 72%)',
        }}
      />

      {/* Subtle dot-grid background texture */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.14 }}
        aria-hidden="true"
      >
        <defs>
          <pattern id="nm-dots" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.85" fill="#94a3b8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#nm-dots)" />
      </svg>

      {/* ── Main topology SVG ─────────────────────────────────────────── */}
      <svg
        viewBox="0 0 580 340"
        className="relative w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* ── Glow filters (cheap: single blur + merge) ── */}
          <filter id="nm-fg" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="5.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="nm-fa" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="nm-fr" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="nm-fb" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="nm-fc" x="-110%" y="-110%" width="320%" height="320%">
            <feGaussianBlur stdDeviation="11" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* ── Radial gradients for node fills ── */}
          <radialGradient id="nm-rg-core" cx="38%" cy="32%" r="68%">
            <stop offset="0%"   stopColor="#bfdbfe" />
            <stop offset="55%"  stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </radialGradient>
          <radialGradient id="nm-rg-green" cx="38%" cy="32%" r="68%">
            <stop offset="0%"   stopColor="#bbf7d0" />
            <stop offset="55%"  stopColor="#22c55e" />
            <stop offset="100%" stopColor="#14532d" />
          </radialGradient>
          <radialGradient id="nm-rg-amber" cx="38%" cy="32%" r="68%">
            <stop offset="0%"   stopColor="#fef08a" />
            <stop offset="55%"  stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#78350f" />
          </radialGradient>
          <radialGradient id="nm-rg-red" cx="38%" cy="32%" r="68%">
            <stop offset="0%"   stopColor="#fecaca" />
            <stop offset="55%"  stopColor="#ef4444" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </radialGradient>
        </defs>

        {/* ── Concentric range rings around core ── */}
        <circle cx={CORE.x} cy={CORE.y} r={52}  fill="none" stroke="rgba(59,130,246,0.1)"  strokeWidth={0.9} />
        <circle cx={CORE.x} cy={CORE.y} r={92}  fill="none" stroke="rgba(59,130,246,0.065)" strokeWidth={0.75} strokeDasharray="5 8" />
        <circle cx={CORE.x} cy={CORE.y} r={140} fill="none" stroke="rgba(59,130,246,0.04)"  strokeWidth={0.6} strokeDasharray="3 10" />
        <circle cx={CORE.x} cy={CORE.y} r={195} fill="none" stroke="rgba(59,130,246,0.025)" strokeWidth={0.5} strokeDasharray="2 12" />

        {/* ── Connection lines: Core → OLT ── */}
        {olts.map(olt => {
          const pos = OLT_POS[olt.id];
          if (!pos) return null;
          const online   = olt.status === 'Online';
          const degraded = olt.status === 'Degraded';
          const color    = online ? '#22c55e' : degraded ? '#f59e0b' : '#ef4444';
          return (
            <line
              key={`nm-ln-${olt.id}`}
              x1={CORE.x} y1={CORE.y}
              x2={pos.x}  y2={pos.y}
              stroke={color}
              strokeWidth={online ? 1.8 : degraded ? 1.4 : 0.8}
              strokeOpacity={online ? 0.52 : degraded ? 0.40 : 0.18}
              strokeDasharray={olt.status === 'Offline' ? '6 6' : undefined}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── ONU satellite dots ── */}
        {olts
          .filter(o => o.status !== 'Offline')
          .flatMap(olt => {
            const pos = OLT_POS[olt.id];
            if (!pos) return [];
            const count = Math.min(5, Math.max(2, Math.round(olt.activeOnus / 100)));
            return ONU_OFF.slice(0, count).map(([dx, dy], j) => (
              <g key={`nm-onu-${olt.id}-${j}`} filter="url(#nm-fb)">
                <line
                  x1={pos.x} y1={pos.y}
                  x2={pos.x + dx} y2={pos.y + dy}
                  stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.28"
                />
                {/* ONU dot: glow halo + filled circle */}
                <circle cx={pos.x + dx} cy={pos.y + dy} r={6}   fill="#3b82f6" fillOpacity={0.12} />
                <circle cx={pos.x + dx} cy={pos.y + dy} r={4}   fill="#3b82f6" fillOpacity={0.85} />
                <circle cx={pos.x + dx - 1} cy={pos.y + dy - 1} r={1.2} fill="rgba(255,255,255,0.35)" />
              </g>
            ));
          })}

        {/* ── OLT nodes ── */}
        {olts.map(olt => {
          const pos = OLT_POS[olt.id];
          if (!pos) return null;
          const online   = olt.status === 'Online';
          const degraded = olt.status === 'Degraded';
          const color    = online ? '#22c55e' : degraded ? '#f59e0b' : '#ef4444';
          const filt     = online ? 'nm-fg' : degraded ? 'nm-fa' : 'nm-fr';
          const grad     = online ? 'url(#nm-rg-green)' : degraded ? 'url(#nm-rg-amber)' : 'url(#nm-rg-red)';
          const txtFill  = online ? '#86efac' : degraded ? '#fde68a' : '#fca5a5';
          const label    = olt.name.replace('OLT-', '');
          const above    = pos.y < CORE.y;
          return (
            <g key={`nm-olt-${olt.id}`}>
              {/* Halo rings */}
              <circle cx={pos.x} cy={pos.y} r={20} fill={color} fillOpacity={0.05} />
              <circle cx={pos.x} cy={pos.y} r={13} fill={color} fillOpacity={0.11} />
              {/* Glowing filled node */}
              <g filter={`url(#${filt})`}>
                <circle cx={pos.x} cy={pos.y} r={9}  fill={grad} />
                <circle cx={pos.x} cy={pos.y} r={9}  fill="none" stroke={color} strokeWidth="0.9" strokeOpacity="0.55" />
              </g>
              {/* Specular highlight */}
              <circle cx={pos.x - 2.8} cy={pos.y - 3} r={2.5} fill="rgba(255,255,255,0.22)" />
              {/* Label */}
              <text
                x={pos.x}
                y={pos.y + (above ? -22 : 26)}
                textAnchor="middle"
                fill={txtFill}
                fontSize="8.5"
                fontWeight="600"
                letterSpacing="0.4"
                style={{ pointerEvents: 'none', fontFamily: 'ui-monospace, monospace' }}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* ── Cluster region labels ── */}
        {CLUSTER_LABELS.map(cl => (
          <text
            key={cl.label}
            x={cl.x}
            y={cl.y}
            textAnchor="middle"
            fill="rgba(148,163,184,0.38)"
            fontSize="7"
            fontWeight="500"
            letterSpacing="1.2"
            style={{ pointerEvents: 'none' }}
          >
            {cl.label.toUpperCase()}
          </text>
        ))}

        {/* ── Core node — rendered last (on top of all lines/ONUs) ── */}
        <g filter="url(#nm-fc)">
          <circle cx={CORE.x} cy={CORE.y} r={44} fill="rgba(59,130,246,0.08)" />
          <circle cx={CORE.x} cy={CORE.y} r={30} fill="rgba(59,130,246,0.18)" />
          <circle cx={CORE.x} cy={CORE.y} r={18} fill="url(#nm-rg-core)" />
          <circle cx={CORE.x} cy={CORE.y} r={18} fill="none" stroke="rgba(147,197,253,0.55)" strokeWidth="1.3" />
        </g>
        {/* Specular highlight on core */}
        <circle cx={CORE.x - 5} cy={CORE.y - 6} r={5.5} fill="rgba(255,255,255,0.2)" />
        {/* "Dhaka Core" text */}
        <text
          x={CORE.x}
          y={CORE.y + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize="8.5"
          fontWeight="800"
          letterSpacing="0.5"
          style={{ pointerEvents: 'none' }}
        >
          Dhaka Core
        </text>
        {/* "Network Core" subtitle below node */}
        <text
          x={CORE.x}
          y={CORE.y + 50}
          textAnchor="middle"
          fill="rgba(147,197,253,0.55)"
          fontSize="7.5"
          fontWeight="500"
          letterSpacing="0.8"
          style={{ pointerEvents: 'none' }}
        >
          NETWORK CORE
        </text>
      </svg>

      {/* ── Legend ── */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-lg border border-white/10 bg-black/45 backdrop-blur-md px-3 py-1.5">
        <LegendDot color="#22c55e" glow  label="OLT Online" />
        <LegendDot color="#3b82f6"       label="ONU" />
        <LegendDot color="#f59e0b"       label="Warning" />
        <LegendDot color="#ef4444"       label="Offline" />
      </div>

      {/* ── Zoom controls ── */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        {(['Zoom in', '+'] as const).map((_, i) => (
          <button
            key={i}
            aria-label={i === 0 ? 'Zoom in' : 'Zoom out'}
            className="h-8 w-8 rounded-lg border border-white/10 bg-black/45 backdrop-blur-md text-slate-300 hover:text-white hover:bg-white/12 flex items-center justify-center text-base font-bold transition-all"
          >
            {i === 0 ? '+' : '−'}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Reusable Donut Card
══════════════════════════════════════════════════════════════════════ */
interface DonutSegment { name: string; value: number; color: string }
interface DonutCardProps {
  title: string; desc: string;
  data: DonutSegment[]; centerVal: string; centerSub: string; total: number;
}
function DonutCard({ title, desc, data, centerVal, centerSub, total }: DonutCardProps) {
  return (
    <Card className="border-border/60 shadow-sm flex flex-col h-full">
      <CardHeader className="pb-2 border-b border-border/50 py-3 px-4 shrink-0">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">{desc}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={27} outerRadius={42} dataKey="value" strokeWidth={0}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm font-bold leading-none">{centerVal}</span>
              <span className="text-[9px] text-muted-foreground text-center leading-tight mt-0.5 whitespace-pre-line">{centerSub}</span>
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
                    <div className="flex items-center gap-1 shrink-0 ml-1">
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

/* ══════════════════════════════════════════════════════════════════════
   DASHBOARD PAGE
══════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const {
    totalOlts, totalOnus, onlineOnus, offlineOnus,
    offlineOlts, activeAlarms, criticalAlarms, networkUptime,
  } = metrics;

  const onlineOlts   = olts.filter(o => o.status === 'Online').length;
  const degradedOlts = olts.filter(o => o.status === 'Degraded').length;
  const degradedOnus = onus.filter(o => o.status === 'Degraded').length;
  const majorAlarms  = alarms.filter(a => !a.acknowledged && a.severity === 'Major').length;

  const healthyOlts = olts.filter(o => o.status === 'Online' && o.cpu < 80 && o.memory < 80).length;
  const warningOlts = olts.filter(o => o.status === 'Degraded' || (o.status === 'Online' && (o.cpu >= 80 || o.memory >= 80))).length;
  const healthPct   = Math.round((healthyOlts / totalOlts) * 100);

  const deviceData = [
    { name: 'Healthy Devices', value: healthyOlts, color: '#22c55e' },
    { name: 'Warning Devices', value: warningOlts,  color: '#f59e0b' },
    { name: 'Offline Devices', value: offlineOlts,  color: '#ef4444' },
  ];
  const onuData = [
    { name: 'Online',   value: onlineOnus,  color: '#22c55e' },
    { name: 'Degraded', value: degradedOnus, color: '#f59e0b' },
    { name: 'Offline',  value: offlineOnus,  color: '#ef4444' },
  ];

  /* Sort alarms newest first, show all unacknowledged + some acknowledged */
  const recentAlarms = [...alarms]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  const oltBar = [...olts]
    .filter(o => o.activeOnus > 0)
    .sort((a, b) => b.activeOnus - a.activeOnus)
    .slice(0, 6)
    .map(o => ({ name: o.name.replace('OLT-', ''), onus: o.activeOnus }));

  const topClients = [...onus]
    .filter(o => o.status === 'Online')
    .sort((a, b) => b.signalLevel - a.signalLevel)
    .slice(0, 7);

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4 pb-6">

      {/* 1 ── Page header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Real-time network monitoring and management</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <RefreshCw className="h-3 w-3 shrink-0" /> Refresh
          </button>
        </div>
      </div>

      {/* 2 ── KPI cards — all equal height via h-full grid ────────────── */}
      {/* Order: Total OLTs · Total ONUs · Total Clients ·
                 Offline OLTs · Offline ONUs · Active Alarms · Uptime     */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 items-stretch">
        <MetricCard title="Total OLTs"    value={totalOlts}    icon={Server}        accentColor="cyan"  description={`${onlineOlts} online · ${degradedOlts} degraded`}   href="/olts"   />
        <MetricCard title="Total ONUs"    value={totalOnus}    icon={Cpu}           accentColor="cyan"  description={`${onlineOnus} active connections`}                   href="/onus"   />
        <MetricCard title="Total Clients" value={totalOnus}    icon={Users}         accentColor="cyan"  description="Subscriber premises"                                  href="/onus"   />
        <MetricCard title="Offline OLTs"  value={offlineOlts}  icon={ServerCrash}   accentColor={offlineOlts  > 0 ? 'red' : 'green'} alert={offlineOlts  > 0} description={offlineOlts  > 0 ? 'Require immediate action' : 'All OLTs online'}  href="/olts"   />
        <MetricCard title="Offline ONUs"  value={offlineOnus}  icon={WifiOff}       accentColor={offlineOnus  > 0 ? 'red' : 'green'} alert={offlineOnus  > 0} description={offlineOnus  > 0 ? 'Disconnected premises'   : 'All ONUs online'}   href="/onus"   />
        <MetricCard title="Active Alarms" value={activeAlarms} icon={AlertTriangle} accentColor={criticalAlarms > 0 ? 'red' : 'amber'} alert={activeAlarms > 0} pulse={criticalAlarms > 0} description={`${criticalAlarms} critical · ${majorAlarms} major`} href="/alarms" />
        <MetricCard title="Uptime"        value={`${networkUptime}%`} icon={Shield} accentColor="green" description="Network SLA target" />
      </div>

      {/* 3 ── Network Map + Fiber Overview + Device Health ─────────────── */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-12">

        {/* Network Map — SVG topology */}
        <Card className="xl:col-span-7 border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-sm font-semibold">Network Map</CardTitle>
                <CardDescription className="text-xs">{olts.length} OLT nodes · live topology view</CardDescription>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="px-2 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-green-400 text-[10px] font-semibold">{onlineOlts} Online</span>
                <span className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-semibold">{degradedOlts} Warning</span>
                <span className="px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-semibold">{offlineOlts} Offline</span>
              </div>
            </div>
          </CardHeader>
          <NetworkTopology />
        </Card>

        {/* Fiber Overview + Device Health — stacked in right column */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          <DonutCard
            title="Fiber Overview"
            desc="Total fiber core usage — 186 cores"
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

      {/* 4 ── Top OLT by Bandwidth + System Info ───────────────────────── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">

        {/* Top OLT by Bandwidth */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 border-b border-border/50 py-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Top OLT by Bandwidth</CardTitle>
                <CardDescription className="text-xs">Active subscribers per OLT node</CardDescription>
              </div>
              <Link href="/olts" className="text-[11px] font-medium text-primary hover:underline">All →</Link>
            </div>
          </CardHeader>
          <CardContent className="h-[190px] pt-3 pr-2 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={oltBar} layout="vertical" margin={{ top: 0, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={65} />
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
          <CardContent className="p-4 space-y-2">
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
            <div className="pt-1.5 border-t border-border/50">
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

      {/* 5 ── Bottom row: Bandwidth · ONU Status · Top Clients ──────────── */}
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

        {/* ONU Status donut */}
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
                const good  = o.signalLevel > -22;
                const warn  = !good && o.signalLevel > -25;
                const sigC  = good ? 'text-green-400' : warn ? 'text-cyan-400' : 'text-amber-400';
                const barC  = good ? 'bg-green-500'  : warn ? 'bg-cyan-500'  : 'bg-amber-500';
                const barW  = Math.max(15, Math.min(100, ((o.signalLevel + 40) / 25) * 100));
                return (
                  <Link key={o.id} href={`/onus/${o.id}`}>
                    <div className="px-3 py-2.5 flex items-center gap-2.5 hover:bg-muted/20 transition-colors cursor-pointer">
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

      {/* 6 ── Recent Alarms — full-width, premium card rows ───────────────── */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="py-3 border-b border-border/50 bg-muted/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Recent Alarms</CardTitle>
              <CardDescription className="text-xs">
                {activeAlarms} unacknowledged · latest first · click any row to view device
              </CardDescription>
            </div>
            <Link href="/alarms" className="text-[11px] font-medium text-primary hover:underline shrink-0">
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 space-y-2">
          {recentAlarms.map(alarm => {
            const sev     = SEV[alarm.severity];
            const isOlt   = alarm.deviceId.startsWith('olt-');
            const isOnu   = alarm.deviceId.startsWith('onu-');
            const href    = isOlt ? `/olts/${alarm.deviceId}` : isOnu ? `/onus/${alarm.deviceId}` : '/alarms';
            const SevIcon = alarm.severity === 'Critical' || alarm.severity === 'Major'
              ? AlertTriangle : alarm.severity === 'Minor' ? AlertCircle : InfoIcon;
            const deviceType    = isOlt ? 'OLT' : isOnu ? 'ONU' : 'SYS';
            const deviceTypeCls = isOlt
              ? 'bg-violet-500/15 text-violet-400 border-violet-500/40'
              : isOnu
              ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40'
              : 'bg-slate-500/15 text-slate-400 border-slate-500/40';

            return (
              <Link key={alarm.id} href={href} className="group block">
                <div className={[
                  'relative flex items-center gap-3 sm:gap-4 px-4 py-3.5 rounded-lg overflow-hidden',
                  'border border-border/50 border-l-[3px]', sev.border,
                  'bg-card',
                  'hover:bg-muted/50 hover:-translate-y-px hover:shadow-[0_4px_16px_0_rgb(0_0_0/0.12)] hover:border-border/80',
                  'active:translate-y-0 active:shadow-none active:bg-muted/60',
                  'transition-all duration-150 cursor-pointer',
                  alarm.acknowledged ? 'opacity-60' : '',
                ].join(' ')}>

                  {/* Left-edge glow — blurred bar that brightens on hover */}
                  <div className={`absolute left-0 inset-y-0 w-[3px] ${sev.glowBar} opacity-0 group-hover:opacity-70 blur-[3px] transition-opacity duration-150`} />

                  {/* Severity icon */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${sev.iconBg}`}>
                    <SevIcon className={`h-[18px] w-[18px] ${sev.iconColor}${!alarm.acknowledged && alarm.severity === 'Critical' ? ' animate-pulse' : ''}`} />
                  </div>

                  {/* Device name + type badge + description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[13px] font-semibold leading-none ${alarm.acknowledged ? 'text-foreground/65' : 'text-foreground'}`}>
                        {alarm.deviceName}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-[2px] rounded border text-[9px] font-bold tracking-wide ${deviceTypeCls}`}>
                        {deviceType}
                      </span>
                      {alarm.acknowledged && (
                        <span className="text-[9px] text-muted-foreground/45 italic">acknowledged</span>
                      )}
                    </div>
                    <p className={`text-[11px] mt-1 leading-snug line-clamp-1 ${alarm.acknowledged ? 'text-muted-foreground/45' : 'text-muted-foreground'}`}>
                      {alarm.description}
                    </p>
                  </div>

                  {/* Severity badge */}
                  <span className={`hidden sm:inline-flex shrink-0 items-center justify-center px-2.5 py-[3px] rounded-md text-[9px] font-bold border ${sev.badge}`}>
                    {alarm.severity}
                  </span>

                  {/* Time (fades out) + "Open details →" (fades in) on hover */}
                  <div className="hidden sm:block relative shrink-0 w-32 text-right">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap group-hover:opacity-0 transition-opacity duration-100">
                      {formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true })}
                    </span>
                    <span className="absolute inset-0 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-primary font-semibold text-[11px] whitespace-nowrap">
                      Open details <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    </span>
                  </div>

                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
