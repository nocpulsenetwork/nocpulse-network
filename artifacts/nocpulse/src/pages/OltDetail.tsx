import { useState } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { olts, onus, alarms } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, RefreshCw, Settings, Server, Cpu, MemoryStick, Thermometer, Wifi, WifiOff, Activity, ChevronRight, AlertTriangle, Signal, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { UplinkBadge } from '@/pages/OltManagement';
import { AlarmRow } from '@/components/AlarmRow';

export default function OltDetail() {
  const [, params] = useRoute('/olts/:id');
  const [, navigate] = useLocation();
  const olt = olts.find(o => o.id === params?.id);

  if (!olt) return <div className="p-8 text-center text-muted-foreground">OLT not found.</div>;

  const connectedOnus = onus.filter(o => o.oltId === olt.id);
  const onlineOnus = connectedOnus.filter(o => o.status === 'Online');
  const offlineOnus = connectedOnus.filter(o => o.status !== 'Online');
  const oltAlarms = alarms.filter(a => a.deviceName === olt.name || a.deviceName.includes(olt.name));
  const unacknowledgedAlarms = oltAlarms.filter(a => !a.acknowledged);

  // Signal health distribution across connected ONUs
  const goodSignalOnus = connectedOnus.filter(o => o.status === 'Online' && o.signalLevel > -25);
  const warnSignalOnus = connectedOnus.filter(o => o.status === 'Online' && o.signalLevel <= -25 && o.signalLevel > -28);
  const poorSignalOnus = connectedOnus.filter(o => o.status === 'Online' && o.signalLevel <= -28);
  const totalOnlineForHealth = onlineOnus.length || 1;

  // Simulated OLT uptime from lastSync field
  const uptimeMs = Date.now() - new Date(olt.lastSync).getTime() + 1296000000; // ~15 days
  const uptimeDays = Math.floor(uptimeMs / 86400000);
  const uptimeHrs = Math.floor((uptimeMs % 86400000) / 3600000);

  const ponPorts = Array.from({ length: olt.ponPortCount }, (_, i) => {
    const portOnus = connectedOnus.filter(o => o.ponPort === `PON-${i + 1}`);
    const onlineCount = portOnus.filter(o => o.status === 'Online').length;
    const offlineCount = portOnus.filter(o => o.status !== 'Online').length;
    return {
      id: i + 1,
      name: `PON-${i + 1}`,
      total: portOnus.length,
      onuCount: portOnus.length,
      online: onlineCount,
      offline: offlineCount,
      status: offlineCount > 0 ? 'Degraded' : portOnus.length > 0 ? 'Active' : 'Idle',
      avgRx: portOnus.length > 0 ? (portOnus.reduce((s, o) => s + o.signalLevel, 0) / portOnus.length).toFixed(1) : '--',
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/olts" className="hover:text-foreground">OLT Management</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{olt.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{olt.name}</h1>
              <StatusBadge status={olt.status} />
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${olt.type === 'EPON' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>{olt.type}</span>
              {olt.mode === 'BOTH' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-purple-500/10 text-purple-400 border-purple-500/20">XPON / BOTH</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">{olt.ip}</span>
              <span>•</span>
              <span>{olt.location}</span>
              <span>•</span>
              <span className="font-medium">{olt.brand}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/olts')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="outline" size="sm" disabled className="gap-2 opacity-60">
            <RefreshCw className="h-4 w-4" /> Reboot
          </Button>
          <Button variant="outline" size="sm" disabled className="gap-2 opacity-60">
            <Settings className="h-4 w-4" /> Configure
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => navigate(`/onus?olt=${olt.id}`)}
          className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-2 shadow-lg text-left hover:border-primary/40 hover:bg-primary/5 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs text-muted-foreground">Total ONUs</p>
            <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors"><Activity className="h-3.5 w-3.5 text-primary" /></div>
          </div>
          <p className="text-2xl font-bold">{connectedOnus.length}</p>
          <p className="text-[10px] text-muted-foreground group-hover:text-primary/70 transition-colors">All connected · view</p>
        </button>
        <button
          onClick={() => navigate(`/onus?olt=${olt.id}&status=Online`)}
          className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-2 shadow-lg text-left hover:border-green-500/40 hover:bg-green-500/5 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs text-muted-foreground">Online ONUs</p>
            <div className="p-1.5 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors"><Wifi className="h-3.5 w-3.5 text-green-400" /></div>
          </div>
          <p className="text-2xl font-bold text-green-400">{onlineOnus.length}</p>
          <p className="text-[10px] text-muted-foreground group-hover:text-green-400/70 transition-colors">Active · click to filter</p>
        </button>
        <button
          onClick={() => navigate(`/onus?olt=${olt.id}&status=Offline`)}
          className={`rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-2 shadow-lg text-left transition-colors group ${offlineOnus.length > 0 ? 'hover:border-red-500/40 hover:bg-red-500/5' : 'hover:border-muted/50 hover:bg-muted/5'}`}
        >
          <div className="flex items-start justify-between">
            <p className="text-xs text-muted-foreground">Offline ONUs</p>
            <div className="p-1.5 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors"><WifiOff className="h-3.5 w-3.5 text-red-400" /></div>
          </div>
          <p className={`text-2xl font-bold ${offlineOnus.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{offlineOnus.length}</p>
          <p className="text-[10px] text-muted-foreground group-hover:text-red-400/70 transition-colors">{offlineOnus.length > 0 ? 'Need attention · filter' : 'All nominal'}</p>
        </button>
        <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-2 shadow-lg">
          <div className="flex items-start justify-between">
            <p className="text-xs text-muted-foreground">PON Ports</p>
            <div className="p-1.5 rounded-lg bg-cyan-500/10"><Server className="h-3.5 w-3.5 text-cyan-400" /></div>
          </div>
          <p className="text-2xl font-bold">{olt.ponPortCount}</p>
          <p className="text-[10px] text-muted-foreground">Total capacity</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-2 shadow-lg">
          <div className="flex items-start justify-between">
            <p className="text-xs text-muted-foreground">Active Alarms</p>
            <div className="p-1.5 rounded-lg bg-amber-500/10"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /></div>
          </div>
          <p className={`text-2xl font-bold ${unacknowledgedAlarms.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{unacknowledgedAlarms.length}</p>
          <p className="text-[10px] text-muted-foreground">Unresolved</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 space-y-2 shadow-lg">
          <div className="flex items-start justify-between">
            <p className="text-xs text-muted-foreground">OLT Uptime</p>
            <div className="p-1.5 rounded-lg bg-primary/10"><Clock className="h-3.5 w-3.5 text-primary" /></div>
          </div>
          <p className="text-2xl font-bold">{uptimeDays}d</p>
          <p className="text-[10px] text-muted-foreground">{uptimeDays}d {uptimeHrs}h continuous</p>
        </div>
      </div>

      {/* Signal health summary */}
      <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Signal className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Signal Health Summary</span>
          </div>
          <span className="text-xs text-muted-foreground">{onlineOnus.length} online ONUs analyzed</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Good Signal', sublabel: '> −25 dBm', count: goodSignalOnus.length, color: 'text-green-400', barColor: 'bg-green-500', border: 'border-green-500/20', bg: 'bg-green-500/5' },
            { label: 'Warning Signal', sublabel: '−25 to −28 dBm', count: warnSignalOnus.length, color: 'text-amber-400', barColor: 'bg-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
            { label: 'Poor Signal', sublabel: '< −28 dBm', count: poorSignalOnus.length, color: 'text-red-400', barColor: 'bg-red-500', border: 'border-red-500/20', bg: 'bg-red-500/5' },
          ].map(s => {
            const pct = Math.round((s.count / totalOnlineForHealth) * 100);
            return (
              <div key={s.label} className={`rounded-lg border ${s.border} ${s.bg} p-3 space-y-2`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${s.color}`}>{s.label}</p>
                    <p className="text-[10px] text-muted-foreground">{s.sublabel}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.count}</p>
                    <p className="text-[10px] text-muted-foreground">{pct}%</p>
                  </div>
                </div>
                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.barColor} transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        {/* Stacked distribution bar */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Overall Distribution</p>
          <div className="h-3 bg-muted rounded-full overflow-hidden flex">
            <div className="bg-green-500 h-full transition-all" style={{ width: `${Math.round((goodSignalOnus.length / totalOnlineForHealth) * 100)}%` }} />
            <div className="bg-amber-500 h-full transition-all" style={{ width: `${Math.round((warnSignalOnus.length / totalOnlineForHealth) * 100)}%` }} />
            <div className="bg-red-500 h-full transition-all" style={{ width: `${Math.round((poorSignalOnus.length / totalOnlineForHealth) * 100)}%` }} />
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Good ({Math.round((goodSignalOnus.length / totalOnlineForHealth) * 100)}%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Warning ({Math.round((warnSignalOnus.length / totalOnlineForHealth) * 100)}%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Poor ({Math.round((poorSignalOnus.length / totalOnlineForHealth) * 100)}%)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'CPU Usage', val: olt.cpu, icon: Cpu, isTemp: false },
          { title: 'Memory Usage', val: olt.memory, icon: MemoryStick, isTemp: false },
          { title: 'Temperature', val: olt.temperature, icon: Thermometer, isTemp: true },
        ].map(res => {
          let color = 'text-green-400';
          let bgColor = 'bg-green-500';
          if (!res.isTemp) {
            if (res.val > 80) { color = 'text-red-400'; bgColor = 'bg-red-500'; }
            else if (res.val > 60) { color = 'text-amber-400'; bgColor = 'bg-amber-500'; }
          } else {
            if (res.val > 55) { color = 'text-red-400'; bgColor = 'bg-red-500'; }
            else if (res.val > 45) { color = 'text-amber-400'; bgColor = 'bg-amber-500'; }
          }
          const isOffline = res.val === 0 && !res.isTemp && olt.cpu === 0 && olt.memory === 0;

          return (
            <Card key={res.title} className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <res.icon className="h-4 w-4 text-muted-foreground" />
                  {res.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isOffline ? (
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-muted-foreground">--</p>
                    <p className="text-xs text-muted-foreground">Device offline</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className={`text-2xl font-bold font-mono flex items-center gap-1 ${color}`}>
                      {res.val}{res.isTemp ? '°C' : '%'}
                    </div>
                    {!res.isTemp && (
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${bgColor}`} style={{ width: `${res.val}%` }} />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">PON Port Summary</CardTitle>
                <span className="text-[10px] text-muted-foreground">{olt.ponPortCount} ports</span>
              </div>
            </CardHeader>
            <div className={olt.ponPortCount > 8 ? 'max-h-72 overflow-y-auto' : ''}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 sticky top-0 z-10">
                    <TableHead className="text-[10px] py-2">Port</TableHead>
                    <TableHead className="text-[10px] py-2">Status</TableHead>
                    <TableHead className="text-[10px] py-2 text-center">Total</TableHead>
                    <TableHead className="text-[10px] py-2 text-center text-green-400">Online</TableHead>
                    <TableHead className="text-[10px] py-2 text-center text-red-400">Offline</TableHead>
                    <TableHead className="text-[10px] py-2">Avg RX</TableHead>
                    <TableHead className="text-[10px] py-2 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ponPorts.map(port => (
                    <TableRow key={port.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs py-2 font-semibold">{port.name}</TableCell>
                      <TableCell className="py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          port.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          port.status === 'Degraded' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {port.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs py-2 text-center text-muted-foreground">{port.total}</TableCell>
                      <TableCell className="font-mono text-xs py-2 text-center text-green-400">{port.online}</TableCell>
                      <TableCell className={`font-mono text-xs py-2 text-center ${port.offline > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{port.offline}</TableCell>
                      <TableCell className="font-mono text-xs py-2 text-muted-foreground">{port.total > 0 ? `${port.avgRx} dBm` : '—'}</TableCell>
                      <TableCell className="text-right py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/onus?olt=${olt.id}&pon=PON-${port.id}`)}
                          className="h-7 text-[11px] px-2"
                        >
                          View ONUs
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Connected ONUs ({connectedOnus.length})</h3>
              <Button variant="ghost" size="sm" className="text-xs h-7 text-primary hover:text-primary" onClick={() => navigate(`/onus?olt=${olt.id}`)}>
                View All <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {connectedOnus.slice(0, 8).map(onu => (
                <div key={onu.id} onClick={() => navigate(`/onus/${onu.id}`)} className="rounded-lg border border-border/60 bg-card/50 p-3 hover:bg-card cursor-pointer transition-colors space-y-1">
                  <div className="font-mono font-medium text-sm">{onu.onuNo}</div>
                  <div className="text-xs text-muted-foreground truncate">{onu.description}</div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${onu.status === 'Online' ? 'bg-green-400' : onu.status === 'Offline' ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <span className="text-[10px] text-muted-foreground">{onu.status}</span>
                    </div>
                    <span className={`text-[10px] font-mono ${onu.signalLevel < -25 ? 'text-red-400' : onu.signalLevel < -20 ? 'text-amber-400' : 'text-green-400'}`}>
                      {onu.signalLevel} dBm
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg">
            <CardHeader><CardTitle className="text-sm font-semibold">Uplink Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Port</span>
                <span className="font-mono text-xs px-2 py-0.5 bg-muted rounded">{olt.uplinkPort}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Status</span>
                <UplinkBadge status={olt.uplinkStatus} />
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Last Sync</span>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(olt.lastSync), { addSuffix: true })}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg">
            <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Active Alarms
            </CardTitle></CardHeader>
            <CardContent className="p-0">
              {unacknowledgedAlarms.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No active alarms for this OLT.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border/50">
                  {unacknowledgedAlarms.map(alarm => (
                    <AlarmRow key={alarm.id} alarm={alarm} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}