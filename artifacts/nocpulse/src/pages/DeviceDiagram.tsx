import { useState } from 'react';
import { olts, onus } from '@/data/mockData';
import { Server, Cpu, Wifi, WifiOff, GitBranch, ChevronRight, Circle } from 'lucide-react';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';

export default function DeviceDiagram() {
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

      <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm overflow-x-auto">
        <div className="min-w-[900px] p-8 space-y-8">
          
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-4">
              <div className="px-6 py-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary font-bold text-sm flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                INTERNET UPLINK
              </div>
            </div>
            <div className="w-0.5 h-8 bg-gradient-to-b from-primary/60 to-primary/20" />
          </div>

          <div className="flex flex-col items-center">
            <div className="px-8 py-4 rounded-xl border-2 border-primary/60 bg-primary/10 shadow-lg shadow-primary/20 flex flex-col items-center gap-1">
              <Server className="h-6 w-6 text-primary" />
              <span className="font-bold text-sm text-primary">CORE ROUTER</span>
              <span className="text-[10px] text-primary/70 font-mono">10GE Backbone</span>
            </div>
            <div className="w-0.5 h-8 bg-border" />
            <div className="w-full max-w-4xl h-0.5 bg-border/60" />
          </div>

          <div className="flex justify-center gap-6 flex-wrap">
            {olts.map(olt => {
              const statusStyles = {
                Online: 'border-green-500/40 bg-green-500/5 text-green-400',
                Offline: 'border-red-500/40 bg-red-500/5 text-red-400',
                Degraded: 'border-amber-500/40 bg-amber-500/5 text-amber-400',
              };
              const connectedOnus = onus.filter(o => o.oltId === olt.id);
              return (
                <div key={olt.id} className="flex flex-col items-center">
                  <div className="w-0.5 h-8 bg-border" />
                  <Link href={`/olts/${olt.id}`}>
                    <div className={`flex flex-col items-center gap-1 p-3 rounded-xl border cursor-pointer hover:scale-105 transition-transform ${statusStyles[olt.status]}`} style={{width: '120px'}}>
                      <div className={`h-2 w-2 rounded-full ${olt.status === 'Online' ? 'bg-green-500 animate-pulse' : olt.status === 'Offline' ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <Server className="h-5 w-5" />
                      <span className="font-semibold text-[11px] text-center leading-tight truncate w-full">{olt.name}</span>
                      <span className="text-[9px] font-mono opacity-70">{olt.ip}</span>
                      <div className="flex gap-1 flex-wrap justify-center mt-1">
                        <span className="text-[9px] px-1 rounded bg-current/10 border border-current/20">{olt.type}</span>
                        <span className="text-[9px] opacity-60">{connectedOnus.length} ONU</span>
                      </div>
                    </div>
                  </Link>

                  <div className="flex gap-1.5 mt-2 justify-center">
                    {connectedOnus.slice(0, 3).map(onu => (
                      <Link key={onu.id} href={`/onus/${onu.id}`}>
                        <div className={`px-2 py-1.5 rounded-lg border text-center cursor-pointer hover:scale-105 transition-transform ${onu.status === 'Online' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`} style={{width:'40px'}}>
                          <Cpu className={`h-3 w-3 mx-auto ${onu.status === 'Online' ? 'text-green-400' : 'text-red-400'}`} />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
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
              const max = olt.ponPortCount * 64; 
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
              <span className="text-lg font-bold text-cyan-400">{olts.reduce((acc, o) => acc + (o.status === 'Online' ? o.ponPortCount : 0), 0)}</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="text-sm text-muted-foreground">ONU Attach Rate</span>
              <span className="text-lg font-bold text-amber-400">92%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function onuCountForOlt(oltId: string) {
  return onus.filter(o => o.oltId === oltId).length;
}