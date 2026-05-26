import { useState } from 'react';
import {
  BellRing, Send, AlertTriangle, XCircle,
  CheckCircle2, Activity, Server, Cpu, PackageX, Lock,
  Eye, EyeOff, RefreshCw, Info,
  Clock, Zap, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface NotificationRule {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  enabled: boolean;
  channel: 'Telegram' | 'Email' | 'Both';
  cooldownMin: number;
}

interface RecentNotif {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  channel: 'Telegram' | 'Email';
  delivered: boolean;
  device: string;
}

const RECENT: RecentNotif[] = [
  { id: 'n1', timestamp: '2026-05-22T10:07:00Z', type: 'Critical Alarm', message: 'OLT-West-02 — Power failure detected. BGP session down.', channel: 'Telegram', delivered: true, device: 'OLT-West-02' },
  { id: 'n2', timestamp: '2026-05-22T10:12:00Z', type: 'ONU Offline', message: 'ONU-003 (Global Logistics) went offline — signal lost.', channel: 'Telegram', delivered: true, device: 'ONU-003' },
  { id: 'n3', timestamp: '2026-05-22T09:35:00Z', type: 'High CPU', message: 'OLT-West-01 CPU at 89% sustained for 15 minutes.', channel: 'Email', delivered: true, device: 'OLT-West-01' },
  { id: 'n4', timestamp: '2026-05-22T09:30:00Z', type: 'Packet Loss', message: 'ONU-009 (Valley High School) packet loss 8.2% — threshold exceeded.', channel: 'Telegram', delivered: false, device: 'ONU-009' },
  { id: 'n5', timestamp: '2026-05-21T22:15:00Z', type: 'OLT Back Online', message: 'OLT-Core-01 recovered after scheduled maintenance window.', channel: 'Telegram', delivered: true, device: 'OLT-Core-01' },
  { id: 'n6', timestamp: '2026-05-21T18:05:00Z', type: 'Low RX Signal', message: 'ONU-002 (Global Logistics) RX power dropped to -30.1 dBm.', channel: 'Email', delivered: true, device: 'ONU-002' },
];

export default function NotificationCenter() {
  const [showToken, setShowToken] = useState(false);
  const [botLinked] = useState(true);
  const [rules, setRules] = useState<NotificationRule[]>([
    { id: 'r1', label: 'OLT Offline', description: 'Alert when any OLT stops responding to keep-alive', icon: Server, iconColor: 'text-red-400', enabled: true, channel: 'Both', cooldownMin: 5 },
    { id: 'r2', label: 'ONU Offline', description: 'Alert when an ONU goes offline for more than 2 minutes', icon: Cpu, iconColor: 'text-amber-400', enabled: true, channel: 'Telegram', cooldownMin: 3 },
    { id: 'r3', label: 'Critical Alarm', description: 'Immediate alert for any Critical severity alarm', icon: XCircle, iconColor: 'text-red-400', enabled: true, channel: 'Both', cooldownMin: 0 },
    { id: 'r4', label: 'Major Alarm', description: 'Alert for Major severity alarms on OLTs and ONUs', icon: AlertTriangle, iconColor: 'text-amber-400', enabled: true, channel: 'Telegram', cooldownMin: 10 },
    { id: 'r5', label: 'Packet Loss', description: 'Alert when packet loss exceeds 5% for more than 1 minute', icon: PackageX, iconColor: 'text-orange-400', enabled: false, channel: 'Email', cooldownMin: 15 },
    { id: 'r6', label: 'Low RX Signal', description: 'Alert when ONU RX power drops below -28 dBm threshold', icon: Activity, iconColor: 'text-blue-400', enabled: true, channel: 'Telegram', cooldownMin: 30 },
    { id: 'r7', label: 'OLT High CPU', description: 'Alert when OLT CPU usage exceeds 85% for 10+ minutes', icon: Zap, iconColor: 'text-yellow-400', enabled: false, channel: 'Email', cooldownMin: 20 },
    { id: 'r8', label: 'ONU Back Online', description: 'Notify when an offline ONU reconnects', icon: CheckCircle2, iconColor: 'text-green-400', enabled: true, channel: 'Telegram', cooldownMin: 0 },
  ]);

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const enabledCount = rules.filter(r => r.enabled).length;
  const deliveredCount = RECENT.filter(n => n.delivered).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Center</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure alert channels and manage notification rules
          </p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs">
          <Send className="h-3.5 w-3.5" /> Send Test Alert
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Rules', value: enabledCount, icon: BellRing, color: 'text-primary', border: 'border-primary/20', bg: 'bg-primary/5' },
          { label: 'Sent Today', value: RECENT.filter(n => n.timestamp.startsWith('2026-05-22')).length, icon: Send, color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/5' },
          { label: 'Delivery Rate', value: `${Math.round((deliveredCount / RECENT.length) * 100)}%`, icon: CheckCircle2, color: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-500/5' },
          { label: 'Failed', value: RECENT.filter(n => !n.delivered).length, icon: XCircle, color: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-500/5' },
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

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Channels */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Channels</h2>

          {/* Telegram */}
          <div className={`rounded-xl border p-4 space-y-4 ${botLinked ? 'border-green-500/30 bg-green-500/5' : 'border-border/60 bg-card/60'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#229ED9]/15 border border-[#229ED9]/30 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-[#40B3E0]" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Telegram Bot</p>
                  <p className="text-[10px] text-muted-foreground">@NOCpulse_Alerts_Bot</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold ${botLinked ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${botLinked ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                {botLinked ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bot Token</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-8 rounded-lg border border-border/60 bg-muted/30 px-3 flex items-center gap-2">
                  <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-mono text-muted-foreground flex-1">
                    {showToken ? '7234891023:AAHxyz_DEMO_TOKEN_PLACEHOLDER_abc' : '••••••••••••••••••••••••••••••••••'}
                  </span>
                  <button onClick={() => setShowToken(s => !s)} className="text-muted-foreground hover:text-foreground">
                    {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Chat / Group ID</label>
              <div className="h-8 rounded-lg border border-border/60 bg-muted/30 px-3 flex items-center">
                <span className="text-xs font-mono text-muted-foreground">-1001234567890</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-xs h-8 gap-1.5">
                <Send className="h-3 w-3" /> Test
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs h-8 gap-1.5">
                <RefreshCw className="h-3 w-3" /> Reconnect
              </Button>
            </div>

            <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded-lg p-2.5">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              Alerts will be sent to the configured group. Use /start in the bot DM to activate.
            </div>
          </div>

          {/* Email */}
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Send className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Email (SMTP)</p>
                  <p className="text-[10px] text-muted-foreground">noc-alerts@isp.net</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold bg-green-500/10 text-green-400 border-green-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Active
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recipients</label>
              <div className="space-y-1.5">
                {['john.doe@isp.net', 'sarah.chen@isp.net', 'noc-team@isp.net'].map(email => (
                  <div key={email} className="h-7 rounded border border-border/40 bg-muted/20 px-3 flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">{email}</span>
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-xs h-8 gap-1.5">
                <Send className="h-3 w-3" /> Test
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs h-8 gap-1.5 opacity-50 cursor-not-allowed" disabled>
                Edit
              </Button>
            </div>

            <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded-lg p-2.5">
              <Lock className="h-3 w-3 shrink-0 mt-0.5" />
              SMTP credentials managed by system. Contact Super Admin to update.
            </div>
          </div>
        </div>

        {/* Right: Rules + Recent */}
        <div className="lg:col-span-3 space-y-6">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Notification Rules</h2>
            <div className="space-y-2">
              {rules.map(rule => {
                const Icon = rule.icon;
                return (
                  <div
                    key={rule.id}
                    className={`rounded-xl border p-3.5 flex items-center gap-3 transition-all ${rule.enabled ? 'border-border/60 bg-card/60' : 'border-border/30 bg-muted/10 opacity-60'}`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${rule.enabled ? 'bg-muted/50 border border-border/40' : 'bg-muted/20 border border-border/20'}`}>
                      <Icon className={`h-4 w-4 ${rule.enabled ? rule.iconColor : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{rule.label}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border/40 font-mono">
                          {rule.channel}
                        </span>
                        {rule.cooldownMin > 0 && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {rule.cooldownMin}m cooldown
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{rule.description}</p>
                    </div>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => toggleRule(rule.id)}
                      className="shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Notifications */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Recent Notifications</h2>
            <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
              {RECENT.map(notif => (
                <div key={notif.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                  <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${notif.delivered ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    {notif.delivered
                      ? <CheckCircle2 className="h-3 w-3 text-green-400" />
                      : <XCircle className="h-3 w-3 text-red-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{notif.type}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${notif.channel === 'Telegram' ? 'bg-[#229ED9]/10 text-[#40B3E0] border-[#229ED9]/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                        {notif.channel}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{notif.device}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{notif.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                    {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
