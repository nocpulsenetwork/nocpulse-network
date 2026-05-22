import React from 'react';
import { MetricCard } from '@/components/MetricCard';
import { AlarmRow } from '@/components/AlarmRow';
import { alarms, olts, onus, metrics } from '@/data/mockData';
import { Server, Router, Wifi, WifiOff, AlertTriangle, Cpu, ServerCrash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Link } from 'wouter';

export default function Dashboard() {
  const recentAlarms = alarms.slice(0, 5);
  
  const oltStatusData = [
    { name: 'Online', value: olts.filter(o => o.status === 'Online').length, color: 'hsl(var(--chart-2))' },
    { name: 'Degraded', value: olts.filter(o => o.status === 'Degraded').length, color: 'hsl(var(--chart-3))' },
    { name: 'Offline', value: olts.filter(o => o.status === 'Offline').length, color: 'hsl(var(--chart-5))' },
  ];

  const { totalOlts, totalOnus, onlineOnus, offlineOnus, offlineOlts, activeAlarms, criticalAlarms } = metrics;
  const majorCount = alarms.filter(a => !a.acknowledged && a.severity === 'Major').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>OLT Status Distribution</CardTitle>
            <CardDescription>Current operational state of all OLT devices</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
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

        <Card className="col-span-3 flex flex-col shadow-sm border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between border-b">
            <div>
              <CardTitle>Recent Alarms</CardTitle>
              <CardDescription>Latest network events</CardDescription>
            </div>
            <Link href="/alarms" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="flex flex-col">
              {recentAlarms.length > 0 ? (
                recentAlarms.map((alarm) => (
                  <AlarmRow key={alarm.id} alarm={alarm} />
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                  <Cpu className="h-8 w-8 mb-2 opacity-20" />
                  <p>No recent alarms</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}