import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { type Alarm, NOC_STAFF, type NocStaff } from '@/data/mockData';
import { useApiData } from '@/contexts/ApiDataContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import {
  XCircle, AlertTriangle, AlertCircle, Info, CheckCircle2, Bell,
  RefreshCw, RotateCcw, ChevronDown, ChevronUp, Clock,
  User, AlertOctagon, Activity, ShieldCheck, ShieldAlert,
} from 'lucide-react';

const VERIFICATION_DELAY_MS = 8000;

type VerificationStatus = 'Active' | 'Verifying' | 'Resolved' | 'Re-opened';

interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  actorRole?: string;
  note?: string;
  type: 'trigger' | 'acknowledge' | 'verify_start' | 'verify_pass' | 'verify_fail' | 'reopen' | 'info';
}

interface EnrichedAlarm extends Alarm {
  verificationStatus: VerificationStatus;
  resolvedBy?: NocStaff;
  resolvedAt?: number;
  verificationDeadline?: number;
  reopenCount: number;
  history: HistoryEntry[];
}

function shouldResolveOnVerification(alarm: EnrichedAlarm): boolean {
  if (alarm.severity === 'Critical') return alarm.reopenCount >= 1;
  if (alarm.severity === 'Major') {
    const code = alarm.id.charCodeAt(alarm.id.length - 1);
    return code % 2 === 0 || alarm.reopenCount >= 1;
  }
  return true;
}

function buildInitialHistory(alarm: Alarm): HistoryEntry[] {
  const base: HistoryEntry[] = [{
    id: `${alarm.id}-h0`,
    timestamp: alarm.timestamp,
    action: 'Alarm triggered',
    actor: 'System',
    type: 'trigger',
  }];
  if (alarm.acknowledged) {
    const ackTime = new Date(new Date(alarm.timestamp).getTime() + 900000).toISOString();
    const vTime = new Date(new Date(alarm.timestamp).getTime() + 908000).toISOString();
    const rTime = new Date(new Date(alarm.timestamp).getTime() + 916000).toISOString();
    base.push(
      { id: `${alarm.id}-h1`, timestamp: ackTime, action: 'Acknowledged', actor: NOC_STAFF[0].name, actorRole: NOC_STAFF[0].role, type: 'acknowledge' },
      { id: `${alarm.id}-h2`, timestamp: vTime, action: 'Auto-verification started', actor: 'System', type: 'verify_start' },
      { id: `${alarm.id}-h3`, timestamp: rTime, action: 'Verification passed — issue confirmed resolved', actor: 'System (Auto-Verify)', type: 'verify_pass' },
    );
  }
  return base;
}

function StaffAvatar({ initials }: { initials: string }) {
  return (
    <div className="h-5 w-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-[9px] text-primary shrink-0">
      {initials}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Alarm['severity'] }) {
  const cls = {
    Critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    Major: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Minor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Info: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  }[severity];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
      {severity}
    </span>
  );
}

function VerifStatusBadge({ status, secondsLeft }: { status: VerificationStatus; secondsLeft?: number }) {
  if (status === 'Active') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20 text-[10px] font-bold uppercase tracking-wider">
      <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
      Unresolved
    </span>
  );
  if (status === 'Verifying') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
      <RefreshCw className="h-2.5 w-2.5 animate-spin" />
      Verifying{secondsLeft !== undefined ? ` · ${secondsLeft}s` : ''}
    </span>
  );
  if (status === 'Resolved') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-green-500/10 text-green-400 border-green-500/30 text-[10px] font-bold uppercase tracking-wider">
      <ShieldCheck className="h-2.5 w-2.5" />
      Resolved
    </span>
  );
  if (status === 'Re-opened') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/30 text-[10px] font-bold uppercase tracking-wider">
      <RotateCcw className="h-2.5 w-2.5" />
      Re-opened
    </span>
  );
  return null;
}

function HistoryEntryIcon({ type }: { type: HistoryEntry['type'] }) {
  const cfg: Record<HistoryEntry['type'], { icon: React.ElementType; cls: string }> = {
    trigger: { icon: AlertOctagon, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    acknowledge: { icon: CheckCircle2, cls: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
    verify_start: { icon: RefreshCw, cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    verify_pass: { icon: ShieldCheck, cls: 'text-green-400 bg-green-500/10 border-green-500/20' },
    verify_fail: { icon: ShieldAlert, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    reopen: { icon: RotateCcw, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    info: { icon: Info, cls: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  };
  const { icon: Icon, cls } = cfg[type];
  return (
    <div className={`h-6 w-6 rounded-full border flex items-center justify-center shrink-0 ${cls}`}>
      <Icon className="h-3 w-3" />
    </div>
  );
}

function AlarmCard({
  alarm,
  tick,
  viewed,
  onAcknowledge,
  onView,
}: {
  alarm: EnrichedAlarm;
  tick: number;
  viewed?: boolean;
  onAcknowledge?: (id: string, staffId: string) => void;
  onView?: () => void;
}) {
  const [, navigate] = useLocation();
  const deviceHref = alarm.deviceId.startsWith('onu-')
    ? `/onus/${alarm.deviceId}`
    : alarm.deviceId.startsWith('olt-')
    ? `/olts/${alarm.deviceId}`
    : null;
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    setExpanded(e => !e);
    if (!expanded) onView?.();
  };
  const [acknowledging, setAcknowledging] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(NOC_STAFF[0].id);

  const isActionable = alarm.verificationStatus === 'Active' || alarm.verificationStatus === 'Re-opened';

  const secondsLeft = alarm.verificationStatus === 'Verifying' && alarm.verificationDeadline
    ? Math.max(0, Math.ceil((alarm.verificationDeadline - Date.now()) / 1000))
    : undefined;

  const verifyProgress = alarm.verificationStatus === 'Verifying' && alarm.verificationDeadline
    ? Math.min(100, Math.max(0, ((VERIFICATION_DELAY_MS - (alarm.verificationDeadline - Date.now())) / VERIFICATION_DELAY_MS) * 100))
    : 0;

  const severityStyles = {
    Critical: { border: 'border-l-red-500', bg: isActionable ? 'bg-red-500/5' : 'bg-card/50', icon: XCircle, iconColor: 'text-red-400' },
    Major: { border: 'border-l-amber-500', bg: isActionable ? 'bg-amber-500/5' : 'bg-card/50', icon: AlertTriangle, iconColor: 'text-amber-400' },
    Minor: { border: 'border-l-blue-500', bg: isActionable ? 'bg-blue-500/5' : 'bg-card/50', icon: AlertCircle, iconColor: 'text-blue-400' },
    Info: { border: 'border-l-slate-500', bg: 'bg-card/50', icon: Info, iconColor: 'text-slate-400' },
  };
  const sty = severityStyles[alarm.severity];
  const SevIcon = sty.icon;

  const handleConfirm = () => {
    onAcknowledge?.(alarm.id, selectedStaff);
    setAcknowledging(false);
  };

  return (
    <div
      className={`rounded-xl border border-l-4 backdrop-blur-sm shadow-sm overflow-hidden transition-all duration-200 ${
        alarm.verificationStatus === 'Resolved'
          ? 'border-green-500/20 border-l-green-500/50 bg-green-500/[0.03]'
          : `border-border/60 ${sty.border} ${sty.bg}`
      } ${deviceHref ? 'cursor-pointer' : ''}`}
      onClick={() => { if (deviceHref) navigate(deviceHref); }}
    >
      <div className="p-4 space-y-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <SevIcon className={`h-4 w-4 shrink-0 mt-0.5 ${sty.iconColor}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-semibold text-sm ${deviceHref ? 'group-hover:text-primary' : ''}`}>
                  {alarm.deviceName}
                </span>
                <SeverityBadge severity={alarm.severity} />
                <VerifStatusBadge status={alarm.verificationStatus} secondsLeft={secondsLeft} />
                {alarm.reopenCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20 text-[10px] font-bold">
                    <RotateCcw className="h-2.5 w-2.5" />{alarm.reopenCount}x reopened
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{alarm.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            {viewed && !isActionable && (
              <span className="px-2 py-0.5 rounded border bg-slate-500/10 text-slate-400 border-slate-500/20 text-[10px] font-bold uppercase tracking-wider">
                Viewed
              </span>
            )}
            {isActionable && onAcknowledge && !acknowledging && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAcknowledging(true)}
                className="text-xs h-8 border-primary/30 hover:bg-primary/10 hover:text-primary gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleToggle}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Acknowledge inline form */}
        {acknowledging && (
          <div className="ml-7 p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">Acknowledging alarm</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger className="h-8 w-52 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOC_STAFF.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-primary/20 text-[9px] font-bold text-primary flex items-center justify-center">{s.initials}</span>
                        {s.name} — {s.role}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleConfirm}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAcknowledging(false)}>
                Cancel
              </Button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              Auto-verification will run {VERIFICATION_DELAY_MS / 1000}s after acknowledgement — alarm will be re-triggered if issue persists
            </div>
          </div>
        )}

        {/* Verifying progress section */}
        {alarm.verificationStatus === 'Verifying' && (
          <div className="ml-7 space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[11px] text-amber-400 font-medium">
                Auto-verification in progress — rechecking system state
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {secondsLeft !== undefined ? `${secondsLeft}s remaining` : ''}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-1000"
                style={{ width: `${verifyProgress}%` }}
              />
            </div>
            {alarm.resolvedBy && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <StaffAvatar initials={alarm.resolvedBy.initials} />
                <span className="text-[11px] text-muted-foreground">
                  Acknowledged by <span className="text-foreground font-medium">{alarm.resolvedBy.name}</span>
                  <span className="text-muted-foreground/60"> · {alarm.resolvedBy.role}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Re-opened warning */}
        {alarm.verificationStatus === 'Re-opened' && (
          <div className="ml-7 flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-red-400">
                Issue persists — alarm re-triggered by system
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Auto-verification detected the condition still exists. Requires re-acknowledgement from NOC staff.
              </p>
            </div>
          </div>
        )}

        {/* Resolved confirmation strip */}
        {alarm.verificationStatus === 'Resolved' && alarm.resolvedBy && (
          <div className="ml-7 flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-green-400 shrink-0" />
            <span className="text-[11px] text-green-400">
              Verified clear by system
            </span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <StaffAvatar initials={alarm.resolvedBy.initials} />
            <span className="text-[11px] text-muted-foreground">
              Resolved by <span className="text-foreground font-medium">{alarm.resolvedBy.name}</span>
            </span>
          </div>
        )}

        {/* Footer meta row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-7">
          <Bell className="h-3 w-3" />
          <span>{new Date(alarm.timestamp).toLocaleString()}</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true })}</span>
          {alarm.reopenCount > 0 && (
            <>
              <span>·</span>
              <span className="text-red-400 font-medium">{alarm.reopenCount} reopen{alarm.reopenCount > 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      </div>

      {/* Expanded history timeline */}
      {expanded && (
        <div className="border-t border-border/50 bg-muted/10 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Alarm History
            </span>
            <span className="text-[10px] text-muted-foreground">{alarm.history.length} events</span>
          </div>
          <div className="space-y-0">
            {alarm.history.map((entry, idx) => (
              <div key={entry.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <HistoryEntryIcon type={entry.type} />
                  {idx < alarm.history.length - 1 && (
                    <div className="w-0.5 h-5 bg-border/50 my-0.5" />
                  )}
                </div>
                <div className="pb-4 min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-tight">{entry.action}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {entry.actor !== 'System' && entry.actor !== 'System (Auto-Verify)' && (
                      <span className="h-4 w-4 rounded-full bg-primary/20 text-[8px] font-bold text-primary flex items-center justify-center">
                        {entry.actor.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground font-medium">{entry.actor}</span>
                    {entry.actorRole && (
                      <span className="text-[10px] text-muted-foreground/50">({entry.actorRole})</span>
                    )}
                    {entry.note && (
                      <span className="text-[10px] text-primary/70 italic">"{entry.note}"</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
      <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

export default function AlarmCenter() {
  const { alarms: apiAlarms } = useApiData();
  const [tick, setTick] = useState(0);
  const [enriched, setEnriched] = useState<EnrichedAlarm[]>(() =>
    apiAlarms.map(a => ({
      ...a,
      verificationStatus: (a.acknowledged ? 'Resolved' : 'Active') as VerificationStatus,
      resolvedBy: a.acknowledged ? NOC_STAFF[0] : undefined,
      resolvedAt: a.acknowledged ? Date.now() - 3600000 : undefined,
      reopenCount: 0,
      history: buildInitialHistory(a),
    }))
  );
  useEffect(() => {
    setEnriched(apiAlarms.map(a => ({
      ...a,
      verificationStatus: (a.acknowledged ? 'Resolved' : 'Active') as VerificationStatus,
      resolvedBy: a.acknowledged ? NOC_STAFF[0] : undefined,
      resolvedAt: a.acknowledged ? Date.now() - 3600000 : undefined,
      reopenCount: 0,
      history: buildInitialHistory(a),
    })));
  }, [apiAlarms]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
      setEnriched(prev => {
        const now = Date.now();
        const hasExpired = prev.some(
          a => a.verificationStatus === 'Verifying' && a.verificationDeadline && now >= a.verificationDeadline
        );
        if (!hasExpired) return prev;

        return prev.map(alarm => {
          if (alarm.verificationStatus !== 'Verifying' || !alarm.verificationDeadline) return alarm;
          if (now < alarm.verificationDeadline) return alarm;

          const passes = shouldResolveOnVerification(alarm);
          const nowIso = new Date(now).toISOString();

          if (passes) {
            return {
              ...alarm,
              verificationStatus: 'Resolved' as const,
              verificationDeadline: undefined,
              history: [
                ...alarm.history,
                {
                  id: `${alarm.id}-vpass-${now}`,
                  timestamp: nowIso,
                  action: 'Verification passed — issue confirmed resolved',
                  actor: 'System (Auto-Verify)',
                  type: 'verify_pass' as const,
                },
              ],
            };
          } else {
            return {
              ...alarm,
              verificationStatus: 'Re-opened' as const,
              verificationDeadline: undefined,
              acknowledged: false,
              reopenCount: alarm.reopenCount + 1,
              history: [
                ...alarm.history,
                {
                  id: `${alarm.id}-vfail-${now}`,
                  timestamp: nowIso,
                  action: 'Verification failed — issue still detected by system',
                  actor: 'System (Auto-Verify)',
                  type: 'verify_fail' as const,
                },
                {
                  id: `${alarm.id}-reopen-${now}`,
                  timestamp: nowIso,
                  action: `Alarm re-opened (occurrence ${alarm.reopenCount + 1})`,
                  actor: 'System',
                  type: 'reopen' as const,
                },
              ],
            };
          }
        });
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleAcknowledge = (id: string, staffId: string) => {
    const staff = NOC_STAFF.find(s => s.id === staffId) ?? NOC_STAFF[0];
    const deadline = Date.now() + VERIFICATION_DELAY_MS;
    const nowIso = new Date().toISOString();

    setEnriched(prev => prev.map(a => {
      if (a.id !== id) return a;
      return {
        ...a,
        acknowledged: true,
        verificationStatus: 'Verifying' as const,
        resolvedBy: staff,
        resolvedAt: Date.now(),
        verificationDeadline: deadline,
        history: [
          ...a.history,
          {
            id: `${a.id}-ack-${Date.now()}`,
            timestamp: nowIso,
            action: 'Acknowledged',
            actor: staff.name,
            actorRole: staff.role,
            type: 'acknowledge' as const,
          },
          {
            id: `${a.id}-vs-${Date.now()}`,
            timestamp: nowIso,
            action: `Auto-verification scheduled in ${VERIFICATION_DELAY_MS / 1000}s`,
            actor: 'System',
            type: 'verify_start' as const,
          },
        ],
      };
    }));
  };

  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const markViewed = (id: string) => setViewedIds(prev => new Set([...prev, id]));

  const [severityFilter, setSeverityFilter] = useState<'All' | 'Critical' | 'Major' | 'Minor' | 'Info'>('All');

  const sortByTime = (arr: EnrichedAlarm[]) =>
    [...arr].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const bySev = (arr: EnrichedAlarm[]) =>
    severityFilter === 'All' ? arr : arr.filter(a => a.severity === severityFilter);

  const active = enriched.filter(a => a.verificationStatus === 'Active' || a.verificationStatus === 'Re-opened');
  const verifying = enriched.filter(a => a.verificationStatus === 'Verifying');
  const resolved = enriched.filter(a => a.verificationStatus === 'Resolved');
  const inProgressCount = verifying.length;

  const criticalCount = active.filter(a => a.severity === 'Critical').length;
  const majorCount = active.filter(a => a.severity === 'Major').length;
  const minorCount = active.filter(a => a.severity === 'Minor').length;
  const infoCount = enriched.filter(a => a.severity === 'Info').length;
  const reopenedCount = active.filter(a => a.verificationStatus === 'Re-opened').length;

  const allActiveAndVerifying = [...active, ...verifying];

  // Sorted + filtered display slices
  const displayAll      = bySev(sortByTime(allActiveAndVerifying));
  const displayCritical = sortByTime(allActiveAndVerifying).filter(a => a.severity === 'Critical');
  const displayWarning  = sortByTime(allActiveAndVerifying).filter(a => a.severity === 'Major' || a.severity === 'Minor');
  const displayVerify   = bySev(sortByTime(verifying));
  const displayInfo     = sortByTime(enriched.filter(a => a.severity === 'Info'));
  const displayResolved = bySev(sortByTime(resolved));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alarm Center</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enterprise NOC alarm management with automated verification
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-border/60 rounded-lg px-3 py-2">
          <RefreshCw className="h-3 w-3" />
          Auto-verify: {VERIFICATION_DELAY_MS / 1000}s after acknowledgement
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-2 flex-wrap p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <XCircle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-xs font-semibold text-red-400">{criticalCount} Critical</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">{majorCount} Major</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <AlertCircle className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-blue-400">{minorCount} Minor</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400">{infoCount} Info</span>
        </div>
        {verifying.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 animate-pulse">
            <RefreshCw className="h-3.5 w-3.5 text-amber-400 animate-spin" />
            <span className="text-xs font-semibold text-amber-400">{verifying.length} Verifying</span>
          </div>
        )}
        {reopenedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30">
            <RotateCcw className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs font-semibold text-red-400">{reopenedCount} Re-opened</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
          <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
          <span className="text-xs font-semibold text-green-400">{resolved.length} Resolved</span>
        </div>
      </div>

      {/* Severity filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Filter:</span>
        {([
          { v: 'All',      label: 'All',      cls: 'border-primary/40 text-primary bg-primary/10',          inactive: 'border-border/40 text-muted-foreground hover:border-primary/20 hover:text-primary' },
          { v: 'Critical', label: 'Critical', cls: 'border-red-500/40 text-red-400 bg-red-500/10',           inactive: 'border-border/40 text-muted-foreground hover:border-red-500/30 hover:text-red-400' },
          { v: 'Major',    label: 'Major',    cls: 'border-amber-500/40 text-amber-400 bg-amber-500/10',     inactive: 'border-border/40 text-muted-foreground hover:border-amber-500/30 hover:text-amber-400' },
          { v: 'Minor',    label: 'Minor',    cls: 'border-blue-500/40 text-blue-400 bg-blue-500/10',        inactive: 'border-border/40 text-muted-foreground hover:border-blue-500/30 hover:text-blue-400' },
          { v: 'Info',     label: 'Info',     cls: 'border-slate-500/40 text-slate-400 bg-slate-500/10',     inactive: 'border-border/40 text-muted-foreground hover:border-slate-500/30 hover:text-slate-400' },
        ] as const).map(({ v, label, cls, inactive }) => (
          <button
            key={v}
            onClick={() => setSeverityFilter(v)}
            className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${severityFilter === v ? cls : inactive}`}
          >
            {label}
          </button>
        ))}
        {severityFilter !== 'All' && (
          <button
            onClick={() => setSeverityFilter('All')}
            className="ml-1 text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-transparent border-b border-border/60 rounded-none h-auto p-0 gap-0 w-full justify-start mb-6">
          {[
            { value: 'all', label: 'All Active', count: allActiveAndVerifying.length, countCls: 'bg-primary/15 text-primary', activeBorder: 'data-[state=active]:border-primary' },
            { value: 'critical', label: 'Critical', count: criticalCount, countCls: 'bg-red-500/20 text-red-400', activeBorder: 'data-[state=active]:border-red-500' },
            { value: 'warning', label: 'Warning', count: majorCount + minorCount, countCls: 'bg-amber-500/20 text-amber-400', activeBorder: 'data-[state=active]:border-amber-500' },
            { value: 'inprogress', label: 'In Progress', count: inProgressCount, countCls: 'bg-amber-500/20 text-amber-400', activeBorder: 'data-[state=active]:border-amber-400' },
            { value: 'info', label: 'Info', count: infoCount, countCls: 'bg-slate-500/20 text-slate-400', activeBorder: 'data-[state=active]:border-slate-400' },
            { value: 'solved', label: 'Solved', count: resolved.length, countCls: 'bg-green-500/15 text-green-400', activeBorder: 'data-[state=active]:border-green-500' },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={`rounded-none border-b-2 border-transparent ${tab.activeBorder} data-[state=active]:bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab.countCls}`}>
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ALL ACTIVE */}
        <TabsContent value="all" className="space-y-3 m-0">
          {displayAll.length === 0 ? (
            <EmptyState icon={ShieldCheck} message={severityFilter !== 'All' ? `No active ${severityFilter} alarms` : 'No active alarms — all systems operational'} />
          ) : (
            displayAll.map(alarm => (
              <AlarmCard key={alarm.id} alarm={alarm} tick={tick} viewed={viewedIds.has(alarm.id)} onAcknowledge={handleAcknowledge} onView={() => markViewed(alarm.id)} />
            ))
          )}
        </TabsContent>

        {/* CRITICAL */}
        <TabsContent value="critical" className="space-y-3 m-0">
          {displayCritical.length === 0 ? (
            <EmptyState icon={ShieldCheck} message="No critical alarms" />
          ) : (
            displayCritical.map(alarm => (
              <AlarmCard key={alarm.id} alarm={alarm} tick={tick} viewed={viewedIds.has(alarm.id)} onAcknowledge={handleAcknowledge} onView={() => markViewed(alarm.id)} />
            ))
          )}
        </TabsContent>

        {/* WARNING */}
        <TabsContent value="warning" className="space-y-3 m-0">
          {displayWarning.length === 0 ? (
            <EmptyState icon={ShieldCheck} message="No warnings" />
          ) : (
            displayWarning.map(alarm => (
              <AlarmCard key={alarm.id} alarm={alarm} tick={tick} viewed={viewedIds.has(alarm.id)} onAcknowledge={handleAcknowledge} onView={() => markViewed(alarm.id)} />
            ))
          )}
        </TabsContent>

        {/* IN PROGRESS (Verifying) */}
        <TabsContent value="inprogress" className="space-y-3 m-0">
          {displayVerify.length === 0 ? (
            <EmptyState icon={RefreshCw} message="No alarms currently in verification" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
                {displayVerify.length} alarm{displayVerify.length > 1 ? 's' : ''} acknowledged and under active auto-verification
              </div>
              {displayVerify.map(alarm => (
                <AlarmCard key={alarm.id} alarm={alarm} tick={tick} viewed={viewedIds.has(alarm.id)} onView={() => markViewed(alarm.id)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* INFO */}
        <TabsContent value="info" className="space-y-3 m-0">
          {displayInfo.length === 0 ? (
            <EmptyState icon={Info} message="No info events" />
          ) : (
            displayInfo.map(alarm => (
              <AlarmCard key={alarm.id} alarm={alarm} tick={tick} viewed={viewedIds.has(alarm.id)} onView={() => markViewed(alarm.id)} />
            ))
          )}
        </TabsContent>

        {/* SOLVED */}
        <TabsContent value="solved" className="space-y-3 m-0">
          {displayResolved.length === 0 ? (
            <EmptyState icon={Activity} message={severityFilter !== 'All' ? `No resolved ${severityFilter} alarms` : 'No solved alarms yet'} />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-[11px] text-green-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                {displayResolved.length} alarm{displayResolved.length > 1 ? 's' : ''} verified and solved — all passed auto-verification check
              </div>
              {displayResolved.map(alarm => (
                <AlarmCard key={alarm.id} alarm={alarm} tick={tick} viewed={viewedIds.has(alarm.id)} onView={() => markViewed(alarm.id)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
