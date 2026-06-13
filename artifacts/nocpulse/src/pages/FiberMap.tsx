import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers } from 'lucide-react';
import { Link } from 'wouter';
import { useApiData } from '@/contexts/ApiDataContext';

const FIBER_COLORS = [
  { color: 'bg-blue-500',                       svgFill: '#3b82f6', name: 'Blue',   core: 1 },
  { color: 'bg-orange-500',                     svgFill: '#f97316', name: 'Orange', core: 2 },
  { color: 'bg-green-500',                      svgFill: '#22c55e', name: 'Green',  core: 3 },
  { color: 'bg-amber-700',                      svgFill: '#92400e', name: 'Brown',  core: 4 },
  { color: 'bg-gray-400',                       svgFill: '#9ca3af', name: 'Slate',  core: 5 },
  { color: 'bg-white border border-border',     svgFill: '#e2e8f0', name: 'White',  core: 6 },
  { color: 'bg-red-500',                        svgFill: '#ef4444', name: 'Red',    core: 7 },
  { color: 'bg-zinc-900 border border-border',  svgFill: '#18181b', name: 'Black',  core: 8 },
  { color: 'bg-yellow-400',                     svgFill: '#facc15', name: 'Yellow', core: 9 },
  { color: 'bg-violet-500',                     svgFill: '#8b5cf6', name: 'Violet', core: 10 },
  { color: 'bg-rose-300',                       svgFill: '#fda4af', name: 'Pink',   core: 11 },
  { color: 'bg-cyan-300',                       svgFill: '#67e8f9', name: 'Aqua',   core: 12 },
];

type PonStatus = 'online' | 'degraded' | 'offline' | 'idle';

const PORT_FILL: Record<PonStatus, string> = {
  online:   '#166534',
  degraded: '#713f12',
  offline:  '#7f1d1d',
  idle:     '#1a2332',
};
const PORT_STROKE: Record<PonStatus, string> = {
  online:   '#22c55e',
  degraded: '#f59e0b',
  offline:  '#ef4444',
  idle:     '#334155',
};

const OLT_SPACING = 120;
const SVG_MIN_W   = 700;
const CORE_Y      = 45;
const BACKBONE_Y  = 95;
const OLT_CY      = 185;
const PON_START_Y = OLT_CY + 34;
const SVG_H       = 360;

export default function FiberMap() {
  const { olts, onus } = useApiData();

  // Precompute PON port statuses for every OLT (avoids repeated .filter inside SVG render)
  const oltPonStatuses = useMemo<Record<string, PonStatus[]>>(() => {
    return Object.fromEntries(olts.map(olt => {
      const portCount = olt.ponPortCount > 0 ? olt.ponPortCount : 8;
      const statuses: PonStatus[] = Array.from({ length: portCount }, (_, pi) => {
        const portName = `PON-${pi + 1}`;
        const portOnus = onus.filter(o => o.oltId === olt.id && o.ponPort === portName);
        if (portOnus.some(o => o.status === 'Online'))   return 'online';
        if (portOnus.some(o => o.status === 'Degraded')) return 'degraded';
        if (portOnus.length > 0)                         return 'offline';
        return 'idle';
      });
      return [olt.id, statuses];
    }));
  }, [olts, onus]);

  const onlineOlts   = olts.filter(o => o.status === 'Online').length;
  const offlineOlts  = olts.filter(o => o.status === 'Offline').length;
  const degradedOlts = olts.filter(o => o.status === 'Degraded').length;
  const totalPons    = olts.reduce((a, o) => a + (o.ponPortCount > 0 ? o.ponPortCount : 8), 0);

  const svgW   = Math.max(SVG_MIN_W, olts.length * OLT_SPACING + 100);
  const coreX  = svgW / 2;
  const startX = olts.length > 0 ? (svgW - (olts.length - 1) * OLT_SPACING) / 2 : coreX;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Network Map</h1>
          <p className="text-muted-foreground text-sm">Live OLT topology — real data, updates automatically</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />Online</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />Degraded</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />Offline</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-600 inline-block" />Idle port</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── SVG topology ── */}
        <div className="lg:col-span-2">
          <div
            className="rounded-xl border border-border/60 bg-[#080d15] backdrop-blur-sm overflow-auto relative"
            style={{ height: '380px' }}
          >
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(6,182,212,0.4) 1px, transparent 0)', backgroundSize: '24px 24px' }}
            />

            {/* Legend overlay */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
              {[
                { col: '#06b6d4', label: 'Network Core' },
                { col: '#22c55e', label: 'OLT — Online' },
                { col: '#f59e0b', label: 'OLT — Degraded' },
                { col: '#ef4444', label: 'OLT — Offline' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-[9px] text-slate-400/80">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.col, opacity: 0.8 }} />
                  {l.label}
                </div>
              ))}
              <div className="mt-1 pt-1 border-t border-slate-700/50 text-[9px] text-slate-500">PON Ports</div>
              {[
                { col: '#22c55e', label: 'Active' },
                { col: '#f59e0b', label: 'Degraded' },
                { col: '#ef4444', label: 'Problem' },
                { col: '#334155', label: 'Idle' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-[9px] text-slate-400/80">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.col, opacity: 0.8 }} />
                  {l.label}
                </div>
              ))}
            </div>

            <svg
              style={{ minWidth: svgW, height: SVG_H }}
              viewBox={`0 0 ${svgW} ${SVG_H}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Animated uplink line */}
              <line x1={coreX} y1={CORE_Y + 18} x2={coreX} y2={BACKBONE_Y} stroke="#06b6d4" strokeWidth="2" strokeDasharray="5,2" opacity="0.8">
                <animate attributeName="stroke-dashoffset" values="0;-14" dur="1s" repeatCount="indefinite" />
              </line>

              {/* Network Core node */}
              <g transform={`translate(${coreX},${CORE_Y})`}>
                <rect x="-55" y="-18" width="110" height="36" rx="8" fill="#0a1628" stroke="#06b6d4" strokeWidth="2.5" />
                <text textAnchor="middle" y="5" fill="#06b6d4" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  NETWORK CORE
                </text>
              </g>

              {/* Backbone horizontal line */}
              {olts.length > 0 && (
                <>
                  <line
                    x1={startX}
                    y1={BACKBONE_Y}
                    x2={startX + (olts.length - 1) * OLT_SPACING}
                    y2={BACKBONE_Y}
                    stroke="#1e293b"
                    strokeWidth="2"
                  />
                  <text x={startX - 4} y={BACKBONE_Y - 5} fill="#334155" fontSize="7" fontFamily="monospace" textAnchor="end">
                    Backbone
                  </text>
                </>
              )}

              {/* Empty state */}
              {olts.length === 0 && (
                <text x={coreX} y={SVG_H / 2 + 30} textAnchor="middle" fill="#475569" fontSize="12">
                  No OLTs — add an OLT in OLT Management
                </text>
              )}

              {/* OLT nodes */}
              {olts.map((olt, i) => {
                const x          = startX + i * OLT_SPACING;
                const portCount  = olt.ponPortCount > 0 ? olt.ponPortCount : 8;
                const statuses   = oltPonStatuses[olt.id] ?? [];
                const statusCol  = olt.status === 'Online' ? '#22c55e' : olt.status === 'Offline' ? '#ef4444' : '#f59e0b';
                const boxFill    = olt.status === 'Online' ? '#061220' : olt.status === 'Offline' ? '#1c0707' : '#1c1200';

                const cols       = Math.min(portCount, 8);
                const ponGridW   = cols * 9 - 2;
                const ponLeft    = x - ponGridW / 2;

                const shortName  = olt.name.length > 11 ? olt.name.slice(0, 10) + '…' : olt.name;

                return (
                  <g key={olt.id}>
                    {/* Backbone → OLT vertical line */}
                    <line x1={x} y1={BACKBONE_Y} x2={x} y2={OLT_CY - 30} stroke="#334155" strokeWidth="1.5" />

                    {/* OLT type label on line */}
                    <text x={x + 3} y={OLT_CY - 18} fill="#334155" fontSize="6.5" fontFamily="monospace">{olt.type}</text>

                    {/* OLT box */}
                    <rect x={x - 42} y={OLT_CY - 29} width="84" height="54" rx="6" fill={boxFill} stroke={statusCol} strokeWidth="1.5" />

                    {/* Status dot */}
                    <circle cx={x + 34} cy={OLT_CY - 23} r="4" fill={statusCol} opacity="0.9" />

                    {/* OLT name */}
                    <text textAnchor="middle" x={x} y={OLT_CY - 13} fill="#94a3b8" fontSize="7.5" fontWeight="bold">{shortName}</text>
                    {/* Status */}
                    <text textAnchor="middle" x={x} y={OLT_CY - 2} fill={statusCol} fontSize="7">{olt.status}</text>
                    {/* IP */}
                    <text textAnchor="middle" x={x} y={OLT_CY + 9} fill="#475569" fontSize="6.5" fontFamily="monospace">{olt.ip}</text>
                    {/* Port count */}
                    <text textAnchor="middle" x={x} y={OLT_CY + 21} fill="#334155" fontSize="6">{portCount}P</text>

                    {/* OLT → PON connector */}
                    <line x1={x} y1={OLT_CY + 25} x2={x} y2={PON_START_Y - 2} stroke="#1e293b" strokeWidth="1" />

                    {/* PON port squares */}
                    {statuses.map((st, pi) => {
                      const col = pi % cols;
                      const row = Math.floor(pi / cols);
                      return (
                        <rect
                          key={pi}
                          x={ponLeft + col * 9}
                          y={PON_START_Y + row * 9}
                          width="7"
                          height="7"
                          rx="1"
                          fill={PORT_FILL[st]}
                          stroke={PORT_STROKE[st]}
                          strokeWidth="0.8"
                          opacity="0.95"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="space-y-4">
          {/* Fiber Core Colors — ITU-T G.652 standard, not mock data */}
          <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Fiber Core Colors
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">ITU-T G.652 12-core color coding</p>
            </CardHeader>
            <CardContent className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {FIBER_COLORS.map(fc => (
                <div key={fc.core} className="flex items-center gap-2 py-0.5">
                  <div className={`h-3 w-3 rounded-full shrink-0 ${fc.color}`} />
                  <span className="text-xs flex-1">{fc.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60 w-12 text-right">Core {fc.core}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Live network summary */}
          <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Network Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Total OLTs',     value: olts.length,   color: 'text-foreground'  },
                { label: 'Online',         value: onlineOlts,    color: 'text-green-400'   },
                { label: 'Degraded',       value: degradedOlts,  color: 'text-amber-400'   },
                { label: 'Offline',        value: offlineOlts,   color: 'text-red-400'     },
                { label: 'Total PON Ports',value: totalPons,     color: 'text-cyan-400'    },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground text-xs">{label}</span>
                  <span className={`font-bold font-mono ${color}`}>{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── OLT detail cards (replaces fake Zone cards) ── */}
      {olts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {olts.map(olt => {
            const portCount    = olt.ponPortCount > 0 ? olt.ponPortCount : 8;
            const statuses     = oltPonStatuses[olt.id] ?? [];
            const onlineCount  = onus.filter(o => o.oltId === olt.id && o.status === 'Online').length;
            const totalOnus    = onus.filter(o => o.oltId === olt.id).length;
            const activePorts  = statuses.filter(s => s === 'online').length;

            return (
              <Link key={olt.id} href={`/olts/${olt.id}`}>
                <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden cursor-pointer hover:border-primary/40 transition-colors">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-sm truncate max-w-[140px]">{olt.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider shrink-0 ml-1 ${
                        olt.status === 'Online'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : olt.status === 'Offline'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>{olt.status}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        <p className="text-muted-foreground">IP</p>
                        <p className="font-mono font-bold text-[11px]">{olt.ip}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Type</p>
                        <p className="font-bold">{olt.type}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">PON Ports</p>
                        <p className="font-bold">{portCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ONUs</p>
                        <p className="font-bold">
                          {onlineCount}
                          <span className="text-muted-foreground font-normal">/{totalOnus}</span>
                        </p>
                      </div>
                    </div>

                    {/* PON port mini grid */}
                    <div>
                      <p className="text-[9px] text-muted-foreground mb-1.5 uppercase tracking-wider">PON Ports</p>
                      <div className="flex flex-wrap gap-0.5">
                        {statuses.map((st, pi) => (
                          <div
                            key={pi}
                            title={`PON-${pi + 1}: ${st}`}
                            className={`w-4 h-4 rounded-sm border text-[7px] flex items-center justify-center font-mono font-bold ${
                              st === 'online'
                                ? 'bg-green-500/20 border-green-500/40 text-green-400'
                                : st === 'degraded'
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                : st === 'offline'
                                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                : 'bg-slate-500/10 border-slate-500/20 text-slate-500'
                            }`}
                          >
                            {pi + 1}
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-1.5">
                        {activePorts} active / {portCount} total
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-border/60 bg-card/40">
          <p className="text-sm text-muted-foreground">No OLTs configured.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Add an OLT in OLT Management — it will appear here automatically.</p>
        </div>
      )}
    </div>
  );
}
