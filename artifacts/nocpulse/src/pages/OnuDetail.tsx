import React from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { onus, olts } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { 
  Signal, 
  Radio, 
  Ruler, 
  Clock, 
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// Generate some dummy bandwidth data
const generateBandwidthData = () => {
  return Array.from({ length: 24 }).map((_, i) => ({
    time: `${i}:00`,
    download: Math.floor(Math.random() * 800) + 200,
    upload: Math.floor(Math.random() * 300) + 50,
  }));
};

const bandwidthData = generateBandwidthData();

const mockLogs = [
  { time: '10 mins ago', level: 'INFO', event: 'Config pushed', details: 'Updated traffic profile successfully' },
  { time: '1 hour ago', level: 'INFO', event: 'Admin login', details: 'Web interface accessed by admin' },
  { time: '5 hours ago', level: 'WARN', event: 'Signal fluctuation', details: 'RX power dropped by 2dBm temporarily' },
  { time: '2 days ago', level: 'INFO', event: 'DHCP lease obtained', details: 'IP assigned to client device' },
  { time: '2 days ago', level: 'INFO', event: 'Signal check passed', details: 'Optical link established' },
  { time: '2 days ago', level: 'INFO', event: 'ONU registered', details: 'Device authenticated with OLT' },
];

export default function OnuDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const id = params?.id;
  const onu = onus.find(o => o.id === id);

  if (!onu) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold">ONU not found</h2>
        <p className="text-muted-foreground">The requested ONU does not exist or has been removed.</p>
        <Button onClick={() => setLocation('/onus')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to ONU List
        </Button>
      </div>
    );
  }

  const parentOlt = olts.find(o => o.id === onu.oltId);
  const isPoorSignal = onu.signalLevel < -28;
  const isWarningSignal = onu.signalLevel >= -28 && onu.signalLevel < -25;
  
  const getLossRateColor = (rateStr: string) => {
    const rate = parseFloat(rateStr);
    if (rate > 5) return 'text-red-500';
    if (rate > 1) return 'text-amber-500';
    return 'text-green-500';
  };

  const getLogBadge = (level: string) => {
    switch (level) {
      case 'ERROR': return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">ERROR</Badge>;
      case 'WARN': return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">WARN</Badge>;
      case 'INFO': default: return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">INFO</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-muted-foreground mb-4">
        <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
        <span className="mx-2">/</span>
        <Link href="/onus" className="hover:text-foreground transition-colors">ONU Management</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{onu.onuNo}</span>
      </div>

      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight font-mono">{onu.onuNo}</h1>
            <StatusBadge status={onu.status} className="text-sm px-2.5 py-0.5" />
          </div>
          <p className="text-muted-foreground mt-1 text-lg">{onu.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setLocation('/onus')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to ONU List
          </Button>
          <Button 
            variant="outline" 
            className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20"
            onClick={() => toast.success(`Reboot command sent to ${onu.onuNo}`)}
          >
            Reboot
          </Button>
          <Button 
            variant="outline" 
            className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20"
            onClick={() => toast.success(`ONU disabled`)}
          >
            Disable
          </Button>
        </div>
      </div>

      {/* Section 1: Signal Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-border/50 border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start pb-2">
              <p className="text-sm font-medium text-muted-foreground">RX Power</p>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Signal className="h-5 w-5" />
              </div>
            </div>
            <div className={`text-3xl font-bold tracking-tight mt-2 ${isPoorSignal ? 'text-red-500' : isWarningSignal ? 'text-amber-500' : 'text-green-500'}`}>
              {onu.signalLevel} <span className="text-lg font-normal text-muted-foreground">dBm</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-border/50 border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start pb-2">
              <p className="text-sm font-medium text-muted-foreground">TX Power</p>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <Radio className="h-5 w-5" />
              </div>
            </div>
            <div className={`text-3xl font-bold tracking-tight mt-2 ${onu.txPower < -3 || onu.txPower > 5 ? 'text-red-500' : 'text-green-500'}`}>
              {onu.txPower} <span className="text-lg font-normal text-muted-foreground">dBm</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 border-l-4 border-l-cyan-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start pb-2">
              <p className="text-sm font-medium text-muted-foreground">Distance</p>
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500">
                <Ruler className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight mt-2">
              {onu.distance.replace(' km', '')} <span className="text-lg font-normal text-muted-foreground">km</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start pb-2">
              <p className="text-sm font-medium text-muted-foreground">Online Duration</p>
              <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className={`text-2xl font-bold tracking-tight mt-2 ${onu.status === 'Offline' ? 'text-muted-foreground' : 'text-foreground'}`}>
              {onu.onlineDuration}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Section 2: ONU Information */}
        <Card className="md:col-span-1 shadow-sm border-border/50 flex flex-col">
          <CardHeader>
            <CardTitle>Hardware Details</CardTitle>
            <CardDescription>Identity and network binding</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">ONU MAC</p>
                <p className="font-mono text-xs font-medium bg-muted p-1 rounded inline-block">{onu.macAddress}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Client MAC</p>
                <p className="font-mono text-xs font-medium bg-muted p-1 rounded inline-block">{onu.clientMac}</p>
              </div>
              
              <div>
                <p className="text-muted-foreground mb-1">Parent OLT</p>
                <Link href="/olts" className="text-primary hover:underline font-medium">
                  {parentOlt?.name || onu.oltId}
                </Link>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">PON Port</p>
                <p className="font-medium">{onu.ponPort}</p>
              </div>

              <div>
                <p className="text-muted-foreground mb-1">Bandwidth Limit</p>
                <p className="font-medium">{onu.bandwidth}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Customer</p>
                <p className="font-medium">{onu.customerName}</p>
              </div>

              <div className="col-span-2 pt-2">
                <Separator className="mb-4" />
              </div>

              <div>
                <p className="text-muted-foreground mb-1">Last Logout</p>
                <p className={`font-medium ${onu.lastLogoutTime === 'N/A' ? 'text-muted-foreground' : ''}`}>{onu.lastLogoutTime}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Logout Reason</p>
                <p className="font-medium">{onu.lastLogoutReason}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6 flex flex-col">
          {/* Section 3: Live Bandwidth Usage */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Live Bandwidth Usage</CardTitle>
                <CardDescription>Real-time data will appear when connected to backend</CardDescription>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">DEMO DATA</Badge>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bandwidthData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px'}}
                    itemStyle={{color: 'hsl(var(--foreground))'}}
                  />
                  <Area type="monotone" dataKey="download" stroke="hsl(var(--chart-1))" strokeWidth={2} fillOpacity={1} fill="url(#colorDownload)" name="Download (Mbps)" />
                  <Area type="monotone" dataKey="upload" stroke="hsl(var(--chart-2))" strokeWidth={2} fillOpacity={1} fill="url(#colorUpload)" name="Upload (Mbps)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Section 4: Packet Loss */}
            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Packet Statistics</CardTitle>
                <CardDescription>Placeholder — connect to backend for live data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center mt-2">
                  <div className="bg-muted/30 p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">TX Packets</p>
                    <p className="font-semibold font-mono text-sm">1,248,392</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">RX Packets</p>
                    <p className="font-semibold font-mono text-sm">1,247,891</p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg border border-green-500/20">
                    <p className="text-xs text-muted-foreground mb-1">Loss Rate</p>
                    <p className={`font-semibold font-mono text-sm ${getLossRateColor("0.04")}`}>0.04%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Solution Tips */}
            <Card className={`shadow-sm border ${
              isPoorSignal ? 'border-red-500/30 bg-red-500/5' : 
              onu.status === 'Offline' ? 'border-amber-500/30 bg-amber-500/5' : 
              'border-green-500/30 bg-green-500/5'
            }`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  {isPoorSignal ? (
                    <><AlertCircle className="h-5 w-5 text-red-500" /> Poor Signal Quality</>
                  ) : onu.status === 'Offline' ? (
                    <><AlertTriangle className="h-5 w-5 text-amber-500" /> Device Offline</>
                  ) : (
                    <><CheckCircle2 className="h-5 w-5 text-green-500" /> All Systems Normal</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2 text-muted-foreground">
                  {isPoorSignal ? (
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Check fiber splice quality and bend radius</li>
                      <li>Clean all optical connectors</li>
                      <li>Verify upstream splitters</li>
                    </ul>
                  ) : onu.status === 'Offline' ? (
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Verify customer premises power supply</li>
                      <li>Check upstream OLT port status</li>
                      <li>Run remote ping diagnostic</li>
                    </ul>
                  ) : (
                    <p className="text-foreground">No active issues detected. Signal parameters are within operational tolerances.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Section 6: Event Logs */}
      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle>Recent Event Logs</CardTitle>
          <CardDescription>System and hardware events for this terminal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Timestamp</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Level</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Event</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mockLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{log.time}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{getLogBadge(log.level)}</td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{log.event}</td>
                      <td className="px-4 py-3">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}