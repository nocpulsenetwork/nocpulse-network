import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Eye, EyeOff, Lock, RefreshCw, ShieldCheck, Shield,
  Key, Server, Copy, CheckCircle2, AlertTriangle, Info
} from 'lucide-react';

interface OltCredential {
  id: string;
  name: string;
  ip: string;
  protocol: 'SSH' | 'Telnet' | 'SNMP';
  username: string;
  verified: boolean;
  lastVerified: string;
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

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showSnmp, setShowSnmp] = useState(false);
  const [showSshKey, setShowSshKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  const togglePassword = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleVerify = (id: string) => {
    setVerifying(id);
    setTimeout(() => setVerifying(null), 2000);
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage dashboard preferences and system configuration</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel of NOCpulse.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Dark Mode</Label>
              <p className="text-sm text-muted-foreground">Enable dark mode for low-light NOC environments.</p>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Configure how you receive alerts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Sound Alerts</Label>
              <p className="text-sm text-muted-foreground">Play a sound when a critical alarm triggers.</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Desktop Notifications</Label>
              <p className="text-sm text-muted-foreground">Show browser notifications for new alarms.</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* OLT Credential Security */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Shield className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <CardTitle>OLT Credential Security</CardTitle>
              <CardDescription>Stored device credentials — Super Admin access required to modify</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Security notice */}
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-400/90 leading-relaxed">
              <span className="font-bold">Credential access is logged.</span> All views, copies, and modifications are recorded in Activity Logs and attributed to your account. Credentials are encrypted at rest.
            </div>
          </div>

          {/* Per-OLT credentials table */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Device Credentials</p>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border/60">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Device</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Protocol</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Username</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</th>
                      <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5" />
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
                            <button
                              onClick={() => togglePassword(cred.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPasswords[cred.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {cred.verified ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-green-500/10 text-green-400 border-green-500/20 text-[10px] font-bold">
                                <ShieldCheck className="h-2.5 w-2.5" /> OK
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20 text-[10px] font-bold">
                              <AlertTriangle className="h-2.5 w-2.5" /> Unreachable
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => handleVerify(cred.id)}
                            disabled={verifying === cred.id}
                          >
                            {verifying === cred.id
                              ? <RefreshCw className="h-3 w-3 animate-spin" />
                              : <RefreshCw className="h-3 w-3" />
                            }
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
              Last verification timestamps shown on hover. Passwords shown here are masked by default.
            </p>
          </div>

          {/* SNMP Community */}
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

          {/* SSH Key */}
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
                  ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDExamplePublicKeyPlaceholderForNOCpulseSystem
                  NOCpulse-key@isp-noc-prod
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

          {/* Secure Reconnect */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Secure Reconnect</p>
            <div className="space-y-2">
              {OLT_CREDS.filter(c => !c.verified).map(cred => (
                <div key={cred.id} className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-red-400" />
                    <div>
                      <p className="text-xs font-medium">{cred.name}</p>
                      <p className="text-[10px] text-muted-foreground">{cred.lastVerified}</p>
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
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between border-b pb-2">
            <span>Version</span>
            <span className="font-mono">v1.0.4-stable</span>
          </div>
          <div className="flex justify-between border-b py-2">
            <span>Last Update</span>
            <span className="font-mono">2026-05-22 08:30 UTC</span>
          </div>
          <div className="flex justify-between border-b py-2">
            <span>OLTs Monitored</span>
            <span className="font-mono font-semibold text-foreground">11</span>
          </div>
          <div className="flex justify-between pt-2">
            <span>Server</span>
            <span className="font-mono text-green-500">Connected</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
