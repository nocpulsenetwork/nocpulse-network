import { useState, useEffect } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { useApiData } from '@/contexts/ApiDataContext';
import { type OltDevice } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  ArrowLeft, RefreshCw, Settings, Server, Cpu, MemoryStick, Thermometer,
  Wifi, WifiOff, Activity, ChevronRight, AlertTriangle, Signal, Clock,
  Zap, XCircle, Info, ArrowUp, ArrowDown, Network, MapPin, Tag,
  ExternalLink, LayoutList, Bell, Shield, CheckCircle2, ShieldCheck,
  ShieldX, Timer, Gauge as GaugeIcon, Loader2, ScanLine, Database,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { AlarmRow } from '@/components/AlarmRow';

// ─── Extended managed OLT record (OltDevice + verification fields) ───────────
const MANAGED_OLT_KEY = 'nocpulse-managed-olts';
interface ManagedOltRecord extends OltDevice {
  snmpVersion: string;
  snmpPort: number;
  community: string;
  verified: boolean;
  verificationStatus: 'verified' | 'unverified' | 'pending';
  lastTestTime: string | null;
  lastSuccessTime: string | null;
  systemName: string;
  latencyMs: number | null;
  isCustom: boolean;
}
function loadManagedOlt(id: string): ManagedOltRecord | null {
  try {
    const raw = localStorage.getItem(MANAGED_OLT_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as ManagedOltRecord[];
    return all.find((o) => o.id === id) ?? null;
  } catch { return null; }
}

// ─── Real ONU discovery result (mirrors backend OnuDiscoveryResult) ───────────
interface RealOnuData {
  hasData: true;
  oltId: string;
  totalOnus: number;
  onlineOnus: number;
  offlineOnus: number;
  unknownOnus: number;
  ponPortCount: number;
  ponPorts: Array<{ id: string; total: number; online: number; offline: number; unknown: number }>;
  onus: Array<{ onuId: string; ponPort: string; status: 'online' | 'offline' | 'unknown'; serial: string | null; type: string | null }>;
  discoveredAt: string;
  latencyMs: number;
  source: 'live-snmp';
  vendor: string;
  mibUsed: string;
  message: string;
  sysUpTimeSecs?: number | null;
  sysDescr?: string | null;
  sysName?: string | null;
}

/** Format seconds into a human-readable uptime string: "14d 3h 22m". */
function fmtUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

// ─── Circular SVG gauge ───────────────────────────────────────────────────────
function Gauge({ value, max = 100, label, unit = '%', colorClass }: {
  value: number; max?: number; label: string; unit?: string; colorClass: string;
}) {
  const pct  = Math.min(100, Math.max(0, (value / max) * 100));
  const r    = 28;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  const gap  = circ - dash;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 72 72" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="6" className="stroke-muted/30" />
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`} className={colorClass}
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
  const { olts, onus, alarms } = useApiData();
  const [, params]   = useRoute('/olts/:id');
  const [, navigate] = useLocation();

  // Load managed (localStorage) OLT data — contains verification fields not in API OLTs
  const [managed, setManaged] = useState<ManagedOltRecord | null>(null);

  // Real ONU discovery state — populated by POST /api/olts/discover-onus
  const [realOnus, setRealOnus]           = useState<RealOnuData | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    setManaged(loadManagedOlt(params.id));
    // Load any previously cached real ONU discovery result for this OLT
    fetch(`/api/olts/${encodeURIComponent(params.id)}/onus/real`)
      .then(r => r.json() as Promise<{ data?: { hasData?: boolean } }>)
      .then(j => { if (j.data?.hasData) setRealOnus(j.data as RealOnuData); })
      .catch(() => null);
  }, [params?.id]);

  async function handleDiscoverOnus() {
    if (!managed) return;
    setDiscoverLoading(true);
    setDiscoverError(null);
    try {
      const resp = await fetch('/api/olts/discover-onus', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          id:        managed.id,
          ip:        managed.ip,
          community: managed.community,
          port:      managed.snmpPort,
          vendor:    managed.brand,
        }),
      });
      const j = await resp.json() as { data?: RealOnuData; error?: string };
      if (!resp.ok || !j.data?.hasData) {
        setDiscoverError(j.error ?? 'Discovery failed — check OLT connectivity and SNMP credentials.');
      } else {
        setRealOnus(j.data);
      }
    } catch (e) {
      setDiscoverError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setDiscoverLoading(false);
    }
  }

  // Managed OLT is the source of truth; API OLT is the fallback
  const apiOlt = olts.find(o => o.id === params?.id);
  const olt: OltDevice | undefined = managed ?? apiOlt;

  if (!olt) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <Server className="h-10 w-10 opacity-20" />
      <p className="text-base font-medium">OLT not found</p>
    </div>
  );

  const connectedOnus  = onus.filter(o => o.oltId === olt.id);
  const onlineOnus     = connectedOnus.filter(o => o.status === 'Online');
  const offlineOnus    = connectedOnus.filter(o => o.status === 'Offline');
  const degradedOnus   = connectedOnus.filter(o => o.status === 'Degraded');
  // For real (managed) OLTs, we have no real alarm tracking — show 0 to avoid
  // false matches from mock/demo alarms belonging to other OLTs.
  const oltAlarms      = managed !== null ? [] : alarms.filter(a => a.deviceId === olt.id || a.deviceName === olt.name || a.deviceName.includes(olt.name));
  const unackedAlarms  = oltAlarms.filter(a => !a.acknowledged);
  const criticalAlarms = unackedAlarms.filter(a => a.severity === 'Critical');
  const majorAlarms    = unackedAlarms.filter(a => a.severity === 'Major');
  const minorAlarms    = unackedAlarms.filter(a => a.severity === 'Minor');

  const goodSignalOnus = connectedOnus.filter(o => o.status === 'Online' && o.signalLevel > -25);
  const warnSignalOnus = connectedOnus.filter(o => o.status === 'Online' && o.signalLevel <= -25 && o.signalLevel > -28);
  const poorSignalOnus = connectedOnus.filter(o => o.status === 'Online' && o.signalLevel <= -28);
  const totalOnlineForHealth = onlineOnus.length || 1;

  const onlinePct = connectedOnus.length > 0
    ? Math.round((onlineOnus.length / connectedOnus.length) * 100)
    : 0;

  // ── Real OLT display overrides ───────────────────────────────────────────
  // For managed (real) OLTs, display counts from live SNMP discovery when
  // available, or 0 when no discovery has been performed. Never show mock data.
  const isRealOlt        = managed !== null;
  const displayTotal     = isRealOlt ? (realOnus?.totalOnus   ?? 0) : connectedOnus.length;
  const displayOnline    = isRealOlt ? (realOnus?.onlineOnus  ?? 0) : onlineOnus.length;
  const displayOffline   = isRealOlt ? (realOnus?.offlineOnus ?? 0) : offlineOnus.length;
  const displayDegraded  = isRealOlt ? 0                            : degradedOnus.length;
  const displayOnlinePct = displayTotal > 0 ? Math.round((displayOnline / displayTotal) * 100) : 0;

  // PON port data: for real OLTs with discovery, use real port breakdown.
  // For demo OLTs, use the mock-derived ponPorts computed below.
  //
  // Port name rule: SNMP uses 0-indexed "port-N" identifiers; the UI must
  // show 1-indexed "PON-N" labels (port-0 → PON-1, port-1 → PON-2, …).
  //
  // Port count rule: prefer the configured ponPortCount (e.g. 8 for an 8-port
  // EPON); fall back to the count of unique discovered ports. This ensures all
  // physical ports are shown even when some carry 0 ONUs.
  const realPonPortsDisplay = isRealOlt && realOnus
    ? (() => {
        // Build a map from 1-based port number → discovery row
        const portDataMap = new Map<number, typeof realOnus.ponPorts[number]>();
        for (const p of realOnus.ponPorts) {
          const rawNum = parseInt(String(p.id).replace('port-', ''), 10);
          if (!isNaN(rawNum)) portDataMap.set(rawNum + 1, p);
        }
        // Number of ports to render: configured value wins; fall back to discovered unique count
        const totalPorts = olt.ponPortCount > 0 ? olt.ponPortCount : realOnus.ponPortCount;
        if (totalPorts === 0) return null;
        return Array.from({ length: totalPorts }, (_, idx) => {
          const portNum = idx + 1;
          const p       = portDataMap.get(portNum);
          const online  = p?.online  ?? 0;
          const offline = (p?.offline ?? 0) + (p?.unknown ?? 0);
          const total   = online + offline;
          return {
            id:       portNum,
            name:     `PON-${portNum}`,
            total,
            online,
            offline,
            degraded: 0,
            status:   (online > 0 ? 'Active' : total > 0 ? 'Degraded' : 'Idle') as 'Active' | 'Degraded' | 'Idle',
            avgRx:    '--',
          };
        });
      })()
    : null;

  const ponPorts = Array.from({ length: olt.ponPortCount }, (_, i) => {
    const portOnus     = connectedOnus.filter(o => o.ponPort === `PON-${i + 1}`);
    const onlineCount  = portOnus.filter(o => o.status === 'Online').length;
    const offlineCount = portOnus.filter(o => o.status === 'Offline').length;
    const degradedCount = portOnus.filter(o => o.status === 'Degraded').length;
    const portStatus   = degradedCount > 0 || offlineCount > 0
      ? 'Degraded'
      : portOnus.length > 0 ? 'Active' : 'Idle';
    return {
      id:       i + 1,
      name:     `PON-${i + 1}`,
      total:    portOnus.length,
      online:   onlineCount,
      offline:  offlineCount,
      degraded: degradedCount,
      status:   portStatus as 'Active' | 'Degraded' | 'Idle',
      avgRx:    portOnus.length > 0
        ? (portOnus.reduce((s, o) => s + o.signalLevel, 0) / portOnus.length).toFixed(1)
        : '--',
    };
  });

  // Chart data for ONU distribution
  const chartData = ponPorts
    .filter(p => p.total > 0 || olt.ponPortCount <= 8)
    .map(p => ({
      name:     p.name,
      Online:   p.online,
      Degraded: p.degraded,
      Offline:  p.offline,
    }));

  // For real OLTs: override ponPorts and chartData with real SNMP discovery data
  const displayPonPorts  = realPonPortsDisplay ?? ponPorts;
  const displayChartData = realPonPortsDisplay
    ? realPonPortsDisplay
        .filter(p => p.total > 0 || realPonPortsDisplay.length <= 8)
        .map(p => ({ name: p.name, Online: p.online, Degraded: 0, Offline: p.offline }))
    : chartData;
  // Show chart only when there's real data for real OLTs (or any mock data for demo OLTs)
  const hasDisplayData = isRealOlt ? (realOnus !== null && realPonPortsDisplay !== null) : connectedOnus.length > 0;

  // Resource colour helpers
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

  const statusCfg = {
    Online:   { border: 'border-green-500/30',  dot: 'bg-green-400',           text: 'text-green-400',  glow: 'from-green-500/5',  pill: 'bg-green-500/10 text-green-400 border-green-500/30' },
    Offline:  { border: 'border-red-500/30',    dot: 'bg-red-400',             text: 'text-red-400',    glow: 'from-red-500/5',    pill: 'bg-red-500/10   text-red-400   border-red-500/30' },
    Degraded: { border: 'border-amber-500/30',  dot: 'bg-amber-400',           text: 'text-amber-400',  glow: 'from-amber-500/5',  pill: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  }[olt.status] ?? { border: 'border-border/60', dot: 'bg-muted', text: 'text-muted-foreground', glow: 'from-muted/10', pill: 'bg-muted/30 text-muted-foreground border-border/40' };

  const lastSyncAgo = formatDistanceToNow(new Date(olt.lastSync), { addSuffix: true });

  return (
    <div className="space-y-5 pb-10">

      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/olts" className="hover:text-foreground transition-colors">OLT Management</Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="text-foreground font-medium">{olt.name}</span>
      </nav>

      {/* ── Hero Header Card ────────────────────────────────────────────────── */}
      <div className={`rounded-xl border ${statusCfg.border} bg-gradient-to-br ${statusCfg.glow} to-transparent bg-card/90 shadow-sm overflow-hidden`}>
        <div className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">

            {/* Left: name + badges + meta */}
            <div className="space-y-2.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className={`p-2 rounded-lg border ${statusCfg.border} bg-card/60`}>
                  <Server className={`h-4 w-4 ${statusCfg.text}`} />
                </div>
                <h1 className="text-xl font-bold tracking-tight">{olt.name}</h1>
                {/* Status pill */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusCfg.pill}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot} ${olt.status === 'Degraded' ? 'animate-pulse' : ''}`} />
                  {olt.status}
                </span>
                {/* Type badge */}
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${olt.type === 'EPON' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                  {olt.type}
                </span>
                {olt.mode === 'BOTH' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-purple-500/10 text-purple-400 border-purple-500/20">XPON</span>
                )}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono text-[11px] bg-muted/50 border border-border/40 px-2 py-0.5 rounded">{olt.ip}</span>
                </span>
                <span className="text-border hidden sm:inline">·</span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <MapPin className="h-3 w-3 shrink-0" />{olt.location}
                </span>
                <span className="text-border hidden sm:inline">·</span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <Tag className="h-3 w-3 shrink-0" />{olt.brand}
                </span>
                <span className="text-border hidden sm:inline">·</span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="font-medium text-foreground/80">
                    {isRealOlt && realOnus?.sysUpTimeSecs != null
                      ? fmtUptime(realOnus.sysUpTimeSecs)
                      : olt.uptime}
                  </span>
                </span>
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => navigate('/olts')} className="gap-1.5 h-8 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button variant="outline" size="sm" disabled className="gap-1.5 h-8 text-xs opacity-50">
                <RefreshCw className="h-3.5 w-3.5" /> Reboot
              </Button>
              <Button variant="outline" size="sm" disabled className="gap-1.5 h-8 text-xs opacity-50">
                <Settings className="h-3.5 w-3.5" /> Config
              </Button>
            </div>
          </div>
        </div>

        {/* Footer strip */}
        <div className="px-4 sm:px-5 py-2.5 border-t border-border/30 bg-muted/10 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span className="text-[11px] text-muted-foreground">
            Uplink: <span className="font-mono font-semibold text-foreground/70">{olt.uplinkPort}</span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            Uplink status: <UplinkBadge status={olt.uplinkStatus} />
          </span>
          <span className="text-[11px] text-muted-foreground ml-auto">
            Last sync: <span className="font-medium text-foreground/70">{lastSyncAgo}</span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            Last seen: <span className="font-medium text-foreground/70">{olt.lastSeen}</span>
          </span>
        </div>
      </div>

      {/* ── SNMP Verification Card — shown for managed (real) OLTs ─────────── */}
      {managed && (() => {
        const isVerified = managed.verificationStatus === 'verified';
        const verBorder  = isVerified ? 'border-green-500/30' : 'border-amber-500/30';
        const verBg      = isVerified ? 'from-green-500/5'   : 'from-amber-500/5';

        function fmtTime(iso: string | null) {
          if (!iso) return '—';
          try { return format(new Date(iso), 'dd MMM yyyy · HH:mm:ss'); } catch { return '—'; }
        }

        const rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
          {
            icon: <Shield className="h-3.5 w-3.5 text-muted-foreground" />,
            label: 'Verification Status',
            value: isVerified
              ? <span className="inline-flex items-center gap-1.5 text-green-400 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Verified</span>
              : <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold"><ShieldX className="h-3.5 w-3.5" /> Unverified</span>,
          },
          {
            icon: <Signal className="h-3.5 w-3.5 text-muted-foreground" />,
            label: 'SNMP Version',
            value: <span className="font-mono">{managed.snmpVersion ?? '—'}</span>,
          },
          {
            icon: <Network className="h-3.5 w-3.5 text-muted-foreground" />,
            label: 'SNMP Port',
            value: <span className="font-mono">{managed.snmpPort ?? '—'}</span>,
          },
          {
            icon: <Timer className="h-3.5 w-3.5 text-muted-foreground" />,
            label: 'Last Test Time',
            value: fmtTime(managed.lastTestTime),
          },
          {
            icon: <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />,
            label: 'Last Success Time',
            value: fmtTime(managed.lastSuccessTime),
          },
          {
            icon: <GaugeIcon className="h-3.5 w-3.5 text-muted-foreground" />,
            label: 'Latency',
            value: managed.latencyMs !== null ? <span className="font-mono">{managed.latencyMs} ms</span> : '—',
          },
          {
            icon: <Server className="h-3.5 w-3.5 text-muted-foreground" />,
            label: 'System Name',
            value: managed.systemName ? <span className="font-mono">{managed.systemName}</span> : '—',
          },
          {
            icon: <Tag className="h-3.5 w-3.5 text-muted-foreground" />,
            label: 'Vendor',
            value: olt.brand ?? '—',
          },
          {
            icon: <Info className="h-3.5 w-3.5 text-muted-foreground" />,
            label: 'Model',
            value: olt.type ? `${olt.brand} ${olt.type}` : '—',
          },
          {
            icon: <Zap className="h-3.5 w-3.5 text-muted-foreground" />,
            label: 'Firmware',
            value: '—',
          },
        ];

        return (
          <div className={`rounded-xl border ${verBorder} bg-gradient-to-br ${verBg} to-transparent bg-card/80 shadow-sm`}>
            <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
              {isVerified
                ? <ShieldCheck className="h-4 w-4 text-green-400" />
                : <ShieldX className="h-4 w-4 text-amber-400" />
              }
              <span className="text-sm font-semibold">SNMP Verification</span>
              <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${isVerified ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                {managed.verificationStatus}
              </span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-3">
              {rows.map(row => (
                <div key={String(row.label)} className="flex items-start gap-2 min-w-0">
                  <span className="mt-0.5 shrink-0">{row.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-1">{row.label}</p>
                    <p className="text-xs text-foreground/90 truncate">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ONU Discovery — manual trigger, read-only SNMP */}
            <div className="px-4 pb-4 border-t border-border/20 pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ScanLine className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ONU Discovery</span>
                  {realOnus && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                      <Database className="h-2.5 w-2.5" /> Live SNMP · {realOnus.totalOnus} ONUs · {format(new Date(realOnus.discoveredAt), 'HH:mm:ss')}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => void handleDiscoverOnus()}
                  disabled={discoverLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                >
                  {discoverLoading
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Discovering…</>
                    : <><ScanLine className="h-3.5 w-3.5" /> {realOnus ? 'Re-scan ONUs' : 'Discover ONUs'}</>
                  }
                </button>
              </div>
              {discoverError && (
                <p className="text-[11px] text-red-400 flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {discoverError}
                </p>
              )}
              {realOnus && (
                <p className="text-[11px] text-muted-foreground">{realOnus.message}</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Summary Cards ───────────────────────────────────────────────────── */}
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
          <p className="text-2xl font-bold tracking-tight">{displayTotal}</p>
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${displayOnlinePct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{displayOnlinePct}% online · {isRealOlt ? (realOnus ? 'live SNMP' : 'no data yet') : 'view all'}</p>
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
          <p className="text-2xl font-bold tracking-tight text-green-400">{displayOnline}</p>
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: displayTotal > 0 ? `${Math.round((displayOnline / displayTotal) * 100)}%` : '0%' }} />
            </div>
            <p className="text-[10px] text-muted-foreground group-hover:text-green-400/70 transition-colors">Active · filter</p>
          </div>
        </button>

        {/* Offline */}
        <button
          onClick={() => navigate(`/onus?olt=${olt.id}&status=Offline`)}
          className={`rounded-xl border border-border/60 bg-card/80 p-3.5 text-left transition-colors group space-y-2.5 shadow-sm ${displayOffline > 0 ? 'hover:border-red-500/40 hover:bg-red-500/[0.04]' : 'hover:border-muted/50'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Offline</span>
            <div className={`p-1.5 rounded-lg transition-colors ${displayOffline > 0 ? 'bg-red-500/10 group-hover:bg-red-500/20' : 'bg-muted/30'}`}>
              <WifiOff className={`h-3 w-3 ${displayOffline > 0 ? 'text-red-400' : 'text-muted-foreground'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${displayOffline > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{displayOffline}</p>
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: displayTotal > 0 ? `${Math.round((displayOffline / displayTotal) * 100)}%` : '0%' }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{displayOffline > 0 ? 'Needs attention' : 'All nominal'}</p>
          </div>
        </button>

        {/* Degraded */}
        <button
          onClick={() => navigate(`/onus?olt=${olt.id}&status=Degraded`)}
          className={`rounded-xl border border-border/60 bg-card/80 p-3.5 text-left transition-colors group space-y-2.5 shadow-sm ${displayDegraded > 0 ? 'hover:border-amber-500/40 hover:bg-amber-500/[0.04]' : 'hover:border-muted/50'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Degraded</span>
            <div className={`p-1.5 rounded-lg transition-colors ${displayDegraded > 0 ? 'bg-amber-500/10 group-hover:bg-amber-500/20' : 'bg-muted/30'}`}>
              <AlertTriangle className={`h-3 w-3 ${displayDegraded > 0 ? 'text-amber-400' : 'text-muted-foreground'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${displayDegraded > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{displayDegraded}</p>
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: displayTotal > 0 ? `${Math.round((displayDegraded / displayTotal) * 100)}%` : '0%' }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{displayDegraded > 0 ? 'Signal issues' : 'All clean'}</p>
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
              <Bell className={`h-3 w-3 ${unackedAlarms.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${unackedAlarms.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{unackedAlarms.length}</p>
          <div className="flex items-center gap-1.5 flex-wrap min-h-[16px]">
            {criticalAlarms.length > 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-500/15 text-red-400">{criticalAlarms.length} Crit</span>}
            {majorAlarms.length > 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/15 text-amber-400">{majorAlarms.length} Maj</span>}
            {minorAlarms.length > 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-500/15 text-blue-400">{minorAlarms.length} Min</span>}
            {unackedAlarms.length === 0 && <span className="text-[10px] text-muted-foreground">All clear</span>}
          </div>
        </button>

        {/* PON Ports */}
        <div className="rounded-xl border border-border/60 bg-card/80 p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">PON Ports</span>
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Server className="h-3 w-3 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">{displayPonPorts.length || olt.ponPortCount}</p>
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full"
                style={{ width: `${Math.round((displayPonPorts.filter(p => p.status === 'Active').length / (displayPonPorts.length || 1)) * 100)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{displayPonPorts.filter(p => p.status === 'Active').length} active · {displayPonPorts.length || olt.portCount} ports</p>
          </div>
        </div>
      </div>

      {/* ── System Resources + Uplink ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

        {/* CPU */}
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

        {/* Memory */}
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

        {/* Temperature */}
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
                  <div className={`h-full rounded-full transition-all ${olt.temperature > 55 ? 'bg-red-500' : olt.temperature > 45 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, (olt.temperature / 80) * 100)}%` }} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">{olt.status === 'Offline' ? 'Device offline' : olt.temperature > 55 ? 'Overheating' : olt.temperature > 45 ? 'Warm' : 'Normal'}</p>
            </div>
          </div>
        </div>

        {/* Uplink */}
        <div className={`rounded-xl border bg-card/80 p-4 shadow-sm ${olt.uplinkStatus === 'Down' ? 'border-red-500/30' : olt.uplinkStatus === 'Standby' ? 'border-amber-500/30' : 'border-border/60'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Network className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Uplink</span>
            <span className="ml-auto"><UplinkBadge status={olt.uplinkStatus} /></span>
          </div>
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
            <span className="font-medium">{lastSyncAgo}</span>
          </div>
        </div>
      </div>

      {/* ── Signal Health ────────────────────────────────────────────────────── */}
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

      {/* ── Main body: left col (PON sections) + right sidebar ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── LEFT: PON Distribution + PON Table + ONU cards ─────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* ONU Distribution by PON — bar chart */}
          <div className="rounded-xl border border-border/60 bg-card/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">ONU Distribution by PON</span>
              </div>
              <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded bg-muted/40 border border-border/40">
                {displayTotal} total
              </span>
            </div>
            <div className="p-4">
              {!hasDisplayData ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                  <Server className="h-8 w-8 opacity-20" />
                  <p className="text-xs">{isRealOlt ? 'Run ONU discovery to see port distribution' : 'No ONUs connected to this OLT'}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={displayChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={28} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false} tickLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700, fontSize: 11 }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                      formatter={(value) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>}
                    />
                    <Bar dataKey="Online"   stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Degraded" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Offline"  stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* PON Port Status */}
          <div className="rounded-xl border border-border/60 bg-card/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">PON Port Status</span>
              </div>
              <span className="text-[11px] text-muted-foreground px-2 py-0.5 rounded bg-muted/40 border border-border/40">{displayPonPorts.length || olt.ponPortCount} ports</span>
            </div>

            {/* Visual port grid */}
            <div className="p-4 border-b border-border/40 bg-muted/10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Port Map</p>
              <div className="flex flex-wrap gap-2">
                {displayPonPorts.map(port => (
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
                      port.status === 'Active' ? 'text-green-400' :
                      port.status === 'Degraded' ? 'text-amber-400' : 'text-slate-500'
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
            <div className={`overflow-x-auto${(displayPonPorts.length || olt.ponPortCount) > 8 ? ' max-h-64 overflow-y-auto' : ''}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/50">
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 px-4">Port</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 px-4">Status</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 text-center text-muted-foreground">Total</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 text-center text-green-400">On</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 text-center text-amber-400">Deg</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 text-center text-red-400">Off</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 text-cyan-400">Avg RX</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest py-2.5 text-right px-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayPonPorts.map(port => (
                    <TableRow key={port.id} className="hover:bg-muted/20 border-b border-border/30 transition-colors">
                      <TableCell className="font-mono text-xs py-2.5 px-4 font-bold">{port.name}</TableCell>
                      <TableCell className="py-2.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                          port.status === 'Active'   ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          port.status === 'Degraded' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${port.status === 'Active' ? 'bg-green-400' : port.status === 'Degraded' ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
                          {port.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs py-2.5 text-center text-muted-foreground">{port.total}</TableCell>
                      <TableCell className="font-mono text-xs py-2.5 text-center text-green-400 font-semibold">{port.online}</TableCell>
                      <TableCell className={`font-mono text-xs py-2.5 text-center font-semibold ${port.degraded > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{port.degraded}</TableCell>
                      <TableCell className={`font-mono text-xs py-2.5 text-center font-semibold ${port.offline > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{port.offline}</TableCell>
                      <TableCell className={`font-mono text-xs py-2.5 font-semibold ${port.total > 0 ? (parseFloat(port.avgRx) < -27 ? 'text-red-400' : parseFloat(port.avgRx) < -24 ? 'text-amber-400' : 'text-green-400') : 'text-muted-foreground'}`}>
                        {port.total > 0 ? `${port.avgRx} dBm` : '—'}
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-4">
                        <Button
                          variant="ghost" size="sm"
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
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {isRealOlt ? 'Discovered ONUs' : 'Connected ONUs'}{' '}
                  <span className="text-muted-foreground font-normal">({displayTotal})</span>
                </span>
                {isRealOlt && realOnus && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                    <Database className="h-2.5 w-2.5" /> Live SNMP
                  </span>
                )}
                {isRealOlt && !realOnus && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border bg-muted/30 text-muted-foreground border-border/40">
                    No real data
                  </span>
                )}
              </div>
              {!isRealOlt && (
                <Button variant="ghost" size="sm" className="text-xs h-7 text-primary hover:text-primary gap-1"
                  onClick={() => navigate(`/onus?olt=${olt.id}`)}>
                  View All <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Real OLT — no discovery yet */}
            {isRealOlt && !realOnus && (
              <div className="rounded-xl border border-border/60 bg-card/50 p-8 flex flex-col items-center gap-3 text-muted-foreground">
                <ScanLine className="h-8 w-8 opacity-20" />
                <p className="text-sm text-center">No real ONU data available yet</p>
                <p className="text-[11px] text-center opacity-70">Click "Discover ONUs" in the SNMP Verification card above to run a read-only SNMP scan of this OLT.</p>
              </div>
            )}

            {/* Real OLT — show discovered ONUs */}
            {isRealOlt && realOnus && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {realOnus.onus.slice(0, 8).map((o, idx) => (
                  <div
                    key={`${o.ponPort}-${o.onuId}-${idx}`}
                    className="rounded-lg border border-border/60 bg-card/50 p-3 transition-colors text-left space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-bold text-sm">ONU-{o.onuId}</div>
                      <span className={`h-2 w-2 rounded-full ${o.status === 'online' ? 'bg-green-400' : o.status === 'offline' ? 'bg-red-400' : 'bg-slate-500'}`} />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {(() => { const n = parseInt(String(o.ponPort).replace('port-', ''), 10); return `PON ${isNaN(n) ? o.ponPort : n + 1}`; })()}
                    </div>
                    {o.serial && <div className="text-[10px] font-mono text-muted-foreground truncate">{o.serial}</div>}
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${o.status === 'online' ? 'text-green-400' : o.status === 'offline' ? 'text-red-400' : 'text-slate-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${o.status === 'online' ? 'bg-green-400' : o.status === 'offline' ? 'bg-red-400' : 'bg-slate-500'}`} />
                        {o.status}
                      </span>
                      {o.type && <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">{o.type}</span>}
                    </div>
                  </div>
                ))}
                {realOnus.onus.length > 8 && (
                  <div className="rounded-lg border border-dashed border-border/40 bg-muted/20 p-3 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                    <span className="text-xs font-semibold">+{realOnus.onus.length - 8} more</span>
                    <span className="text-[10px]">from SNMP scan</span>
                  </div>
                )}
              </div>
            )}

            {/* Demo OLT — show mock ONUs */}
            {!isRealOlt && connectedOnus.length === 0 && (
              <div className="rounded-xl border border-border/60 bg-card/50 p-8 flex flex-col items-center gap-2 text-muted-foreground">
                <Wifi className="h-8 w-8 opacity-20" />
                <p className="text-sm">No ONUs connected to this OLT yet</p>
              </div>
            )}
            {!isRealOlt && connectedOnus.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {connectedOnus.slice(0, 8).map(o => (
                  <button
                    key={o.id}
                    onClick={() => navigate(`/onus/${o.id}`)}
                    className="rounded-lg border border-border/60 bg-card/50 p-3 hover:bg-card hover:border-primary/30 cursor-pointer transition-colors text-left space-y-1.5 group"
                  >
                    <div className="font-mono font-bold text-sm">{o.onuNo}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{o.description}</div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${o.status === 'Online' ? 'text-green-400' : o.status === 'Offline' ? 'text-red-400' : 'text-amber-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${o.status === 'Online' ? 'bg-green-400' : o.status === 'Offline' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'}`} />
                        {o.status}
                      </span>
                      <span className={`text-[10px] font-mono font-bold ${o.signalLevel < -27 ? 'text-red-400' : o.signalLevel < -24 ? 'text-amber-400' : 'text-green-400'}`}>
                        {o.signalLevel} dBm
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ────────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Active Alarms */}
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
                    <Shield className="h-5 w-5 text-green-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">No active alarms</p>
                  <p className="text-[10px] text-muted-foreground/60">This OLT is operating normally</p>
                </div>
              ) : (
                unackedAlarms.map(alarm => <AlarmRow key={alarm.id} alarm={alarm} />)
              )}
            </div>

            {oltAlarms.length > 0 && (
              <div className="px-3.5 py-2.5 border-t border-border/40 bg-muted/10">
                <button onClick={() => navigate('/alarms')}
                  className="text-[11px] text-primary hover:underline underline-offset-2 font-medium flex items-center gap-1">
                  View all alarms <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="rounded-xl border border-border/60 bg-card/80 shadow-sm overflow-hidden">
            <div className="p-3.5 border-b border-border/50 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Quick Links</span>
            </div>
            <div className="divide-y divide-border/40">
              {[
                {
                  icon: <LayoutList className="h-3.5 w-3.5" />,
                  label: `All ONUs on ${olt.name}`,
                  sub: `${connectedOnus.length} devices`,
                  action: () => navigate(`/onus?olt=${olt.id}`),
                  accent: 'text-primary',
                  bg: 'bg-primary/5 hover:bg-primary/10',
                },
                {
                  icon: <WifiOff className="h-3.5 w-3.5" />,
                  label: 'Offline ONUs',
                  sub: offlineOnus.length > 0 ? `${offlineOnus.length} offline` : 'None offline',
                  action: () => navigate(`/onus?olt=${olt.id}&status=Offline`),
                  accent: offlineOnus.length > 0 ? 'text-red-400' : 'text-muted-foreground',
                  bg: offlineOnus.length > 0 ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-muted/30',
                },
                {
                  icon: <AlertTriangle className="h-3.5 w-3.5" />,
                  label: 'Degraded ONUs',
                  sub: degradedOnus.length > 0 ? `${degradedOnus.length} degraded` : 'None degraded',
                  action: () => navigate(`/onus?olt=${olt.id}&status=Degraded`),
                  accent: degradedOnus.length > 0 ? 'text-amber-400' : 'text-muted-foreground',
                  bg: degradedOnus.length > 0 ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-muted/30',
                },
                {
                  icon: <Bell className="h-3.5 w-3.5" />,
                  label: 'Alarm Center',
                  sub: unackedAlarms.length > 0 ? `${unackedAlarms.length} unacknowledged` : 'No active alarms',
                  action: () => navigate('/alarms'),
                  accent: unackedAlarms.length > 0 ? 'text-amber-400' : 'text-muted-foreground',
                  bg: 'hover:bg-muted/30',
                },
                {
                  icon: <Server className="h-3.5 w-3.5" />,
                  label: 'All OLTs',
                  sub: 'Back to OLT Management',
                  action: () => navigate('/olts'),
                  accent: 'text-muted-foreground',
                  bg: 'hover:bg-muted/30',
                },
              ].map((link) => (
                <button
                  key={link.label}
                  onClick={link.action}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors ${link.bg}`}
                >
                  <span className={`shrink-0 ${link.accent}`}>{link.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${link.accent}`}>{link.label}</p>
                    <p className="text-[10px] text-muted-foreground">{link.sub}</p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Device Info */}
          <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Device Info</p>
            {[
              { label: 'Brand',     val: olt.brand },
              { label: 'Mode',      val: olt.mode },
              { label: 'Ports',     val: `${olt.portCount} total` },
              { label: 'PON Ports', val: String(olt.ponPortCount) },
              { label: 'Location',  val: olt.location },
              { label: 'Last Seen', val: olt.lastSeen },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
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
