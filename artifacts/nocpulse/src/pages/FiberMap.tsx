import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Square, Triangle, Layers, GitBranch, Zap, ChevronDown } from 'lucide-react';

const FIBER_COLORS = [
  { color: 'bg-blue-500',               svgFill: '#3b82f6', name: 'Blue',   core: 1 },
  { color: 'bg-orange-500',             svgFill: '#f97316', name: 'Orange', core: 2 },
  { color: 'bg-green-500',              svgFill: '#22c55e', name: 'Green',  core: 3 },
  { color: 'bg-amber-700',              svgFill: '#92400e', name: 'Brown',  core: 4 },
  { color: 'bg-gray-400',               svgFill: '#9ca3af', name: 'Slate',  core: 5 },
  { color: 'bg-white border border-border', svgFill: '#e2e8f0', name: 'White',  core: 6 },
  { color: 'bg-red-500',                svgFill: '#ef4444', name: 'Red',    core: 7 },
  { color: 'bg-zinc-900 border border-border', svgFill: '#18181b', name: 'Black',  core: 8 },
  { color: 'bg-yellow-400',             svgFill: '#facc15', name: 'Yellow', core: 9 },
  { color: 'bg-violet-500',             svgFill: '#8b5cf6', name: 'Violet', core: 10 },
  { color: 'bg-rose-300',               svgFill: '#fda4af', name: 'Pink',   core: 11 },
  { color: 'bg-cyan-300',               svgFill: '#67e8f9', name: 'Aqua',   core: 12 },
];

const SPLITTERS = [
  { x: 110, label: 'SP-N1', ratio: '1:8',  ok: true,  usedOut: 6, totalOut: 8  },
  { x: 210, label: 'SP-N2', ratio: '1:4',  ok: true,  usedOut: 4, totalOut: 4  },
  { x: 310, label: 'SP-C1', ratio: '1:16', ok: true,  usedOut: 9, totalOut: 16 },
  { x: 410, label: 'SP-C2', ratio: '1:8',  ok: false, usedOut: 3, totalOut: 8  },
  { x: 510, label: 'SP-S1', ratio: '1:8',  ok: true,  usedOut: 7, totalOut: 8  },
  { x: 610, label: 'SP-S2', ratio: '1:4',  ok: true,  usedOut: 2, totalOut: 4  },
];

const JOINT_BOXES = [
  { x: 155, label: 'JB-01', totalCores: 12, usedCores: 8,  ok: true  },
  { x: 305, label: 'JB-02', totalCores: 24, usedCores: 18, ok: true  },
  { x: 455, label: 'JB-03', totalCores: 12, usedCores: 5,  ok: false },
  { x: 555, label: 'JB-04', totalCores: 8,  usedCores: 6,  ok: true  },
];

const AREAS = [
  { name: 'North Zone',     olts: 2, splitters: 2, joints: 1, km: '12.4', status: 'Operational', totalCores: 36,  usedCores: 28 },
  { name: 'Central Zone',   olts: 2, splitters: 2, joints: 1, km: '8.7',  status: 'Operational', totalCores: 48,  usedCores: 31 },
  { name: 'South Zone',     olts: 2, splitters: 2, joints: 1, km: '15.2', status: 'Degraded',    totalCores: 24,  usedCores: 19 },
  { name: 'East/West Zone', olts: 4, splitters: 2, joints: 1, km: '11.8', status: 'Operational', totalCores: 60,  usedCores: 38 },
];

export default function FiberMap() {
  const [expandedArea, setExpandedArea] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fiber Map</h1>
          <p className="text-muted-foreground text-sm">Physical infrastructure visualization — fiber routes, splitters, and joint boxes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border/60 bg-[#080d15] backdrop-blur-sm overflow-hidden relative" style={{height: '520px'}}>
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(6,182,212,0.4) 1px, transparent 0)', backgroundSize: '24px 24px' }} />

            {/* Layer legend */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
              {[
                { color: '#06b6d4', label: 'Data Center / Hub', shape: 'rect' },
                { color: '#334155', label: 'Backbone Route',    shape: 'line' },
                { color: '#475569', label: 'Splitter',          shape: 'rect' },
                { color: '#64748b', label: 'Joint Box',         shape: 'diamond' },
                { color: '#22c55e', label: 'OLT Node',          shape: 'rect' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-[9px] text-slate-400/80">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.color, opacity: 0.8 }} />
                  {l.label}
                </div>
              ))}
            </div>

            <svg className="w-full h-full relative z-10" viewBox="0 0 700 520" preserveAspectRatio="xMidYMid meet">
              {/* Data Center */}
              <line x1="350" y1="38" x2="350" y2="90" stroke="#06b6d4" strokeWidth="3" strokeDasharray="6,3" opacity="0.9">
                <animate attributeName="stroke-dashoffset" values="0;-18" dur="1s" repeatCount="indefinite" />
              </line>
              <text x="360" y="68" fill="#06b6d4" fontSize="8" fontFamily="monospace" opacity="0.7">Fiber Uplink</text>
              <g transform="translate(350,30)">
                <rect x="-55" y="-18" width="110" height="36" rx="8" fill="hsl(var(--card))" stroke="#06b6d4" strokeWidth="2.5" />
                <text textAnchor="middle" y="4" fill="#06b6d4" fontSize="10" fontWeight="bold">DATA CENTER</text>
              </g>

              {/* Backbone */}
              <line x1="80" y1="118" x2="630" y2="118" stroke="#1e293b" strokeWidth="2" />
              <text x="85" y="114" fill="#475569" fontSize="8" fontFamily="monospace">Backbone Ring</text>

              {/* Hub nodes */}
              {[
                { x: 150, label: 'North Hub' },
                { x: 350, label: 'Central Exch.' },
                { x: 550, label: 'South Hub' },
              ].map(({ x, label }) => (
                <g key={label} transform={`translate(${x},118)`}>
                  <rect x="-45" y="-16" width="90" height="32" rx="6" fill="#0f172a" stroke="#06b6d4" strokeWidth="2" />
                  <text textAnchor="middle" y="4" fill="#94a3b8" fontSize="8" fontWeight="bold">{label}</text>
                  <circle cx="36" cy="-12" r="4" fill="#22c55e" />
                </g>
              ))}

              {/* Splitters */}
              {SPLITTERS.map(({ x, label, ratio, ok, usedOut, totalOut }) => (
                <g key={label} transform={`translate(${x},208)`}>
                  <line x1="0" y1="-90" x2="0" y2="-22" stroke={ok ? '#1e293b' : '#7f1d1d'} strokeWidth="1.5" strokeDasharray={ok ? 'none' : '4,2'} />
                  {/* Connection type label */}
                  <text x="4" y="-58" fill="#475569" fontSize="7" fontFamily="monospace">{ok ? 'SM-OS2' : 'BREAK'}</text>
                  <rect x="-30" y="-20" width="60" height="40" rx="4" fill={ok ? '#0f172a' : '#1c0a0a'} stroke={ok ? '#334155' : '#ef4444'} strokeWidth="1.5" />
                  <text textAnchor="middle" y="-4" fill={ok ? '#64748b' : '#f87171'} fontSize="7" fontWeight="bold">{label}</text>
                  <text textAnchor="middle" y="7" fill={ok ? '#06b6d4' : '#fca5a5'} fontSize="7">{ratio}</text>
                  {/* Usage indicator */}
                  <text textAnchor="middle" y="16" fill={ok ? '#94a3b8' : '#f87171'} fontSize="6">{usedOut}/{totalOut}</text>
                </g>
              ))}

              {/* Joint Boxes */}
              {JOINT_BOXES.map(({ x, label, totalCores, usedCores, ok }) => {
                const freeCores = totalCores - usedCores;
                const usedPct = Math.round((usedCores / totalCores) * 100);
                return (
                  <g key={label} transform={`translate(${x},328)`}>
                    <line x1="0" y1="-100" x2="0" y2="-22" stroke={ok ? '#1e293b' : '#7f1d1d'} strokeWidth="1.5" strokeDasharray={ok ? 'none' : '4,2'} />
                    {/* Fiber break indicator */}
                    {!ok && (
                      <g transform="translate(5,-60)">
                        <rect x="-8" y="-8" width="16" height="16" rx="2" fill="#450a0a" stroke="#ef4444" strokeWidth="1.5" />
                        <text textAnchor="middle" y="4" fill="#ef4444" fontSize="8" fontWeight="bold">✕</text>
                      </g>
                    )}
                    <polygon points="0,-20 28,0 0,20 -28,0" fill={ok ? '#0f172a' : '#1c0a0a'} stroke={ok ? '#475569' : '#ef4444'} strokeWidth="1.5" />
                    <text textAnchor="middle" y="-4" fill={ok ? '#94a3b8' : '#f87171'} fontSize="7" fontWeight="bold">{label}</text>
                    {/* Core usage */}
                    <text textAnchor="middle" y="6" fill={ok ? '#06b6d4' : '#f87171'} fontSize="6">{usedCores}/{totalCores}c</text>
                    {/* Free cores label */}
                    <text x="32" y="-8" fill={freeCores > 0 ? '#22c55e' : '#ef4444'} fontSize="6">{freeCores} free</text>
                    {/* Mini usage bar */}
                    <rect x="-18" y="25" width="36" height="4" rx="2" fill="#1e293b" />
                    <rect x="-18" y="25" width={Math.round(36 * usedPct / 100)} height="4" rx="2" fill={usedPct > 80 ? '#ef4444' : usedPct > 60 ? '#f59e0b' : '#06b6d4'} />
                  </g>
                );
              })}

              {/* OLT Nodes */}
              {[
                { x: 110, label: 'OLT-N01', type: 'GPON', ok: true },
                { x: 210, label: 'OLT-N02', type: 'GPON', ok: true },
                { x: 310, label: 'OLT-C01', type: 'EPON', ok: true },
                { x: 410, label: 'OLT-W01', type: 'GPON', ok: true },
                { x: 510, label: 'OLT-S01', type: 'GPON', ok: true },
                { x: 610, label: 'OLT-E01', type: 'EPON', ok: true },
              ].map(({ x, label, type, ok }) => (
                <g key={label} transform={`translate(${x},430)`}>
                  <line x1="0" y1="-78" x2="0" y2="-24" stroke={ok ? '#1e293b' : '#7f1d1d'} strokeWidth="1.5" />
                  <text x="4" y="-52" fill="#334155" fontSize="7" fontFamily="monospace">{type}</text>
                  <rect x="-30" y="-22" width="60" height="44" rx="5" fill={ok ? '#0f172a' : '#1c0a0a'} stroke={ok ? '#22c55e' : '#ef4444'} strokeWidth="1.5" />
                  <circle cx="24" cy="-16" r="4" fill={ok ? '#22c55e' : '#ef4444'} />
                  <text textAnchor="middle" y="-4" fill={ok ? '#64748b' : '#f87171'} fontSize="7" fontWeight="bold">{label}</text>
                  <text textAnchor="middle" y="8" fill={ok ? '#06b6d4' : '#f87171'} fontSize="7">{type}</text>
                  <text textAnchor="middle" y="18" fill="#475569" fontSize="6">OLT</text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="space-y-4">
          {/* Fiber core color legend */}
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
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary/40" style={{ width: `${30 + fc.core * 5}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Infrastructure Status */}
          <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Infrastructure Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { icon: GitBranch, label: 'Routes',      value: '8',  sub: '6 active' },
                { icon: Square,    label: 'Splitters',   value: '6',  sub: `${SPLITTERS.reduce((a,s) => a + s.usedOut, 0)} ports used` },
                { icon: Triangle,  label: 'Joint Boxes', value: '4',  sub: `${JOINT_BOXES.reduce((a,j) => a + j.usedCores, 0)} cores used` },
                { icon: Zap,       label: 'Fiber Breaks',value: '1',  sub: 'JB-03 affected', red: true },
              ].map(({ icon: Icon, label, value, sub, red }) => (
                <div key={label} className={`flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0 ${red ? 'text-red-400' : ''}`}>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className={`h-3.5 w-3.5 ${red ? 'text-red-400' : ''}`} />
                    <span className={red ? 'text-red-400' : ''}>{label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">{value}</span>
                    <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
              {/* Core summary */}
              <div className="pt-1 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Core Usage</p>
                {(() => {
                  const total = JOINT_BOXES.reduce((a, j) => a + j.totalCores, 0);
                  const used = JOINT_BOXES.reduce((a, j) => a + j.usedCores, 0);
                  const free = total - used;
                  const pct = Math.round((used / total) * 100);
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{used} used / {free} free</span>
                        <span className="font-mono font-bold">{pct}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Area grouping cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {AREAS.map(area => {
          const freeCores = area.totalCores - area.usedCores;
          const corePct = Math.round((area.usedCores / area.totalCores) * 100);
          const isExpanded = expandedArea === area.name;
          return (
            <div key={area.name} className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
              <button
                className="w-full p-4 text-left"
                onClick={() => setExpandedArea(isExpanded ? null : area.name)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-sm">{area.name}</h3>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${area.status === 'Operational' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{area.status}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div><p className="text-muted-foreground">OLTs</p><p className="font-bold">{area.olts}</p></div>
                  <div><p className="text-muted-foreground">Splitters</p><p className="font-bold">{area.splitters}</p></div>
                  <div><p className="text-muted-foreground">Joint Boxes</p><p className="font-bold">{area.joints}</p></div>
                  <div><p className="text-muted-foreground">Fiber Length</p><p className="font-bold">{area.km} km</p></div>
                </div>
                {/* Core usage mini-bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Cores: {area.usedCores}/{area.totalCores}</span>
                    <span className={`font-mono font-bold ${corePct > 80 ? 'text-red-400' : corePct > 60 ? 'text-amber-400' : 'text-cyan-400'}`}>{freeCores} free</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${corePct > 80 ? 'bg-red-500' : corePct > 60 ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${corePct}%` }} />
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-border/40 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-3">Core Detail</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-2 text-center">
                      <p className="text-2xl font-bold text-cyan-400">{area.usedCores}</p>
                      <p className="text-muted-foreground text-[10px]">Used cores</p>
                    </div>
                    <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-2 text-center">
                      <p className={`text-2xl font-bold ${freeCores > 4 ? 'text-green-400' : 'text-amber-400'}`}>{freeCores}</p>
                      <p className="text-muted-foreground text-[10px]">Free cores</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Splitter outputs: {area.splitters * 8} max capacity</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
