import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useRole } from '@/contexts/RoleContext';
import { RoleGuard } from '@/components/RoleGuard';
import { olts, onus } from '@/data/mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Eye, EyeOff, Lock, RefreshCw, ShieldCheck, Shield,
  Key, Server, Copy, CheckCircle2, AlertTriangle, Info,
  Database, Cpu, Globe, Bell, MessageCircle, Clock,
  Activity, Zap, Wifi, WifiOff, Layers, Send, ChevronDown,
  Monitor, Moon, Sun, BarChart3, HardDrive, Crown, Users,
} from 'lucide-react';

interface OltCredential {
  id: string; name: string; ip: string;
  protocol: 'SSH' | 'Telnet' | 'SNMP';
  username: string; verified: boolean; lastVerified: string;
}

const OLT_CREDS: OltCredential[] = [
  { id: 'olt-01', name: 'OLT-Core-01', ip: '10.0.1.1', protocol: 'SSH', username: 'noc_admin', verified: true, lastVerified: '2026-05-22 08:58' },
  { id: 'olt-03', name: 'OLT-South-01', ip: '10.0.3.1', protocol: 'SSH', username: 'noc_admin', verified: true, lastVerified: '2026-05-21 22:00' },
  { id: 'olt-05', name: 'OLT-West-02', ip: '10.0.5.1', protocol: 'SSH', username: 'admin', verified: false, lastVerified: '2026-05-22 08:14 (offline)' },
  { id: 'olt-07', name: 'OLT-West-01', ip: '10.0.7.1', protocol: 'SNMP', username: 'noc_read', verified: true, lastVerified: '2026-05-22 10:00' },
  { id: 'olt-09', name: 'OLT-Core-01 (backup)', ip: '10.0.9.1', protocol: 'SSH', username: 'noc_admin', verified: true, lastVerified: '2026-05-21 23:58' },
];

function MaskedPassword({ show }: { show: boolean }) {
  return (
    <span className="font-mono text-muted-foreground text-xs">
      {show ? 'NOCp@ssw0rd!2024' : '••••••••••••••••'}
    </span>
  );
}

function SectionCard({ title, description, icon: Icon, iconColor = 'text-primary', borderColor = 'border-border/60', children }: {
  title: string; description?: string; icon: React.ElementType;
  iconColor?: string; borderColor?: string; children: React.ReactNode;
}) {
  return (
    <Card className={`border ${borderColor}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-center">
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
      <div className="space-y-0.5 pr-4">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

const BACKEND_SERVICES = [
  { id: 'api', label: 'API Server', desc: 'REST API for OLT/ONU data', status: 'Placeholder', icon: Server, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  { id: 'db', label: 'Database', desc: 'PostgreSQL / primary store', status: 'Placeholder', icon: Database, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  { id: 'engine', label: 'Monitoring Engine', desc: 'SNMP + ICMP polling daemon', status: 'Placeholder', icon: Activity, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  { id: 'ws', label: 'WebSocket', desc: 'Real-time push updates', status: 'Placeholder', icon: Zap, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  { id: 'queue', label: 'Queue System', desc: 'Background job processor', status: 'Placeholder', icon: Layers, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  { id: 'otdr', label: 'OTDR Module', desc: 'Optical analysis engine', status: 'Not Configured', icon: BarChart3, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
];

const TIMEZONES = [
  'UTC', 'UTC+5:30 (IST)', 'UTC+7 (ICT)', 'UTC+8 (PHT/SGT)', 'UTC+9 (JST/KST)',
  'UTC+3 (AST)', 'UTC+4 (GST)', 'UTC+2 (EET)', 'UTC+1 (CET)', 'UTC-5 (EST)',
];

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { isSuperAdmin, canAdminister: _unused } = useRole();
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showSnmp, setShowSnmp] = useState(false);
  const [showSshKey, setShowSshKey] = useState(false);
  const [showTgToken, setShowTgToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [tgTestSent, setTgTestSent] = useState(false);
  const [timezone, setTimezone] = useState('UTC+8 (PHT/SGT)');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD HH:mm');

  // Alert threshold states
  const [rxCritical, setRxCritical] = useState(-28);
  const [rxWarn, setRxWarn] = useState(-25);
  const [cpuCritical, setCpuCritical] = useState(85);
  const [memCritical, setMemCritical] = useState(90);
  const [lossWarn, setLossWarn] = useState(2);
  const [lossCritical, setLossCritical] = useState(5);

  // Notification toggles
  const [notifSounds, setNotifSounds] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(true);
  const [notifTelegram, setNotifTelegram] = useState(false);
  const [notifLevel, setNotifLevel] = useState<'Critical' | 'Major' | 'Minor' | 'All'>('Major');

  const togglePassword = (id: string) => setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  const handleVerify = (id: string) => { setVerifying(id); setTimeout(() => setVerifying(null), 2000); };
  const handleCopy = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const handleTgTest = () => { setTgTestSent(true); setTimeout(() => setTgTestSent(false), 3000); };

  const { canAdminister, isViewer, role } = useRole();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">System configuration, integrations, and security settings</p>
      </div>

      {/* Role access notice for non-admin users */}
      {!canAdminister && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
          isViewer
            ? 'bg-slate-500/5 border-slate-500/20 text-slate-400'
            : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
        }`}>
          <Lock className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">
              {isViewer ? 'Read-Only View' : 'Limited Access'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isViewer
                ? 'You have view-only access. Settings cannot be changed with the Viewer role.'
                : 'NOC Engineers can view settings but cannot modify credentials or system configuration. Contact an Admin for changes.'}
            </p>
          </div>
        </div>
      )}

      {/* ── BACKEND PREPARATION STATUS ── */}
      <SectionCard title="Backend Integration Status" description="Connection readiness for NOCpulse API and services" icon={HardDrive} iconColor="text-primary">
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            Frontend-only mode is active. Connect the NOCpulse backend to enable live monitoring, real-time SNMP polling, alarm push notifications, and data persistence.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BACKEND_SERVICES.map(svc => {
              const Icon = svc.icon;
              return (
                <div key={svc.id} className={`rounded-xl border ${svc.border} ${svc.bg} p-3.5 flex items-center justify-between gap-3`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-8 w-8 rounded-lg bg-card/60 border ${svc.border} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 ${svc.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{svc.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{svc.desc}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${svc.color} ${svc.border} bg-transparent`}>
                    {svc.status === 'Placeholder' ? (
                      <><WifiOff className="h-2.5 w-2.5" /> Not Connected</>
                    ) : (
                      <><AlertTriangle className="h-2.5 w-2.5" /> {svc.status}</>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" disabled>
              <RefreshCw className="h-3.5 w-3.5" /> Check All Connections
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" disabled>
              <Server className="h-3.5 w-3.5" /> Configure API Endpoint
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ── APPEARANCE ── */}
      <SectionCard title="Appearance" description="Customize the look and feel of NOCpulse" icon={Monitor} iconColor="text-primary">
        <div className="space-y-1">
          <SettingRow label="Color Theme" description="Choose dark mode for low-light NOC environments">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${theme === 'light' ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:bg-muted/30'}`}
              >
                <Sun className="h-3.5 w-3.5" /> Light
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${theme === 'dark' ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:bg-muted/30'}`}
              >
                <Moon className="h-3.5 w-3.5" /> Dark
              </button>
            </div>
          </SettingRow>
          <SettingRow label="Compact Density" description="Use tighter spacing to show more data on screen">
            <Switch defaultChecked={false} />
          </SettingRow>
          <SettingRow label="Show Animations" description="Enable transitions and animated indicators">
            <Switch defaultChecked />
          </SettingRow>
        </div>
      </SectionCard>

      {/* ── TIMEZONE & REGIONAL ── */}
      <SectionCard title="Timezone & Regional" description="Configure how timestamps are displayed across the dashboard" icon={Globe} iconColor="text-cyan-400">
        <div className="space-y-1">
          <SettingRow label="Server Timezone" description="All alarm timestamps and logs use this timezone">
            <div className="relative">
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="h-9 pr-8 pl-3 rounded-lg border border-border/60 bg-background text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 cursor-pointer"
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </SettingRow>
          <SettingRow label="Date Format" description="How dates are displayed in tables and logs">
            <div className="relative">
              <select
                value={dateFormat}
                onChange={e => setDateFormat(e.target.value)}
                className="h-9 pr-8 pl-3 rounded-lg border border-border/60 bg-background text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 cursor-pointer"
              >
                {['YYYY-MM-DD HH:mm', 'DD/MM/YYYY HH:mm', 'MM/DD/YYYY hh:mm A', 'Relative (X mins ago)'].map(f => <option key={f}>{f}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </SettingRow>
          <SettingRow label="24-Hour Clock" description="Use 24-hour format instead of AM/PM">
            <Switch defaultChecked />
          </SettingRow>
        </div>
      </SectionCard>

      {/* ── ALERT THRESHOLDS ── */}
      <SectionCard title="Alert Thresholds" description="Configure signal levels and metrics that trigger alarms" icon={BarChart3} iconColor="text-amber-400" borderColor="border-amber-500/20">
        <div className="space-y-5">
          {/* RX Signal thresholds */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">RX Signal Power (dBm)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Warning Threshold', val: rxWarn, set: setRxWarn, min: -35, max: -15, color: 'text-amber-400', bar: 'bg-amber-500', desc: 'Alarms trigger when RX drops below this level' },
                { label: 'Critical Threshold', val: rxCritical, set: setRxCritical, min: -40, max: -20, color: 'text-red-400', bar: 'bg-red-500', desc: 'Critical alarms trigger below this level' },
              ].map(t => (
                <div key={t.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{t.label}</span>
                    <span className={`text-sm font-bold font-mono ${t.color}`}>{t.val} dBm</span>
                  </div>
                  <input type="range" min={t.min} max={t.max} value={t.val}
                    onChange={e => t.set(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer h-1.5" />
                  <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CPU / Memory */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">OLT Resource Thresholds</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'CPU Critical', val: cpuCritical, set: setCpuCritical, color: 'text-red-400', unit: '%' },
                { label: 'Memory Critical', val: memCritical, set: setMemCritical, color: 'text-red-400', unit: '%' },
              ].map(t => (
                <div key={t.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{t.label}</span>
                    <span className={`text-sm font-bold font-mono ${t.color}`}>{t.val}{t.unit}</span>
                  </div>
                  <input type="range" min={50} max={100} value={t.val}
                    onChange={e => t.set(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer h-1.5" />
                </div>
              ))}
            </div>
          </div>

          {/* Packet loss */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Packet Loss Thresholds</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Warning', val: lossWarn, set: setLossWarn, color: 'text-amber-400', max: 10 },
                { label: 'Critical', val: lossCritical, set: setLossCritical, color: 'text-red-400', max: 20 },
              ].map(t => (
                <div key={t.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{t.label}</span>
                    <span className={`text-sm font-bold font-mono ${t.color}`}>{t.val}%</span>
                  </div>
                  <input type="range" min={0} max={t.max} value={t.val}
                    onChange={e => t.set(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer h-1.5" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Save Thresholds
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-8 text-muted-foreground">
              Reset to Defaults
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ── NOTIFICATIONS ── */}
      <SectionCard title="Notifications" description="Configure how NOCpulse delivers alerts to your team" icon={Bell} iconColor="text-primary">
        <div className="space-y-1">
          <SettingRow label="Sound Alerts" description="Play audio alert when a critical alarm fires">
            <Switch checked={notifSounds} onCheckedChange={setNotifSounds} />
          </SettingRow>
          <SettingRow label="Desktop Notifications" description="Show browser push notification for new alarms">
            <Switch checked={notifDesktop} onCheckedChange={setNotifDesktop} />
          </SettingRow>
          <SettingRow label="Telegram Alerts" description="Forward alarms to a Telegram bot">
            <Switch checked={notifTelegram} onCheckedChange={setNotifTelegram} />
          </SettingRow>
          <SettingRow label="Minimum Alert Level" description="Only send notifications for alarms at or above this severity">
            <div className="flex items-center gap-1">
              {(['Critical', 'Major', 'Minor', 'All'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setNotifLevel(lvl)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                    notifLevel === lvl
                      ? lvl === 'Critical' ? 'bg-red-500 text-white border-red-500' :
                        lvl === 'Major' ? 'bg-amber-500 text-white border-amber-500' :
                        lvl === 'Minor' ? 'bg-blue-500 text-white border-blue-500' :
                        'bg-primary text-primary-foreground border-primary'
                      : 'border-border/60 text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </SettingRow>
        </div>
      </SectionCard>

      {/* ── TELEGRAM INTEGRATION ── */}
      <SectionCard title="Telegram Bot Configuration" description="Send real-time alarm alerts to a Telegram chat or group" icon={MessageCircle} iconColor="text-cyan-400" borderColor="border-cyan-500/20">
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-xs text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
            Create a Telegram bot via <span className="text-cyan-400 font-mono">@BotFather</span>, paste the token below, then add the bot to your NOC Telegram group and enter the Chat ID.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bot Token</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type={showTgToken ? 'text' : 'password'}
                  defaultValue="7012345678:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full h-9 pl-9 pr-9 rounded-lg border border-border/60 bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
                <button onClick={() => setShowTgToken(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showTgToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chat ID / Group ID</label>
              <input
                type="text"
                defaultValue="-100198765432"
                className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message Format</label>
            <textarea
              rows={3}
              defaultValue="🚨 [{severity}] {device}\n{description}\nTime: {timestamp}\nView: {link}"
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
            />
            <p className="text-[10px] text-muted-foreground">Variables: {'{'}<span className="font-mono">severity, device, description, timestamp, link</span>{'}'}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Save Config
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={`text-xs h-8 gap-1.5 ${tgTestSent ? 'text-green-400 border-green-500/30' : 'text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10'}`}
              onClick={handleTgTest}
            >
              {tgTestSent ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {tgTestSent ? 'Test Sent!' : 'Send Test Message'}
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ── OLT CREDENTIAL SECURITY ── */}
      {!isSuperAdmin && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Shield className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <CardTitle>OLT Credential Security</CardTitle>
                <CardDescription className="text-xs">Stored device credentials — Super Admin access required to modify</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <Lock className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-400">Super Admin Access Required</p>
                <p className="text-xs text-muted-foreground mt-0.5">OLT device credentials are only visible and editable by Super Admins. Contact your administrator for access.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {isSuperAdmin && <Card className="border-amber-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Shield className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <CardTitle>OLT Credential Security</CardTitle>
              <CardDescription className="text-xs">Stored device credentials — Super Admin access required to modify</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-400/90 leading-relaxed">
              <span className="font-bold">Credential access is logged.</span> All views, copies, and modifications are recorded in Activity Logs and attributed to your account. Credentials are encrypted at rest using AES-256.
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Device Credentials</p>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border/60">
                    <tr>
                      {['Device', 'Protocol', 'Username', 'Password', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {OLT_CREDS.map(cred => (
                      <tr key={cred.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-semibold">{cred.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{cred.ip}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${
                            cred.protocol === 'SSH' ? 'bg-primary/10 text-primary border-primary/20' :
                            cred.protocol === 'SNMP' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {cred.protocol}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">{cred.username}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <MaskedPassword show={!!showPasswords[cred.id]} />
                            <button onClick={() => togglePassword(cred.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                              {showPasswords[cred.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {cred.verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-green-500/10 text-green-400 border-green-500/20 text-[10px] font-bold">
                              <ShieldCheck className="h-2.5 w-2.5" /> OK
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20 text-[10px] font-bold">
                                <AlertTriangle className="h-2.5 w-2.5" /> Unreachable
                              </span>
                              <p className="text-[9px] text-muted-foreground mt-0.5">Reconnect required after password change</p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => handleVerify(cred.id)} disabled={verifying === cred.id}>
                            <RefreshCw className={`h-3 w-3 ${verifying === cred.id ? 'animate-spin' : ''}`} />
                            Verify
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3 w-3" />
              Passwords shown here are masked by default. Access is recorded in Activity Logs.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SNMP Community String</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-9 rounded-lg border border-border/60 bg-muted/20 px-3 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-mono flex-1 text-muted-foreground">
                  {showSnmp ? 'noc_snmp_r3ad_0nly!' : '••••••••••••••••••'}
                </span>
                <button onClick={() => setShowSnmp(s => !s)} className="text-muted-foreground hover:text-foreground">
                  {showSnmp ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs" onClick={handleCopy}>
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SSH Public Key</p>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">RSA-4096 · Generated 2024-01-01</span>
                </div>
                <button onClick={() => setShowSshKey(s => !s)} className="text-muted-foreground hover:text-foreground transition-colors">
                  {showSshKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {showSshKey ? (
                <pre className="text-[10px] font-mono text-muted-foreground break-all whitespace-pre-wrap bg-background rounded p-2 border border-border/40">
                  ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDExamplePublicKeyPlaceholderForNOCpulseSystem{'\n'}NOCpulse-key@isp-noc-prod
                </pre>
              ) : (
                <div className="h-8 rounded bg-background border border-border/40 flex items-center px-3">
                  <span className="text-xs font-mono text-muted-foreground">ssh-rsa AAAA••••••••••••••••••••••</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5 flex-1">
                  <RefreshCw className="h-3 w-3" /> Regenerate Key
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5 flex-1" onClick={handleCopy}>
                  <Copy className="h-3 w-3" /> Copy Public Key
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 shrink-0 mt-0.5 text-green-400" />
              Key is deployed to all reachable OLTs. Regenerating requires re-deployment to each device.
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Offline / Unreachable Devices</p>
            {OLT_CREDS.filter(c => !c.verified).map(cred => (
              <div key={cred.id} className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                <div className="flex items-center gap-2">
                  <Server className="h-3.5 w-3.5 text-red-400" />
                  <div>
                    <p className="text-xs font-medium">{cred.name}</p>
                    <p className="text-[10px] text-muted-foreground">{cred.lastVerified}</p>
                    <p className="text-[9px] text-red-400/80 mt-0.5">Password change may require manual reconnect</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5 border-red-500/20 hover:bg-red-500/10 text-red-400">
                  <RefreshCw className="h-3 w-3" /> Reconnect
                </Button>
              </div>
            ))}
            {OLT_CREDS.every(c => c.verified) && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/20 bg-green-500/5 text-xs text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All OLT connections verified and healthy
              </div>
            )}
          </div>
        </CardContent>
      </Card>}

      {/* ── RESOURCE LIMITS (Super Admin only) ── */}
      {isSuperAdmin && (
        <SectionCard title="Resource Limits" description="Provisioned capacity and current usage across your infrastructure" icon={Crown} iconColor="text-amber-400" borderColor="border-amber-500/20">
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400/80">
              <Crown className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
              Resource limits are tied to your NOCpulse license. Contact your account manager to expand capacity.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">OLT Devices</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono">{olts.length}</span>
                    <span className="text-sm text-muted-foreground font-mono">/ 20</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(olts.length / 20) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{20 - olts.length} slots remaining</p>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Staff Accounts</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono">7</span>
                    <span className="text-sm text-muted-foreground font-mono">/ 25</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${(7 / 25) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">18 accounts remaining</p>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">ONU Devices</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono">{onus.length}</span>
                    <span className="text-sm text-green-400 font-bold font-mono">/ ∞</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: '30%' }} />
                  </div>
                  <p className="text-[10px] text-green-400">No ONU limit — unrestricted capacity</p>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── DATA RETENTION ── */}
      <SectionCard title="Data Retention" description="Configure how long historical data is stored" icon={Clock} iconColor="text-muted-foreground">
        <div className="space-y-1">
          {[
            { label: 'Alarm History', val: '90 days', note: 'Acknowledged + resolved alarms' },
            { label: 'Activity Logs', val: '30 days', note: 'Staff actions and system events' },
            { label: 'Signal History', val: '7 days', note: 'Per-ONU RX/TX power readings' },
            { label: 'OLT Poll Logs', val: '3 days', note: 'Raw SNMP polling responses' },
          ].map(r => (
            <SettingRow key={r.label} label={r.label} description={r.note}>
              <span className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border/50">{r.val}</span>
            </SettingRow>
          ))}
          <div className="pt-2">
            <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5 opacity-60" disabled>
              <Info className="h-3.5 w-3.5" /> Configure Retention — Backend Required
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ── SYSTEM INFO ── */}
      <SectionCard title="System Information" icon={Activity} iconColor="text-green-400">
        <div className="space-y-0">
          {[
            { label: 'NOCpulse Version', val: 'v1.0.4-stable', mono: true },
            { label: 'Build Date', val: '2026-05-22 08:30 UTC', mono: true },
            { label: 'OLTs Monitored', val: '11', mono: true, highlight: true },
            { label: 'ONUs Tracked', val: '247', mono: true, highlight: true },
            { label: 'Frontend Mode', val: 'Demo (No Backend)', mono: false },
            { label: 'API Status', val: 'Not Connected', mono: false, dim: true },
          ].map(r => (
            <SettingRow key={r.label} label={r.label}>
              <span className={`text-sm ${r.mono ? 'font-mono' : ''} ${r.highlight ? 'font-semibold text-foreground' : r.dim ? 'text-muted-foreground' : ''}`}>
                {r.val}
              </span>
            </SettingRow>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
