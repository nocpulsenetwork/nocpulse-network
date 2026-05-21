import React from 'react';
import { MetricCard } from '@/components/MetricCard';
import { AlarmRow } from '@/components/AlarmRow';
import { metrics, alarms, olts } from '@/data/mockData';
import { Server, Router, Activity, AlertTriangle, Cpu } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const recentAlarms = alarms.slice(0, 5);
  
  const oltStatusData = [
    { name: 'Online', value: olts.filter(o => o.status === 'Online').length, color: 'hsl(var(--chart-2))' },
    { name: 'Degraded', value: olts.filter(o => o.status === 'Degraded').length, color: 'hsl(var(--chart-3))' },
    { name: 'Offline', value: olts.filter(o => o.status === 'Offline').length, color: 'hsl(var(--chart-5))' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total OLTs"
          value={metrics.totalOlts}
          icon={Server}
          description="Active and configured"
        />
        <MetricCard
          title="Total ONUs"
          value={metrics.totalOnus.toLocaleString()}
          icon={Router}
          trend="+12"
          trendUp={true}
          description="from last week"
        />
        <MetricCard
          title="Active Alarms"
          value={metrics.activeAlarms}
          icon={AlertTriangle}
          alert={metrics.activeAlarms > 0}
          description={`${metrics.criticalAlarms} critical`}
        />
        <MetricCard
          title="Network Uptime"
          value={`${metrics.networkUptime}%`}
          icon={Activity}
          trend="Target: 99.99%"
          description="Last 30 days"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>OLT Status Distribution</CardTitle>
            <CardDescription>Current operational state of all OLT devices</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={oltStatusData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} />
                <Tooltip 
                  cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                  contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px'}}
                  itemStyle={{color: 'hsl(var(--foreground))'}}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {oltStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Recent Alarms</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            <div className="flex flex-col">
              {recentAlarms.map((alarm) => (
                <AlarmRow key={alarm.id} alarm={alarm} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
