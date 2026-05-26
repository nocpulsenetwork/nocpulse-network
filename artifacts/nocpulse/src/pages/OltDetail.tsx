import { useRoute, useLocation, Link } from 'wouter';
import { olts, onus, alarms } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft, RefreshCw, Settings, Server, Cpu, MemoryStick, Thermometer,
  Wifi, WifiOff, Activity, ChevronRight, AlertTriangle, Signal, Clock,
  Zap, XCircle, Info, ArrowUp, ArrowDown, Network,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AlarmRow } from '@/components/AlarmRow';

// ─── Circular SVG gauge ───────────────────────────────────────────────────────
function Gauge({ value, max = 100, label, unit = '%', colorClass }: {
  value: number; max?: number; label: string; unit?: string; colorClass: string;
}) {
  const pct   = Math.min(100, Math.max(0, (value / max) * 100));
  const r     = 28;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * (pct / 100);
  const gap   = circ - dash;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 72 72" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="6"
            className="stroke-muted/30" />
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            className={colorClass}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold font-mono leading-none ${colorClass.replace('stroke-', 'text-')}`}>
            {value === 0 && label !== 'Temp' ? '—' : `${value}${unit}`}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ─── Uplink status badge ──────────────────────────────────────────────────────
function UplinkBadge({ status }: { status: 'Active' | 'Standby' | 'Down' }) {
  const cfg = {
    Active:  { cls: 'bg-green-500/10 text-green-400 border-green-500/20',  dot: 'bg-green-400 animate-pulse' },
    Standby: { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',  dot: 'bg-amber-400' },
    Down:    { cls: 'bg-red-500/10   text-red-400   border-red-500/20',    dot: 'bg-red-400' },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OltDetail() {
  const [, params]   = useRoute('/olts/:id');
  const [, navigate] = useLocation();
  const olt = olts.find(o => o.id === params?.id);

  if (!olt) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <Server className="h-10 w-10 opacity-20" />
      <p className="text-base font-medium">OLT not found</p>
    </div>
  );

  const connectedOnus       = onus.filter(o => o.oltId === olt.id);
  const onlineOnus          = connectedOnus.filter(o => o.status === 'Online');
  const offlineOnus         = connectedOnus.filter(o => o.status !== 'Online');
  const degradedOnus        = connectedOnus.filter(o => o.status === 'Degraded');
  const oltAlarms           = alarms.filter(a => a.deviceId === olt.id || a.deviceName === olt.name || a.deviceName.includes(olt.name));
  const unackedAlarms       = oltAlarms.filter(a => !a.acknowledged);
  const criticalAlarms      = unackedAlarms.filter(a => a.severity === 'Critical');
  const majorAlarms         = unackedAlarms.filter(a => a.severity === 'Major');
  const minorAlarms         = unackedAlarms.filter(a => a.severity === 'Minor');

  const goodSignalOnus  = connectedOnus.filter(o => o.status === 'Online' && o.signalLevel > -25);
  const warnSignalOnus  = connectedOnus.filter(o => o.status === 'Online' && o.signalLevel <= -25 && o.signalLevel > -28);
  const poorSignalOnus  = connectedOnus.filter(o => o.status === 'Online' && o.signalLevel <= -28);
  const totalOnlineForHealth = onlineOnus.length || 1;

  const onlinePct = connectedOnus.length > 0 ? Math.round((onlineOnus.length / connectedOnus.length) * 100) : 0;

  const ponPorts = Array.from({ length: olt.ponPortCount }, (_, i) => {
    const portOnus    = connectedOnus.filter(o => o.ponPort === `PON-${i + 1}`);
    const onlineCount = portOnus.filter(o => o.status === 'Online').length;
    const offlineCount = portOnus.filter(o => o.status !== 'Online').length;
    return {
      id: i + 1,
      name: `PON-${i + 1}`,
      total: portOnus.length,
      online: onlineCount,
      offline: offlineCount,
      status: offlineCount > 0 ? 'Degraded' : portOnus.length > 0 ? 'Active' : 'Idle' as string,
      avgRx: portOnus.length > 0
        ? (portOnus.reduce((s, o) => s + o.signalLevel, 0) / portOnus.length).toFixed(1)
        : '--',
    };
  });

  // Resource color helpers
  const getResColor = (val: number, isTemp: boolean) => {
    if (val === 0) return 'stroke-slate-500';
    if (isTemp) {
      if (val > 55) return 'stroke-red-400';
      if (val > 45) return 'stroke-amber-400';
      return 'stroke-green-400';
    }
    if (val > 80) return 'stroke-red-400';
    if (val > 60) return 'stroke-amber-400';
    return 'stroke-green-400';
  };

  const statusColor = {
    Online:   { border: 'border-green-500/30', dot: 'bg-green-400', text: 'text-green-400' },
    Offline:  { border: 'border-red-500/30',   dot: 'bg-red-400',   text: 'text-red-400' },
    Degraded: { border: 'border-amber-500/30', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400' },
  }[olt.status] ?? { border: 'border-border/60', dot: 'bg-muted', text: 'text-muted-foreground' };

  return (
    <div className="space-y-5 pb-10">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/olts" className="hover:text-foreground transition-colors">OLT Management</Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="text-foreground font-medium">{olt.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{olt.name}</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusColor.border} ${statusColor.text} bg-background`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusColor.dot}`} />
              {olt.status}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${olt.type === 'EPON' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
              {olt.type}
            </span>
            {olt.mode === 'BOTH' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-purple-500/10 text-purple-400 border-purple-500/20">XPON</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono text-xs bg-muted/50 border border-border/40 px-2 py-0.5 rounded">{olt.ip}</span>
            <span className="text-border">·</span>
            <span>{olt.location}</span>
            <span className="text-border">·</span>
            <span className="font-medium text-foreground/70">{olt.brand}</span>
            <span className="text-border">·</span>
            <span>Uptime: <span className="font-medium text-foreground/80">{olt.uptime}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigate('/olts')} className="gap-2 h-8">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <Button variant="outline" size="sm" disabled className="gap-2 h-8 opacity-50">
            <RefreshCw className="h-3.5 w-3.5" /> Reboot
          </Button>
          <Button variant="outline" size="sm" disabled className="gap-2 h-8 opacity-50">
            <Settings className="h-3.5 w-3.5" /> Config
          </Button>
        </div>
      </div>

      {/* ── ONU Count + Key Metric Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

        {/* Total ONUs */}
        <button
          onClick={() => navigate(`/onus?olt=${olt.id}`)}
          className="rounded-xl border border-border/60 bg-card/80 p-3.5 text-left hover:border-primary/40 hover:bg-primary/[0.04] transition-colors group space-y-2.5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total ONUs</span>
            <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Activity className="h-3 w-3 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">{connectedOnus.length}</p>
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${onlinePct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{onlinePct}% online · view all</p>
          </div>
        </button>

        {/* Online */}
        <button
          onClick={() => navigate(`/onus?olt=${olt.id}&status=Online`)}
          className="rounded-xl border border-border/60 bg-card/80 p-3.5 text-left hover:border-green-500/40 hover:bg-green-500/[0.04] transition-colors group space-y-2.5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Online</span>
            <div className="p-1.5 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
              <Wifi className="h-3 w-3 text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-green-400">{onlineOnus.length}</p>
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: connectedOnus.length > 0 ? `${Math.round((onlineOnus.length / connectedOnus.length) * 100)}%` : '0%' }} />
            </div>
            <p className="text-[10px] text-muted-foreground group-hover:text-green-400/70 transition-colors">Active · filter</p>
          </div>
        </button>

        {/* Offline */}
        <button
          onClick={() => navigate(`/onus?olt=${olt.id}&status=Offline`)}
          className={`rounded-xl border border-border/60 bg-card/80 p-3.5 text-left transition-colors group space-y-2.5 shadow-sm ${offlineOnus.length > 0 ? 'hover:border-red-500/40 hover:bg-red-500/[0.04]' : 'hover:border-muted/50'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Offline</span>
            <div className={`p-1.5 rounded-lg transition-colors ${offlineOnus.length > 0 ? 'bg-red-500/10 group-hover:bg-red-500/20' : 'bg-muted/30'}`}>
              <WifiOff className={`h-3 w-3 ${offlineOnus.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${offlineOnus.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{offlineOnus.length}</p>
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: connectedOnus.length > 0 ? `${Math.round((offlineOnus.length / connectedOnus.length) * 100)}%` : '0%' }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{offlineOnus.length > 0 ? 'Needs attention' : 'All nominal'}</p>
          </div>
        </button>

        {/* Degraded */}
        <button
          onClick={() => navigate(`/onus?olt=${olt.id}&status=Degraded`)}
          className={`rounded-xl border border-border/60 bg-card/80 p-3.5 text-left transition-colors group space-y-2.5 shadow-sm ${degradedOnus.length > 0 ? 'hover:border-amber-500/40 hover:bg-amber-500/[0.04]' : 'hover:border-muted/50'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Degraded</span>
            <div className={`p-1.5 rounded-lg transition-colors ${degradedOnus.length > 0 ? 'bg-amber-500/10 group-hover:bg-amber-500/20' : 'bg-muted/30'}`}>
              <AlertTriangle className={`h-3 w-3 ${degradedOnus.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${degradedOnus.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{degradedOnus.length}</p>
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: connectedOnus.length > 0 ? `${Math.round((degradedOnus.length / connectedOnus.length) * 100)}%` : '0%' }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{degradedOnus.length > 0 ? 'Signal issues' : 'All clean'}</p>
          </div>
        </button>

        {/* Active Alarms */}
        <button
          onClick={() => navigate('/alarms')}
          className={`rounded-xl border border-border/60 bg-card/80 p-3.5 text-left transition-colors group space-y-2.5 shadow-sm ${unackedAlarms.length > 0 ? 'hover:border-amber-500/40 hover:bg-amber-500/[0.04]' : 'hover:border-muted/50'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Alarms</span>
            <div className={`p-1.5 rounded-lg transition-colors ${unackedAlarms.length > 0 ? 'bg-amber-500/10 group-hover:bg-amber-500/20' : 'bg-muted/30'}`}>
              <AlertTriangle className={`h-3 w-3 ${unackedAlarms.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${unackedAlarms.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{unackedAlarms.length}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {criticalAlarms.length > 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-500/15 text-red-400">{criticalAlarms.length} Crit</span>}
            {majorAlarms.length > 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/15 text-amber-400">{majorAlarms.length} Maj</span>}
            {minorAlarms.length > 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-500/15 text-blue-400">{minorAlarms.length} Min</span>}
            {unackedAlarms.length === 0 && <span className="text-[10px] text-muted-foreground">All clear</span>}
          </div>
        </button>

        {/* Uptime */}
        <div className="rounded-xl border border-border/60 bg-card/80 p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Uptime</span>
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Clock className="h-3 w-3 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">{olt.uptime.split(' ')[0]}</p>
          <p className="text-[10px] text-muted-foreground">{olt.uptime} continuous</p>
        </div>
      </div>

      {/* ── System Resources + Uplink ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

        {/* CPU Gauge */}
        <div className={`rounded-xl border bg-card/80 p-4 shadow-sm space-y-1 ${olt.cpu > 80 ? 'border-red-500/30' : olt.cpu > 60 ? 'border-amber-500/30' : 'border-border/60'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">CPU Usage</span>
            {olt.cpu > 80 && <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">HIGH</span>}
          </div>
          <div className="flex items-center gap-4">
            <Gauge value={olt.cpu} label="CPU" colorClass={getResColor(olt.cpu, false)} />
            <div className="flex-1 space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Load</span>
                  <span className="font-mono font-bold">{olt.cpu === 0 ? '—' : `${olt.cpu}%`}</span>
                </div>
                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${olt.cpu > 80 ? 'bg-red-500' : olt.cpu > 60 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${olt.cpu}%` }} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">{olt.status === 'Offline' ? 'Device offline' : olt.cpu > 80 ? 'Critical load' : olt.cpu > 60 ? 'Elevated' : 'Normal'}</p>
            </div>
          </div>
        </div>

        {/* Memory Gauge */}
        <div className={`rounded-xl border bg-card/80 p-4 shadow-sm ${olt.memory > 80 ? 'border-red-500/30' : olt.memory > 60 ? 'border-amber-500/30' : 'border-border/60'}`}>
          <div className="flex items-center gap-2 mb-3">
            <MemoryStick className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Memory</span>
            {olt.memory > 80 && <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">HIGH</span>}
          </div>
          <div className="flex items-center gap-4">
            <Gauge value={olt.memory} label="RAM" colorClass={getResColor(olt.memory, false)} />
            <div className="flex-1 space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-mono font-bold">{olt.memory === 0 ? '—' : `${olt.memory}%`}</span>
                </div>
                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${olt.memory > 80 ? 'bg-red-500' : olt.memory > 60 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${olt.memory}%` }} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">{olt.status === 'Offline' ? 'Device offline' : olt.memory > 80 ? 'Near capacity' : olt.memory > 60 ? 'Moderate' : 'Healthy'}</p>
            </div>
          </div>
        </div>

        {/* Temperature Gauge */}
        <div className={`rounded-xl border bg-card/80 p-4 shadow-sm ${olt.temperature > 55 ? 'border-red-500/30' : olt.temperature > 45 ? 'border-amber-500/30' : 'border-border/60'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Temperature</span>
            {olt.temperature > 55 && <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">HOT</span>}
          </div>
          <div className="flex items-center gap-4">
            <Gauge value={olt.temperature} max={80} label="Temp" unit="°C" colorClass={getResColor(olt.temperature, true)} />
            <div className="flex-1 space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Celsius</span>
                  <span className="font-mono font-bold">{olt.temperature === 0 ? '—' : `${olt.temperature}°C`}</span>
                </div>
                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${olt.temperature > 55 ? 'bg-red-500' : olt.temperature > 45 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (olt.temperature / 80) * 100)}%` }} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">{olt.status === 'Offline' ? 'Device offline' : olt.temperature > 55 ? 'Overheating' : olt.temperature > 45 ? 'Warm' : 'Normal'}</p>
            </div>
          </div>
        </div>

        {/* Uplink Panel */}
        <div className={`rounded-xl border bg-card/80 p-4 shadow-sm ${olt.uplinkStatus === 'Down' ? 'border-red-500/30' : olt.uplinkStatus === 'Standby' ? 'border-amber-500/30' : 'border-border/60'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Network className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Uplink</span>
            <span className="ml-auto"><UplinkBadge status={olt.uplinkStatus} /></span>
          </div>

          {/* Visual uplink diagram */}
          <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-muted/20 border border-border/40">
            <div className="flex flex-col items-center gap-0.5">
              <ArrowUp className={`h-3 w-3 ${olt.uplinkStatus === 'Active' ? 'text-green-400' : 'text-muted-foreground/40'}`} />
              <ArrowDown className={`h-3 w-3 ${olt.uplinkStatus === 'Active' ? 'text-cyan-400' : 'text-muted-foreground/40'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold font-mono truncate">{olt.uplinkPort}</p>
              <p className="text-[9px] text-muted-foreground">10G Ethernet uplink</p>
            </div>
            <Zap className={`h-4 w-4 shrink-0 ${olt.uplinkStatus === 'Active' ? 'text-green-400' : olt.uplinkStatus === 'Standby' ? 'text-amber-400' : 'text-red-400'}`} />
          </div>

          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Last sync</span>
            <span className="font-medium">{formatDistanceToNow(new Date(olt.lastSync), { addSuffix: true })}</span>
          </div>
        </div>
      </div>

      {/* ── Signal Health Summary ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Signal className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Signal Health</span>
          </div>
          <span className="text-[11px] text-muted-foreground">{onlineOnus.length} online ONUs</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Good Signal',    sub: '> −25 dBm',       count: goodSignalOnus.length, color: 'text-green-400', bar: 'bg-green-500', border: 'border-green-500/20', bg: 'bg-green-500/5' },
            { label: 'Warning Signal', sub: '−25 to −28 dBm',  count: warnSignalOnus.length, color: 'text-amber-400', bar: 'bg-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
            { label: 'Poor Signal',    sub: '< −28 dBm',       count: poorSignalOnus.length, color: 'text-red-400',   bar: 'bg-red-500',   border: 'border-red-500/20',   bg: 'bg-red-500/5' },
          ].map(s => {
            const pct = Math.round((s.count / totalOnlineForHealth) * 100);
            return (
              <div key={s.label} className={`rounded-lg border ${s.border} ${s.bg} p-3 space-y-2`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-semibold ${s.color}`}>{s.label}</p>
                    <p className="text-[10px] text-muted-foreground">{s.sub}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold font-mono ${s.color}`}>{s.count}</p>
                    <p className="text-[10px] text-muted-foreground">{pct}%</p>
                  </div>
                </div>
                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
            <div className="bg-green-500 h-full" style={{ width: `${Math.round((goodSignalOnus.length / totalOnlineForHealth) * 100)}%` }} />
            <div className="bg-amber-500 h-full" style={{ width: `${Math.round((warnSignalOnus.length / totalOnlineForHealth) * 100)}%` }} />
            <div className="bg-red-500 h-full" style={{ width: `${Math.round((poorSignalOnus.length / totalOnlineForHealth) * 100)}%` }} />
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Good ({Math.round((goodSignalOnus.length / totalOnlineForHealth) * 100)}%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Warning ({Math.round((warnSignalOnus.length / totalOnlineForHealth) * 100)}%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Poor ({Math.round((poorSignalOnus.length / totalOnlineForHealth) * 100)}%)</span>
          </div>
        </div>
      </div>

      {/* ── PON Ports + Alarms sidebar ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* PON Ports */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-xl border border-border/60 bg-card/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">PON Port Status</span>
              </div>
              <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded bg-muted/40 border border-border/40">{olt.ponPortCount} ports</span>
            </div>

            {/* Visual port grid */}
            <div className="p-4 border-b border-border/40 bg-muted/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Port Map</p>
              <div className="flex flex-wrap gap-2">
                {ponPorts.map(port => (
                  <button
                    key={port.id}
                    onClick={() => navigate(`/onus?olt=${olt.id}&pon=PON-${port.id}`)}
                    title={`${port.name}: ${port.online} online, ${port.offline} offline`}
                    className={`relative flex flex-col items-center justify-center h-14 w-14 rounded-lg border-2 transition-all hover:scale-105 text-center cursor-pointer ${
                      port.status === 'Active'   ? 'border-green-500/50 bg-green-500/10 hover:border-green-500' :
                      port.status === 'Degraded' ? 'border-amber-500/50 bg-amber-500/10 hover:border-amber-500' :
                      'border-slate-500/20 bg-muted/20 hover:border-slate-500/40'
                    }`}
                  >
                    <span className={`text-[9px] font-bold uppercase ${
                      port.status === 'Active'   ? 'text-green-400' :
                      port.status === 'Degraded' ? 'text-amber-400' :
                      'text-slate-500'
                    }`}>{port.name}</span>
                    <span className="text-[8px] text-muted-foreground mt-0.5">{port.total > 0 ? `${port.online}/${port.total}` : 'idle'}</span>
                    {port.status === 'Active' && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-400 border border-card" />
                    )}
                    {port.status === 'Degraded' && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 border border-card animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-400" /> Active</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Degraded</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-500" /> Idle</span>
              </div>
            </div>

            {/* PON table */}
            <div className={`overflow-x-auto${olt.ponPortCount > 8 ? ' max-h-64 overflow-y-auto' : ''}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/50">
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 px-4">Port</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 px-4">Status</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 text-center text-muted-foreground">Total</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 text-center text-green-400">On</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 text-center text-red-400">Off</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 text-cyan-400">Avg RX</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 text-right px-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ponPorts.map(port => (
                    <TableRow key={port.id} className="hover:bg-muted/20 border-b border-border/30 transition-colors">
                      <TableCell className="font-mono text-xs py-3 px-4 font-bold">{port.name}</TableCell>
                      <TableCell className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                          port.status === 'Active'   ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          port.status === 'Degraded' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${port.status === 'Active' ? 'bg-green-400' : port.status === 'Degraded' ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
                          {port.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs py-3 text-center text-muted-foreground">{port.total}</TableCell>
                      <TableCell className="font-mono text-xs py-3 text-center text-green-400 font-semibold">{port.online}</TableCell>
                      <TableCell className={`font-mono text-xs py-3 text-center font-semibold ${port.offline > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{port.offline}</TableCell>
                      <TableCell className={`font-mono text-xs py-3 font-semibold ${port.total > 0 ? (parseFloat(port.avgRx) < -27 ? 'text-red-400' : parseFloat(port.avgRx) < -24 ? 'text-amber-400' : 'text-green-400') : 'text-muted-foreground'}`}>
                        {port.total > 0 ? `${port.avgRx} dBm` : '—'}
                      </TableCell>
                      <TableCell className="text-right py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/onus?olt=${olt.id}&pon=PON-${port.id}`)}
                          className="h-7 text-[11px] px-2.5 gap-1 text-muted-foreground hover:text-primary"
                        >
                          ONUs <ChevronRight className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Connected ONU mini-cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Connected ONUs <span className="text-muted-foreground font-normal">({connectedOnus.length})</span></span>
              <Button variant="ghost" size="sm" className="text-xs h-7 text-primary hover:text-primary gap-1" onClick={() => navigate(`/onus?olt=${olt.id}`)}>
                View All <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {connectedOnus.slice(0, 8).map(onu => (
                <button
                  key={onu.id}
                  onClick={() => navigate(`/onus/${onu.id}`)}
                  className="rounded-lg border border-border/60 bg-card/50 p-3 hover:bg-card hover:border-primary/30 cursor-pointer transition-colors text-left space-y-1.5 group"
                >
                  <div className="font-mono font-bold text-sm">{onu.onuNo}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{onu.description}</div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${onu.status === 'Online' ? 'text-green-400' : onu.status === 'Offline' ? 'text-red-400' : 'text-amber-400'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${onu.status === 'Online' ? 'bg-green-400' : onu.status === 'Offline' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'}`} />
                      {onu.status}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${onu.signalLevel < -27 ? 'text-red-400' : onu.signalLevel < -24 ? 'text-amber-400' : 'text-green-400'}`}>
                      {onu.signalLevel} dBm
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">

          {/* Alarm Summary */}
          <div className="rounded-xl border border-border/60 bg-card/80 shadow-sm overflow-hidden">
            <div className="p-3.5 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold">Active Alarms</span>
              </div>
              {unackedAlarms.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {unackedAlarms.length} active
                </span>
              )}
            </div>

            {unackedAlarms.length > 0 && (
              <div className="px-3.5 py-2.5 border-b border-border/40 bg-muted/10">
                <div className="flex items-center gap-2 flex-wrap">
                  {criticalAlarms.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border bg-red-500/10 text-red-400 border-red-500/20">
                      <XCircle className="h-2.5 w-2.5" /> {criticalAlarms.length} Critical
                    </span>
                  )}
                  {majorAlarms.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
                      <AlertTriangle className="h-2.5 w-2.5" /> {majorAlarms.length} Major
                    </span>
                  )}
                  {minorAlarms.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border bg-blue-500/10 text-blue-400 border-blue-500/20">
                      <Info className="h-2.5 w-2.5" /> {minorAlarms.length} Minor
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col divide-y divide-border/40">
              {unackedAlarms.length === 0 ? (
                <div className="p-6 flex flex-col items-center gap-2 text-center">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <Signal className="h-5 w-5 text-green-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">No active alarms for this OLT</p>
                </div>
              ) : (
                unackedAlarms.map(alarm => <AlarmRow key={alarm.id} alarm={alarm} />)
              )}
            </div>

            {oltAlarms.length > 0 && (
              <div className="px-3.5 py-2.5 border-t border-border/40 bg-muted/10">
                <button onClick={() => navigate('/alarms')} className="text-[11px] text-primary hover:underline underline-offset-2 font-medium flex items-center gap-1">
                  View all alarms <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Device Info Card */}
          <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Device Info</p>
            {[
              { label: 'Brand',      val: olt.brand },
              { label: 'Mode',       val: olt.mode },
              { label: 'Ports',      val: `${olt.portCount} total` },
              { label: 'PON Ports',  val: olt.ponPortCount },
              { label: 'Location',   val: olt.location },
              { label: 'Last Seen',  val: olt.lastSeen },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">{row.label}</span>
                <span className="text-xs font-medium">{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
