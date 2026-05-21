import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { olts, onus } from '@/data/mockData';
import { Server, Router } from 'lucide-react';

export default function DeviceDiagram() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Device Diagram</h1>
        <p className="text-muted-foreground">Logical network topology</p>
      </div>

      <Card className="min-h-[600px] overflow-x-auto bg-card border">
        <CardContent className="p-8">
          <div className="flex flex-col items-center min-w-[800px]">
            {/* Core */}
            <div className="flex flex-col items-center mb-12">
              <div className="h-16 w-32 bg-primary/20 border-2 border-primary rounded-lg flex items-center justify-center font-bold text-primary shadow-lg shadow-primary/20">
                CORE ROUTER
              </div>
              <div className="w-0.5 h-12 bg-border"></div>
              <div className="w-full max-w-4xl h-0.5 bg-border relative">
                {/* Distribution lines down to OLTs */}
              </div>
            </div>

            {/* OLTs */}
            <div className="flex justify-center gap-12 flex-wrap">
              {olts.slice(0, 4).map((olt) => {
                const connectedOnus = onus.filter(o => o.oltId === olt.id);
                const statusColor = olt.status === 'Online' ? 'text-green-500 border-green-500/50 bg-green-500/10' : 
                                   olt.status === 'Offline' ? 'text-destructive border-destructive/50 bg-destructive/10' :
                                   'text-amber-500 border-amber-500/50 bg-amber-500/10';

                return (
                  <div key={olt.id} className="flex flex-col items-center">
                    <div className="w-0.5 h-8 bg-border mb-2 -mt-12"></div>
                    <div className={`p-4 rounded-xl border-2 flex flex-col items-center w-40 text-center ${statusColor}`}>
                      <Server className="w-8 h-8 mb-2" />
                      <span className="font-bold text-sm truncate w-full">{olt.name}</span>
                      <span className="text-xs opacity-80 font-mono">{olt.ip}</span>
                    </div>
                    
                    {/* ONU connections */}
                    {connectedOnus.length > 0 && (
                      <>
                        <div className="w-0.5 h-8 bg-border"></div>
                        <div className="flex gap-2">
                          {connectedOnus.slice(0, 3).map((onu, idx) => (
                            <div key={onu.id} className="flex flex-col items-center">
                              {idx > 0 && <div className="absolute w-4 h-0.5 bg-border -ml-5 mt-2"></div>}
                              <div className="w-0.5 h-4 bg-border"></div>
                              <div 
                                className={`w-8 h-8 rounded border flex items-center justify-center
                                  ${onu.status === 'Online' ? 'border-green-500/50 bg-green-500/10 text-green-500' : 'border-destructive/50 bg-destructive/10 text-destructive'}`}
                                title={onu.macAddress}
                              >
                                <Router className="w-4 h-4" />
                              </div>
                            </div>
                          ))}
                          {connectedOnus.length > 3 && (
                            <div className="flex flex-col items-center">
                              <div className="w-0.5 h-4 bg-border"></div>
                              <div className="text-xs text-muted-foreground pt-1 px-2">+{connectedOnus.length - 3}</div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
