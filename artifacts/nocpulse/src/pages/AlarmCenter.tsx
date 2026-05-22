import { useState } from 'react';
import { alarms, Alarm } from '@/data/mockData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { XCircle, AlertTriangle, AlertCircle, Info, CheckCircle2, Bell } from 'lucide-react';

function AlarmCard({ alarm, onAcknowledge }: { alarm: Alarm; onAcknowledge?: (id: string) => void }) {
  const severityConfig = {
    Critical: { border: 'border-l-red-500', bg: 'bg-red-500/5', icon: XCircle, iconColor: 'text-red-400', badgeCls: 'bg-red-500/10 text-red-400 border-red-500/20' },
    Major: { border: 'border-l-amber-500', bg: 'bg-amber-500/5', icon: AlertTriangle, iconColor: 'text-amber-400', badgeCls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    Minor: { border: 'border-l-blue-500', bg: 'bg-blue-500/5', icon: AlertCircle, iconColor: 'text-blue-400', badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    Info: { border: 'border-l-slate-400', bg: 'bg-slate-500/5', icon: Info, iconColor: 'text-slate-400', badgeCls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  };
  const cfg = severityConfig[alarm.severity];
  const SeverityIcon = cfg.icon;
  
  return (
    <div className={`rounded-xl border border-border/60 border-l-4 ${cfg.border} ${cfg.bg} p-4 space-y-3 ${alarm.acknowledged ? 'opacity-60' : ''} backdrop-blur-sm shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <SeverityIcon className={`h-4 w-4 shrink-0 ${cfg.iconColor}`} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{alarm.deviceName}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${cfg.badgeCls}`}>{alarm.severity}</span>
              {alarm.acknowledged && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-green-500/10 text-green-400 border-green-500/20">Resolved</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{alarm.description}</p>
          </div>
        </div>
        {onAcknowledge && !alarm.acknowledged && (
          <Button size="sm" variant="outline" onClick={() => onAcknowledge(alarm.id)} className="shrink-0 text-xs h-8 border-primary/30 hover:bg-primary/10 hover:text-primary">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Acknowledge
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pl-7">
        <Bell className="h-3 w-3" />
        <span>{new Date(alarm.timestamp).toLocaleString()}</span>
        <span>•</span>
        <span>{formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true })}</span>
      </div>
    </div>
  );
}

export default function AlarmCenter() {
  const [localAlarms, setLocalAlarms] = useState<Alarm[]>(alarms);

  const handleAcknowledge = (id: string) => {
    setLocalAlarms(current => 
      current.map(a => a.id === id ? { ...a, acknowledged: true } : a)
    );
  };

  const unacked = localAlarms.filter(a => !a.acknowledged);
  const criticalCount = unacked.filter(a => a.severity === 'Critical').length;
  const majorCount = unacked.filter(a => a.severity === 'Major').length;
  const minorCount = unacked.filter(a => a.severity === 'Minor').length;
  const infoCount = localAlarms.filter(a => a.severity === 'Info').length;
  const resolvedCount = localAlarms.filter(a => a.acknowledged).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alarm Center</h1>
          <p className="text-muted-foreground">Monitor and acknowledge system alerts.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap bg-card/50 p-4 rounded-xl border border-border/60">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <XCircle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-xs font-semibold text-red-400">{criticalCount} Critical</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">{majorCount} Major</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <AlertCircle className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-blue-400">{minorCount} Minor</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400">{infoCount} Info</span>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-transparent border-b border-border/60 rounded-none h-auto p-0 gap-0 w-full justify-start mb-6">
          <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground">
            All
            {unacked.length > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">{unacked.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="critical" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground">
            Critical
            {criticalCount > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-500 text-[10px] font-bold">{criticalCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="warning" className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground">
            Warning
            {(majorCount + minorCount) > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold">{majorCount + minorCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground">
            Info
          </TabsTrigger>
          <TabsTrigger value="resolved" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground">
            Resolved
            {resolvedCount > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{resolvedCount}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 m-0">
          {unacked.length === 0 ? (
             <div className="py-12 text-center text-muted-foreground">No active alarms. System is healthy.</div>
          ) : (
            unacked.map(alarm => <AlarmCard key={alarm.id} alarm={alarm} onAcknowledge={handleAcknowledge} />)
          )}
        </TabsContent>

        <TabsContent value="critical" className="space-y-3 m-0">
          {unacked.filter(a => a.severity === 'Critical').length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No critical alarms.</div>
          ) : (
            unacked.filter(a => a.severity === 'Critical').map(alarm => <AlarmCard key={alarm.id} alarm={alarm} onAcknowledge={handleAcknowledge} />)
          )}
        </TabsContent>

        <TabsContent value="warning" className="space-y-3 m-0">
          {unacked.filter(a => a.severity === 'Major' || a.severity === 'Minor').length === 0 ? (
             <div className="py-12 text-center text-muted-foreground">No warnings.</div>
          ) : (
            unacked.filter(a => a.severity === 'Major' || a.severity === 'Minor').map(alarm => <AlarmCard key={alarm.id} alarm={alarm} onAcknowledge={handleAcknowledge} />)
          )}
        </TabsContent>

        <TabsContent value="info" className="space-y-3 m-0">
          {localAlarms.filter(a => a.severity === 'Info').length === 0 ? (
             <div className="py-12 text-center text-muted-foreground">No info events.</div>
          ) : (
            localAlarms.filter(a => a.severity === 'Info').map(alarm => <AlarmCard key={alarm.id} alarm={alarm} onAcknowledge={handleAcknowledge} />)
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-3 m-0">
          {localAlarms.filter(a => a.acknowledged).length === 0 ? (
             <div className="py-12 text-center text-muted-foreground">No resolved alarms.</div>
          ) : (
            localAlarms.filter(a => a.acknowledged).map(alarm => <AlarmCard key={alarm.id} alarm={alarm} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}