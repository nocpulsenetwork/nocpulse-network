import { MetricCard } from '@/components/MetricCard';
import { AlarmRow } from '@/components/AlarmRow';
import { alarms, olts, onus, metrics } from '@/data/mockData';
import { Server, Router, Wifi, WifiOff, AlertTriangle, Cpu, ServerCrash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Link } from 'wouter';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const recentAlarms = alarms.slice(0, 5);
  const latestActivity = alarms.slice(0, 7);
  const first5OfflineOnus = onus.filter(o => o.status === 'Offline').slice(0, 5);
  
  const oltStatusData = [
    { name: 'Online', value: olts.filter(o => o.status === 'Online').length, color: 'hsl(var(--chart-2))' },
    { name: 'Degraded', value: olts.filter(o => o.status === 'Degraded').length, color: 'hsl(var(--chart-3))' },
    { name: 'Offline', value: olts.filter(o => o.status === 'Offline').length, color: 'hsl(var(--chart-5))' },
  ];

  const { totalOlts, totalOnus, onlineOnus, offlineOnus, offlineOlts, activeAlarms, criticalAlarms } = metrics;
  const majorCount = alarms.filter(a => !a.acknowledged && a.severity === 'Major').length;

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'Critical': return 'bg-red-500';
      case 'Major': return 'bg-amber-500';
      case 'Minor': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  const oltOnlineRate = ((totalOlts - offlineOlts) / totalOlts) * 100;
  const onuOnlineRate = (onlineOnus / totalOnus) * 100;
  const alarmResolutionRate = ((alarms.length - activeAlarms) / alarms.length) * 100;

  const getPctColor = (pct: number) => {
    if (pct >= 95) return 'hsl(var(--chart-2))'; // green
    if (pct >= 80) return 'hsl(var(--chart-3))'; // amber
    return 'hsl(var(--chart-5))'; // red
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Total OLT"
          value={totalOlts}
          icon={Server}
          accentColor="cyan"
          description="Configured terminals"
          href="/olts"
        />
        <MetricCard
          title="Total ONU"
          value={totalOnus}
          icon={Router}
          accentColor="cyan"
          description="Customer premises"
          href="/onus"
        />
        <MetricCard
          title="Online ONU"
          value={onlineOnus}
          icon={Wifi}
          accentColor="green"
          description="Active connections"
          href="/onus?status=online"
        />
        <MetricCard
          title="Offline ONU"
          value={offlineOnus}
          icon={WifiOff}
          accentColor="red"
          alert={offlineOnus > 0}
          description="Require attention"
          href="/onus?status=offline"
        />
        <MetricCard
          title="Offline OLT"
          value={offlineOlts}
          icon={ServerCrash}
          accentColor="red"
          alert={offlineOlts > 0}
          description="Down terminals"
          href="/olts?status=offline"
        />
        <MetricCard
          title="Critical Alerts"
          value={criticalAlarms}
          icon={AlertTriangle}
          accentColor="amber"
          pulse={criticalAlarms > 0}
          alert={criticalAlarms > 0}
          description={`${majorCount} major pending`}
          href="/alarms"
        />
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm border-border/50 flex flex-col">
          <CardHeader>
            <CardTitle>OLT Status Distribution</CardTitle>
            <CardDescription>Current operational state of all OLT devices</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] sm:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={oltStatusData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                <Tooltip 
                  cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                  contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', boxShadow: 'var(--shadow-sm)'}}
                  itemStyle={{color: 'hsl(var(--foreground))'}}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {oltStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 flex flex-col shadow-sm border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between border-b shrink-0">
            <div>
              <CardTitle>Recent Alarms</CardTitle>
              <CardDescription>Latest network events</CardDescription>
            </div>
            <Link href="/alarms" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0 max-h-[300px] sm:max-h-full">
            <div className="flex flex-col">
              {recentAlarms.length > 0 ? (
                recentAlarms.map((alarm) => (
                  <AlarmRow key={alarm.id} alarm={alarm} />
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                  <Cpu className="h-8 w-8 mb-2 opacity-20" />
                  <p>No recent alarms</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-5">
        <Card className="md:col-span-2 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Network Health</CardTitle>
            <CardDescription>Live system overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-muted-foreground w-32 shrink-0">Uptime</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{width: '99.98%', background: 'hsl(var(--chart-2))'}} />
              </div>
              <span className="text-xs font-mono font-semibold w-12 text-right">99.98%</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-muted-foreground w-32 shrink-0">OLT Online Rate</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{width: `${oltOnlineRate}%`, background: getPctColor(oltOnlineRate)}} />
              </div>
              <span className="text-xs font-mono font-semibold w-12 text-right">{oltOnlineRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-muted-foreground w-32 shrink-0">ONU Online Rate</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{width: `${onuOnlineRate}%`, background: getPctColor(onuOnlineRate)}} />
              </div>
              <span className="text-xs font-mono font-semibold w-12 text-right">{onuOnlineRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-muted-foreground w-32 shrink-0">Alarm Resolution</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{width: `${alarmResolutionRate}%`, background: getPctColor(alarmResolutionRate)}} />
              </div>
              <span className="text-xs font-mono font-semibold w-12 text-right">{alarmResolutionRate.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Latest system events</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col divide-y divide-border/50">
              {latestActivity.map(alarm => (
                <div key={alarm.id} className="p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${getSeverityColor(alarm.severity)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alarm.deviceName}</p>
                    <p className="text-xs text-muted-foreground truncate">{alarm.description}</p>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap text-right">
                    2h ago
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card className="shadow-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Offline ONUs</CardTitle>
              <CardDescription>{offlineOnus} devices need attention</CardDescription>
            </div>
            <Link href="/onus?status=offline" className="text-xs font-medium text-primary hover:underline">
              View all &rarr;
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {first5OfflineOnus.length > 0 ? (
              <div className="flex flex-col divide-y divide-border/50">
                {first5OfflineOnus.map(onu => (
                  <div key={onu.id} className="p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                    <WifiOff className="h-4 w-4 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="font-medium text-sm truncate">{onu.onuNo}</span>
                      <span className="text-xs text-muted-foreground truncate">{onu.description}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-muted/50 whitespace-nowrap shrink-0">{onu.lastLogoutReason}</Badge>
                    <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0">{onu.lastSync}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground flex flex-col items-center justify-center">
                <WifiOff className="h-8 w-8 mb-2 text-green-500/50" />
                <p className="text-green-500 font-medium">All ONUs online</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>OLT Status</CardTitle>
              <CardDescription>Terminal operational states</CardDescription>
            </div>
            <Link href="/olts" className="text-xs font-medium text-primary hover:underline">
              View all &rarr;
            </Link>
          </CardHeader>
          <CardContent className="p-0">
             <div className="flex flex-col divide-y divide-border/50 max-h-[240px] overflow-y-auto">
                {olts.map(olt => (
                  <div key={olt.id} className="p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${olt.status === 'Online' ? 'bg-green-500' : olt.status === 'Degraded' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="font-medium text-sm truncate">{olt.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{olt.location}</span>
                    </div>
                    <StatusBadge status={olt.status} className="shrink-0" />
                    <span className="text-xs text-right w-16 shrink-0">{olt.uptime}</span>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
