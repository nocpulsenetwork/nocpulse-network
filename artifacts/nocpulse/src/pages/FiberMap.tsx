import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Circle, Square, Triangle, Layers, GitBranch, Zap, AlertTriangle } from 'lucide-react';

export default function FiberMap() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fiber Map</h1>
          <p className="text-muted-foreground">Physical infrastructure visualization</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border/60 bg-[#080d15] backdrop-blur-sm overflow-hidden relative" style={{height: '480px'}}>
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(6,182,212,0.4) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            <svg className="w-full h-full relative z-10" viewBox="0 0 700 480" preserveAspectRatio="xMidYMid meet">
              
              <line x1="350" y1="30" x2="350" y2="90" stroke="#06b6d4" strokeWidth="3" strokeDasharray="6,3" opacity="0.9">
                <animate attributeName="stroke-dashoffset" values="0;-18" dur="1s" repeatCount="indefinite" />
              </line>
              
              <g transform="translate(350,30)">
                <rect x="-50" y="-18" width="100" height="36" rx="8" fill="hsl(var(--card))" stroke="#06b6d4" strokeWidth="2.5" />
                <text textAnchor="middle" y="4" fill="#06b6d4" fontSize="10" fontWeight="bold">DATA CENTER</text>
              </g>
              
              <line x1="100" y1="110" x2="600" y2="110" stroke="#1e293b" strokeWidth="2" />
              
              {[
                {x:150, y:110, label:'North Hub', ok:true},
                {x:350, y:110, label:'Central Exchange', ok:true},
                {x:550, y:110, label:'South Hub', ok:true},
              ].map(({x,y,label,ok}) => (
                <g key={label} transform={`translate(${x},${y})`}>
                  <rect x="-45" y="-16" width="90" height="32" rx="6" fill="#0f172a" stroke={ok ? '#06b6d4' : '#ef4444'} strokeWidth="2" />
                  <text textAnchor="middle" y="4" fill={ok ? '#94a3b8' : '#f87171'} fontSize="8" fontWeight="bold">{label}</text>
                  <circle cx="36" cy="-12" r="4" fill={ok ? '#22c55e' : '#ef4444'} />
                </g>
              ))}
              
              {[
                {x:110, label:'SP-N1', ratio:'1:8', ok:true},
                {x:210, label:'SP-N2', ratio:'1:4', ok:true},
                {x:310, label:'SP-C1', ratio:'1:16', ok:true},
                {x:410, label:'SP-C2', ratio:'1:8', ok:false},
                {x:510, label:'SP-S1', ratio:'1:8', ok:true},
                {x:610, label:'SP-S2', ratio:'1:4', ok:true},
              ].map(({x, label, ratio, ok}) => (
                <g key={label} transform={`translate(${x},200)`}>
                  <line x1="0" y1="-90" x2="0" y2="-20" stroke={ok ? '#1e293b' : '#7f1d1d'} strokeWidth="1.5" strokeDasharray={ok ? 'none' : '4,2'} />
                  <rect x="-28" y="-18" width="56" height="36" rx="4" fill={ok ? '#0f172a' : '#1c0a0a'} stroke={ok ? '#334155' : '#ef4444'} strokeWidth="1.5" />
                  <text textAnchor="middle" y="-3" fill={ok ? '#64748b' : '#f87171'} fontSize="7" fontWeight="bold">{label}</text>
                  <text textAnchor="middle" y="10" fill={ok ? '#06b6d4' : '#fca5a5'} fontSize="7">{ratio}</text>
                </g>
              ))}
              
              {[
                {x:155, label:'JB-01', cores:12, ok:true},
                {x:305, label:'JB-02', cores:24, ok:true},
                {x:455, label:'JB-03', cores:12, ok:false},
                {x:555, label:'JB-04', cores:8, ok:true},
              ].map(({x, label, cores, ok}) => (
                <g key={label} transform={`translate(${x},310)`}>
                  <line x1="0" y1="-92" x2="0" y2="-20" stroke={ok ? '#1e293b' : '#7f1d1d'} strokeWidth="1.5" strokeDasharray={ok ? 'none' : '4,2'} />
                  <polygon points="0,-16 24,0 0,16 -24,0" fill={ok ? '#0f172a' : '#1c0a0a'} stroke={ok ? '#475569' : '#ef4444'} strokeWidth="1.5" />
                  <text textAnchor="middle" y="-2" fill={ok ? '#94a3b8' : '#f87171'} fontSize="7" fontWeight="bold">{label}</text>
                  <text textAnchor="middle" y="8" fill="#475569" fontSize="7">{cores}c</text>
                </g>
              ))}
              
              <g transform="translate(455,265)">
                <rect x="-12" y="-12" width="24" height="24" rx="3" fill="#450a0a" stroke="#ef4444" strokeWidth="2" />
                <text textAnchor="middle" y="4" fill="#ef4444" fontSize="10" fontWeight="bold">✕</text>
              </g>
              <text x="470" y="268" fill="#f87171" fontSize="8">Fiber Break</text>
              
              {[
                {x:110, label:'OLT-N01', ok:true},
                {x:210, label:'OLT-N02', ok:true},
                {x:310, label:'OLT-C01', ok:true},
                {x:410, label:'OLT-W01', ok:true},
                {x:510, label:'OLT-S01', ok:true},
                {x:610, label:'OLT-E01', ok:true},
              ].map(({x, label, ok}) => (
                <g key={label} transform={`translate(${x},400)`}>
                  <line x1="0" y1="-74" x2="0" y2="-22" stroke={ok ? '#1e293b' : '#7f1d1d'} strokeWidth="1.5" />
                  <rect x="-28" y="-20" width="56" height="40" rx="5" fill={ok ? '#0f172a' : '#1c0a0a'} stroke={ok ? '#22c55e' : '#ef4444'} strokeWidth="1.5" />
                  <circle cx="22" cy="-14" r="4" fill={ok ? '#22c55e' : '#ef4444'} />
                  <text textAnchor="middle" y="-3" fill={ok ? '#64748b' : '#f87171'} fontSize="7" fontWeight="bold">{label}</text>
                  <text textAnchor="middle" y="10" fill={ok ? '#06b6d4' : '#f87171'} fontSize="7">OLT</text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Fiber Core Colors</CardTitle>
              <p className="text-xs text-muted-foreground">ITU-T G.652 color coding</p>
            </CardHeader>
            <CardContent className="space-y-1.5 h-48 overflow-y-auto">
              {[
                { color: 'bg-blue-500', name: 'Blue', core: '1' },
                { color: 'bg-orange-500', name: 'Orange', core: '2' },
                { color: 'bg-green-500', name: 'Green', core: '3' },
                { color: 'bg-amber-700', name: 'Brown', core: '4' },
                { color: 'bg-gray-400', name: 'Slate', core: '5' },
                { color: 'bg-white border border-border', name: 'White', core: '6' },
                { color: 'bg-red-500', name: 'Red', core: '7' },
                { color: 'bg-black border border-border', name: 'Black', core: '8' },
                { color: 'bg-yellow-400', name: 'Yellow', core: '9' },
                { color: 'bg-violet-500', name: 'Violet', core: '10' },
                { color: 'bg-rose-300', name: 'Pink', core: '11' },
                { color: 'bg-cyan-300', name: 'Aqua', core: '12' },
              ].map(fc => (
                <div key={fc.core} className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full shrink-0 ${fc.color}`} />
                  <span className="text-xs text-muted-foreground flex-1">{fc.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60">Core {fc.core}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Infrastructure Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><GitBranch className="h-4 w-4" /> Routes</div>
                <span className="font-bold">8</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Square className="h-4 w-4" /> Splitters</div>
                <span className="font-bold">6</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Triangle className="h-4 w-4" /> Joint Boxes</div>
                <span className="font-bold">4</span>
              </div>
              <div className="flex items-center justify-between text-sm text-red-400">
                <div className="flex items-center gap-2"><Zap className="h-4 w-4" /> Fiber Breaks</div>
                <span className="font-bold">1</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { name: 'North Zone', olts: 2, splitters: 2, joints: 1, km: '12.4', status: 'Operational' },
          { name: 'Central Zone', olts: 2, splitters: 2, joints: 1, km: '8.7', status: 'Operational' },
          { name: 'South Zone', olts: 2, splitters: 2, joints: 1, km: '15.2', status: 'Degraded' },
          { name: 'East/West Zone', olts: 4, splitters: 2, joints: 1, km: '11.8', status: 'Operational' },
        ].map(area => (
          <div key={area.name} className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-3 shadow-lg">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-sm">{area.name}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${area.status === 'Operational' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{area.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-muted-foreground">OLTs</p><p className="font-bold">{area.olts}</p></div>
              <div><p className="text-muted-foreground">Splitters</p><p className="font-bold">{area.splitters}</p></div>
              <div><p className="text-muted-foreground">Joint Boxes</p><p className="font-bold">{area.joints}</p></div>
              <div><p className="text-muted-foreground">Fiber Length</p><p className="font-bold">{area.km} km</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}