import { useState } from 'react';
import {
  Stethoscope, Signal, Wifi, WifiOff, PackageX, AlertTriangle,
  CheckCircle2, XCircle, AlertCircle, Lightbulb, RefreshCw,
  ChevronDown, ChevronUp, Router, Thermometer, Activity,
  ArrowRight, Clock, Zap, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Severity = 'Critical' | 'Major' | 'Minor' | 'OK';

interface DiagCard {
  id: string;
  severity: Severity;
  category: string;
  device: string;
  description: string;
  metric: string;
  threshold: string;
  duration: string;
  tips: string[];
  detail: string;
}

const DIAG_CARDS: DiagCard[] = [
  {
    id: 'd1',
    severity: 'Critical',
    category: 'Low RX Signal',
    device: 'ONU-003 (Global Logistics)',
    description: 'RX power critically low — link instability expected',
    metric: '-30.1 dBm',
    threshold: 'Threshold: -28 dBm',
    duration: 'Detected 47 mins ago',
    detail: 'Signal has been consistently below acceptable threshold. Customer reported intermittent internet drops. PON-2 port on OLT-North-01 is the upstream source.',
    tips: [
      'Inspect fiber splice at the customer premises entry point',
      'Clean SC/APC optical connectors on the ONU and OLT side',
      'Check for excessive bend radius in the drop cable',
      'Verify upstream splitter ratio — may need 1:8 → 1:4 upgrade',
    ],
  },
  {
    id: 'd2',
    severity: 'Critical',
    category: 'OLT Offline',
    device: 'OLT-West-02',
    description: 'OLT unreachable — power failure reported',
    metric: '0% uptime',
    threshold: 'Since 08:15',
    duration: 'Offline for 2h 10m',
    detail: 'OLT-West-02 stopped responding to ICMP and SNMP polls at 08:14. BGP session with upstream router also dropped simultaneously, indicating a power or physical layer failure. 78 ONUs are affected.',
    tips: [
      'Verify physical power supply at the OLT rack',
      'Check UPS status — check for battery failure or overload',
      'Contact on-site NOC to perform physical check',
      'Activate failover routing for affected downstream ONUs if available',
    ],
  },
  {
    id: 'd3',
    severity: 'Major',
    category: 'Packet Loss',
    device: 'ONU-009 (Valley High School)',
    description: 'Packet loss 8.2% — significantly above normal',
    metric: '8.2% loss',
    threshold: 'Threshold: 2%',
    duration: 'Detected 1h 22m ago',
    detail: 'Packet loss started at approximately 09:00 and has not recovered. Upstream OLT (OLT-Core-02) shows normal statistics, suggesting the issue is in the last-mile drop segment.',
    tips: [
      'Run traceroute and ping flood test from OLT side',
      'Check for impedance mismatch at the fiber patch panel',
      'Verify ONU firmware is current — flash if outdated',
      'Check customer router for high CPU or broadcast storms',
    ],
  },
  {
    id: 'd4',
    severity: 'Major',
    category: 'High CPU',
    device: 'OLT-West-01',
    description: 'CPU sustained at 89% for extended period',
    metric: '89% CPU',
    threshold: 'Threshold: 80%',
    duration: 'Sustained 1h 55m',
    detail: 'CPU usage has remained above 85% since 08:30. This level of sustained CPU may indicate a control-plane loop, spanning-tree reconvergence, or excessive IGMP/DHCP traffic. Performance degradation for all 47 attached ONUs is likely.',
    tips: [
      'Review IGMP snooping configuration — potential multicast storm',
      'Check DHCP pool for rapid churn or rogue DHCP server',
      'Audit spanning-tree topology for unexpected port state changes',
      'Schedule OLT reload during off-peak hours if no other fix found',
    ],
  },
  {
    id: 'd5',
    severity: 'Major',
    category: 'ONU Instability',
    device: 'ONU-007 (Bakery Shop)',
    description: 'TX power low and 3 disconnections in last 6 hours',
    metric: '0.8 dBm TX',
    threshold: 'Threshold: 1.5 dBm',
    duration: '3 events today',
    detail: 'The ONU has logged 3 disconnection events in the past 6 hours, each lasting 2-4 minutes. TX power is consistently reading low which can indicate a failing laser module or a loose connector.',
    tips: [
      'Replace ONU laser if TX power is confirmed < 1 dBm',
      'Clean and reseat the fiber connector on the ONU SC/APC port',
      'Check if customer is exposing the ONU to direct sunlight or heat',
      'Schedule preventive ONU swap during next field visit',
    ],
  },
  {
    id: 'd6',
    severity: 'Minor',
    category: 'Low RX Signal',
    device: 'ONU-021 (Community Center)',
    description: 'RX signal slightly degraded — monitoring',
    metric: '-26.8 dBm',
    threshold: 'Threshold: -28 dBm',
    duration: 'Trending down 3 days',
    detail: 'Signal has been trending downward by ~0.3 dBm per day over the last 3 days. Not yet at critical level but the trend suggests a developing fiber issue. No customer complaints received yet.',
    tips: [
      'Schedule fiber inspection before signal reaches critical threshold',
      'Check for vegetation encroachment on aerial fiber runs',
      'Review splice loss at the distribution box near the premises',
    ],
  },
  {
    id: 'd7',
    severity: 'Minor',
    category: 'Router Instability',
    device: 'Customer: Sunrise Apartments',
    description: 'Customer CPE rebooting frequently — 5 reboots today',
    metric: '5 reboots',
    threshold: 'Normal: 0-1/day',
    duration: 'Since 07:00',
    detail: 'The customer router at Sunrise Apartments has been rebooting multiple times. This could indicate a power supply issue, firmware bug, or the router is being overwhelmed by traffic from the building LAN.',
    tips: [
      'Verify router power adapter output voltage is stable',
      'Check router firmware — update to latest stable version',
      'Review connected device count — may need higher-tier CPE',
      'Check for overheating — ensure proper ventilation at the router location',
    ],
  },
  {
    id: 'd8',
    severity: 'Minor',
    category: 'Fiber Issue',
    device: 'PON-2 — OLT-North-01',
    description: 'Elevated optical loss on splitter port 4',
    metric: '+2.8 dB excess loss',
    threshold: 'Normal: < 1 dB',
    duration: 'Flagged in last poll',
    detail: 'OTDR-equivalent data from SNMP polling shows port 4 on the 1:8 splitter serving residential area North-B has 2.8 dB excess insertion loss. This affects 3 ONUs on that split.',
    tips: [
      'Clean splitter output connectors — dust can add 1-3 dB loss',
      'Check for water ingress in the splice enclosure',
      'Consider OTDR test from central office to isolate fault location',
    ],
  },
];

const HEALTHY_CHECKS = [
  { label: 'OLT-Core-01 signal levels', value: 'All ONUs within range' },
  { label: 'OLT-South-01 CPU', value: '42% — Normal' },
  { label: 'Packet loss — Core network', value: '0.01% — Excellent' },
  { label: 'OLT-East-01 uptime', value: '32 days — Stable' },
  { label: 'Fiber path integrity — East zone', value: 'No anomalies detected' },
];

const SEV_CONFIG: Record<Severity, { border: string; bg: string; icon: React.ElementType; iconColor: string; badgeCls: string; label: string }> = {
  Critical: { border: 'border-l-red-500', bg: 'bg-red-500/5', icon: XCircle, iconColor: 'text-red-400', badgeCls: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Critical' },
  Major: { border: 'border-l-amber-500', bg: 'bg-amber-500/5', icon: AlertTriangle, iconColor: 'text-amber-400', badgeCls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Major' },
  Minor: { border: 'border-l-blue-500', bg: 'bg-blue-500/5', icon: AlertCircle, iconColor: 'text-blue-400', badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Minor' },
  OK: { border: 'border-l-green-500', bg: 'bg-green-500/5', icon: CheckCircle2, iconColor: 'text-green-400', badgeCls: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'Healthy' },
};

const CAT_ICONS: Record<string, React.ElementType> = {
  'Low RX Signal': Signal,
  'OLT Offline': WifiOff,
  'Packet Loss': PackageX,
  'High CPU': Zap,
  'ONU Instability': Activity,
  'Router Instability': Router,
  'Fiber Issue': Stethoscope,
};

function DiagnosticCard({ card }: { card: DiagCard }) {
  const [expanded, setExpanded] = useState(card.severity === 'Critical');
  const cfg = SEV_CONFIG[card.severity];
  const SevIcon = cfg.icon;
  const CatIcon = CAT_ICONS[card.category] ?? AlertCircle;

  return (
    <div className={`rounded-xl border border-border/60 border-l-4 ${cfg.border} ${cfg.bg} backdrop-blur-sm overflow-hidden`}>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <SevIcon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.iconColor}`} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{card.device}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${cfg.badgeCls}`}>
                  {card.severity}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-muted/40 text-muted-foreground border-border/40 text-[10px] font-bold uppercase tracking-wider">
                  <CatIcon className="h-2.5 w-2.5" />
                  {card.category}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{card.description}</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-4 pl-7 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card/60 border border-border/50">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-bold font-mono">{card.metric}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">{card.threshold}</span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {card.duration}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/40 bg-muted/10 p-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Diagnosis</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{card.detail}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Recommended Actions</p>
            </div>
            <div className="space-y-1.5">
              {card.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="h-4 w-4 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-[9px] font-bold text-amber-400 shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-xs text-muted-foreground">{tip}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5">
              <ArrowRight className="h-3 w-3" /> View Device
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5 text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" /> Mark Resolved
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SmartDiagnostics() {
  const [lastScan] = useState('10:24:11 AM');
  const critical = DIAG_CARDS.filter(c => c.severity === 'Critical');
  const major = DIAG_CARDS.filter(c => c.severity === 'Major');
  const minor = DIAG_CARDS.filter(c => c.severity === 'Minor');

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Diagnostics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automated network health analysis with root-cause detection and fix recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            Last scan: {lastScan}
          </div>
          <Button size="sm" className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Run Scan
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Critical Issues', value: critical.length, icon: XCircle, color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/5' },
          { label: 'Major Issues', value: major.length, icon: AlertTriangle, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
          { label: 'Minor Issues', value: minor.length, icon: AlertCircle, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/5' },
          { label: 'Healthy Checks', value: HEALTHY_CHECKS.length, icon: CheckCircle2, color: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/5' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-xl border ${stat.border} ${stat.bg} p-4 flex items-center gap-3`}>
              <div className={`h-9 w-9 rounded-lg bg-card/60 flex items-center justify-center border ${stat.border}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Network health score */}
      <div className="rounded-xl border border-border/60 bg-card/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Overall Network Health</span>
          </div>
          <span className="text-xs text-muted-foreground">Score based on active issues</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-amber-400">64%</div>
          <div className="flex-1">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500 opacity-30" />
              <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-amber-500 -mt-3 w-[64%]" />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Critical</span>
              <span>Degraded</span>
              <span>Healthy</span>
            </div>
          </div>
          <span className="text-sm font-bold text-amber-400 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            Degraded
          </span>
        </div>
      </div>

      {/* Critical issues */}
      {critical.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-red-400">
            <XCircle className="h-4 w-4" /> Critical Issues ({critical.length})
          </h2>
          {critical.map(card => <DiagnosticCard key={card.id} card={card} />)}
        </div>
      )}

      {/* Major issues */}
      {major.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-amber-400">
            <AlertTriangle className="h-4 w-4" /> Major Issues ({major.length})
          </h2>
          {major.map(card => <DiagnosticCard key={card.id} card={card} />)}
        </div>
      )}

      {/* Minor issues */}
      {minor.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-blue-400">
            <AlertCircle className="h-4 w-4" /> Minor Issues ({minor.length})
          </h2>
          {minor.map(card => <DiagnosticCard key={card.id} card={card} />)}
        </div>
      )}

      {/* Healthy checks */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-green-400">
          <CheckCircle2 className="h-4 w-4" /> Healthy Checks
        </h2>
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 overflow-hidden divide-y divide-green-500/10">
          {HEALTHY_CHECKS.map((check, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                <span className="text-sm text-muted-foreground">{check.label}</span>
              </div>
              <span className="text-xs font-medium text-green-400">{check.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
