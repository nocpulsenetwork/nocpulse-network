import React, { useState } from 'react';
import { alarms, Alarm } from '@/data/mockData';
import { AlarmRow } from '@/components/AlarmRow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';

export default function AlarmCenter() {
  const [localAlarms, setLocalAlarms] = useState<Alarm[]>(alarms);

  const handleAcknowledge = (id: string) => {
    setLocalAlarms(current => 
      current.map(a => a.id === id ? { ...a, acknowledged: true } : a)
    );
  };

  const activeAlarms = localAlarms.filter(a => !a.acknowledged);
  const criticalCount = activeAlarms.filter(a => a.severity === 'Critical').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alarm Center</h1>
          <p className="text-muted-foreground">Monitor and acknowledge system alerts.</p>
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
          <TabsTrigger 
            value="active" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-2"
          >
            Active Alarms
            <span className="ml-2 rounded-full bg-primary/20 text-primary px-2 py-0.5 text-xs font-bold">
              {activeAlarms.length}
            </span>
          </TabsTrigger>
          <TabsTrigger 
            value="critical"
            className="data-[state=active]:border-b-2 data-[state=active]:border-destructive rounded-none px-6 py-2"
          >
            Critical
            {criticalCount > 0 && (
              <span className="ml-2 rounded-full bg-destructive text-destructive-foreground px-2 py-0.5 text-xs font-bold">
                {criticalCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="history"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-2"
          >
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="m-0">
          <Card>
            <CardContent className="p-0">
              {activeAlarms.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No active alarms. System is healthy.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {activeAlarms.map((alarm) => (
                    <AlarmRow key={alarm.id} alarm={alarm} onAcknowledge={handleAcknowledge} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="critical" className="m-0">
          <Card>
            <CardContent className="p-0">
              {criticalCount === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No critical alarms.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {activeAlarms.filter(a => a.severity === 'Critical').map((alarm) => (
                    <AlarmRow key={alarm.id} alarm={alarm} onAcknowledge={handleAcknowledge} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="m-0">
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col divide-y divide-border">
                {localAlarms.filter(a => a.acknowledged).map((alarm) => (
                  <AlarmRow key={alarm.id} alarm={alarm} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
