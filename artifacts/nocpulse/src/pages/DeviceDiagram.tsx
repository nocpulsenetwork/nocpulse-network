import { useState } from 'react';
import { useApiData } from '@/contexts/ApiDataContext';
import { Server, Wifi, GitBranch, Circle, ZoomIn, ZoomOut, Maximize2, Map } from 'lucide-react';
import { Link } from 'wouter';

export default function DeviceDiagram() {
  const { olts, onus } = useApiData();
  const [zoom, setZoom] = useState(100);
  const [showMinimap, setShowMinimap] = useState(true);

  const zoomIn = () => setZoom(z => Math.min(z + 20, 200));
  const zoomOut = () => setZoom(z => Math.max(z - 20, 40));
  const resetZoom = () => setZoom(100);

  function onuCountForOlt(oltId: string) {
    return onus.filter(o => o.oltId === oltId).length;
  }

  function ponPortStatus(oltId: string, portName: string) {
    const portOnus = onus.filter(o => o.oltId === oltId && o.ponPort === portName);
    if (portOnus.some(o => o.status === 'Online')) return 'online';
    if (portOnus.some(o => o.status === 'Degraded')) return 'degraded';
    if (portOnus.length > 0) return 'offline';
    return 'idle';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Device Diagram</h1>
          <p className="text-muted-foreground text-sm">Logical network topology — ISP infrastructure overview</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />Online</span>
          <span className="flex items-center gap-1"><Circle className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />Degraded</span>
          <span className="flex items-center gap-1"><Circle className="h-2.5 w-2.5 fill-red-500 text-red-500" />Offline</span>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden relative">
        {/* Toolbar */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1">
          <div className="flex items-center gap-1 bg-card/95 border border-border/60 rounded-lg px-2 py-1.5 shadow-lg backdrop-blur-sm">
            <button onClick={zoomOut} disabled={zoom <= 40} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/60 disabled:opacity-30 transition-colors">
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button onClick={resetZoom} className="text-[11px] font-mono min-w-[36px] text-center hover:bg-muted/60 rounded px-1 py-0.5 transition-colors">
              {zoom}%
            </button>
            <button onClick={zoomIn} disabled={zoom >= 200} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/60 disabled:opacity-30 transition-colors">
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-border/60 mx-1" />
            <button onClick={resetZoom} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/60 transition-colors" title="Fit to screen">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1 bg-card/95 border border-border/60 rounded-lg px-2 py-1.5 shadow-lg backdrop-blur-sm text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary/60 inline-block" />
            Drag to pan
          </div>
        </div>

        {/* Minimap toggle */}
        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={() => setShowMinimap(v => !v)}
            className="flex items-center gap-1.5 bg-card/95 border border-border/60 rounded-lg px-2.5 py-1.5 shadow-lg backdrop-blur-sm text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Map className="h-3.5 w-3.5" />
            Mini-map
          </button>
        </div>

        {/* Minimap */}
        {showMinimap && (
          <div className="absolute bottom-3 right-3 z-20 w-[160px] h-[100px] bg-card/95 border border-border/60 rounded-lg shadow-lg backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(6,182,212,0.8) 1px, transparent 0)', backgroundSize: '8px 8px' }} />
            <svg className="w-full h-full" viewBox="0 0 700 480" preserveAspectRatio="xMidYMid meet">
              <rect x="295" y="12" width="110" height="30" rx="4" fill="none" stroke="#06b6d4" strokeWidth="1.5" />
              <line x1="350" y1="42" x2="350" y2="60" stroke="#334155" strokeWidth="1" />
              <rect x="275" y="60" width="150" height="25" rx="4" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
              <line x1="100" y1="95" x2="600" y2="95" stroke="#334155" strokeWidth="1" />
              {olts.map((olt, i) => {
                const x = 80 + (i * 52);
                const col = olt.status === 'Online' ? '#22c55e' : olt.status === 'Offline' ? '#ef4444' : '#f59e0b';
                return (
                  <g key={olt.id}>
                    <line x1={x} y1="95" x2={x} y2="120" stroke="#334155" strokeWidth="1" />
                    <rect x={x - 18} y="120" width="36" height="22" rx="3" fill="none" stroke={col} strokeWidth="1.5" />
                    <circle cx={x + 12} cy="124" r="3" fill={col} />
                  </g>
                );
              })}
              <rect x="150" y="30" width="400" height="300" rx="4" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4,2" opacity="0.6" />
            </svg>
            <div className="absolute bottom-1 left-0 right-0 text-center text-[9px] text-muted-foreground/60 font-mono">{zoom}%</div>
          </div>
        )}

        <div className="overflow-auto" style={{ cursor: 'grab' }}>
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
            <div className="min-w-[960px] p-8 space-y-8">

              {/* Internet uplink */}
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-4">
                  <div className="px-6 py-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary font-bold text-sm flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    INTERNET UPLINK
                  </div>
                </div>
                <div className="relative flex flex-col items-center">
                  <div className="w-0.5 h-8 bg-gradient-to-b from-primary/60 to-primary/20" />
                  <span className="absolute left-3 top-2 text-[9px] font-mono text-primary/60 bg-card/80 px-1 rounded">100G WAN</span>
                </div>
              </div>

              {/* Core Router */}
              <div className="flex flex-col items-center">
                <div className="px-8 py-4 rounded-xl border-2 border-primary/60 bg-primary/10 shadow-lg shadow-primary/20 flex flex-col items-center gap-1">
                  <Server className="h-6 w-6 text-primary" />
                  <span className="font-bold text-sm text-primary">CORE ROUTER</span>
                  <span className="text-[10px] text-primary/70 font-mono">BGP / MPLS Backbone</span>
                </div>
                <div className="relative flex flex-col items-center w-full">
                  <div className="w-0.5 h-6 bg-border" />
                  <div className="w-full max-w-5xl h-0.5 bg-border/60" />
                  <span className="absolute text-[9px] font-mono text-muted-foreground/60 bg-card/80 px-1 rounded -top-2.5">10GE Distribution</span>
                </div>
              </div>

              {/* OLT Layer */}
              {olts.length === 0 ? (
                <div className="flex justify-center">
                  <div className="text-sm text-muted-foreground py-8">No OLTs configured — add an OLT in OLT Management to see it here.</div>
                </div>
              ) : (
                <div className="flex justify-center gap-5 flex-wrap px-4">
                  {olts.map(olt => {
                    const statusStyles = {
                      Online:   'border-green-500/40 bg-green-500/5 text-green-400',
                      Offline:  'border-red-500/40 bg-red-500/5 text-red-400',
                      Degraded: 'border-amber-500/40 bg-amber-500/5 text-amber-400',
                    };
                    const onlineCount  = onus.filter(o => o.oltId === olt.id && o.status === 'Online').length;
                    const offlineCount = onus.filter(o => o.oltId === olt.id && o.status !== 'Online').length;
                    const portCount    = olt.ponPortCount > 0 ? olt.ponPortCount : 8;

                    return (
                      <div key={olt.id} className="flex flex-col items-center">
                        <div className="relative">
                          <div className="w-0.5 h-6 bg-border mx-auto" />
                          <span className="absolute left-2 top-0 text-[8px] font-mono text-cyan-500/60 whitespace-nowrap">1GE/10GE</span>
                        </div>
                        <Link href={`/olts/${olt.id}`}>
                          <div className={`flex flex-col items-center gap-1 p-3 rounded-xl border cursor-pointer hover:scale-105 transition-transform ${statusStyles[olt.status]}`} style={{width: '130px'}}>
                            <div className={`h-2 w-2 rounded-full ${olt.status === 'Online' ? 'bg-green-500 animate-pulse' : olt.status === 'Offline' ? 'bg-red-500' : 'bg-amber-500'}`} />
                            <Server className="h-5 w-5" />
                            <span className="font-semibold text-[11px] text-center leading-tight truncate w-full">{olt.name}</span>
                            <span className="text-[9px] font-mono opacity-70">{olt.ip}</span>
                            <div className="flex gap-1 flex-wrap justify-center mt-0.5">
                              <span className={`text-[9px] px-1 rounded border ${olt.type === 'EPON' ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' : 'border-primary/30 text-primary bg-primary/10'}`}>{olt.type}</span>
                              {olt.mode === 'BOTH' && <span className="text-[9px] px-1 rounded border border-purple-500/30 text-purple-400 bg-purple-500/10">BOTH</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[9px]">
                              <span className="text-green-400">{onlineCount}↑</span>
                              {offlineCount > 0 && <span className="text-red-400">{offlineCount}↓</span>}
                            </div>
                          </div>
                        </Link>

                        {/* PON ports */}
                        <div className="relative">
                          <div className="w-0.5 h-4 bg-border/60 mx-auto" />
                          <span className="absolute left-2 top-0.5 text-[8px] font-mono text-muted-foreground/50 whitespace-nowrap">PON</span>
                        </div>
                        <div className="flex gap-1 justify-center flex-wrap" style={{maxWidth: '160px'}}>
                          {Array.from({ length: portCount }, (_, i) => {
                            const portName = `PON-${i + 1}`;
                            const st = ponPortStatus(olt.id, portName);
                            const portColor =
                              st === 'online'   ? 'border-green-500/40 bg-green-500/10 text-green-400' :
                              st === 'degraded' ? 'border-amber-500/40 bg-amber-500/10 text-amber-400' :
                              st === 'offline'  ? 'border-red-500/30 bg-red-500/5 text-red-400/70'     :
                                                  'border-border/40 bg-muted/20 text-muted-foreground/50';
                            return (
                              <div
                                key={portName}
                                className={`px-1 py-0.5 rounded border text-[8px] font-mono ${portColor}`}
                              >
                                {i + 1}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-3">
          <h3 className="font-semibold text-sm">OLT Distribution by Brand</h3>
          <div className="space-y-2">
            {['Huawei', 'ZTE', 'Nokia', 'Fiberhome', 'Calix'].map(brand => {
              const brandOlts = olts.filter(o => o.brand === brand);
              if (brandOlts.length === 0) return null;
              return (
                <div key={brand} className="flex items-center justify-between text-xs border-b border-border/40 pb-2 last:border-0">
                  <span className="text-muted-foreground">{brand}</span>
                  <div className="flex gap-3 text-right">
                    <span><span className="font-mono">{brandOlts.filter(o=>o.type==='GPON').length}</span> GPON</span>
                    <span><span className="font-mono">{brandOlts.filter(o=>o.type==='EPON').length}</span> EPON</span>
                    <span className="font-bold">{brandOlts.length} Total</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-3">
          <h3 className="font-semibold text-sm">Port Utilization</h3>
          <div className="space-y-3">
            {olts.slice(0, 5).map(olt => {
              const used = onuCountForOlt(olt.id);
              const max = (olt.ponPortCount > 0 ? olt.ponPortCount : 8) * 64;
              const pct = max > 0 ? (used / max) * 100 : 0;
              return (
                <div key={olt.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[120px]">{olt.name}</span>
                    <span className="font-mono">{used}/{max}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-green-500'}`} style={{width: `${Math.min(pct, 100)}%`}} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-3">
          <h3 className="font-semibold text-sm">Connectivity Health</h3>
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <span className="text-sm text-muted-foreground">Total Uplinks Active</span>
              <span className="text-lg font-bold text-green-400">{olts.filter(o => o.uplinkStatus === 'Active').length} <span className="text-xs text-muted-foreground">/ {olts.length}</span></span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <span className="text-sm text-muted-foreground">PON Ports Online</span>
              <span className="text-lg font-bold text-cyan-400">{olts.reduce((acc, o) => acc + (o.status === 'Online' ? (o.ponPortCount > 0 ? o.ponPortCount : 8) : 0), 0)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <span className="text-sm text-muted-foreground">ONU Attach Rate</span>
              <span className="text-lg font-bold text-amber-400">92%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground flex items-center gap-1"><Wifi className="h-3.5 w-3.5 text-green-400" />ONUs Online</span>
              <span className="text-lg font-bold text-green-400">{onus.filter(o => o.status === 'Online').length} <span className="text-xs text-muted-foreground">/ {onus.length}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
