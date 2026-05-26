import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Bell, Menu, User, Settings as SettingsIcon, Crown, LogOut, ShieldCheck, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { alarms, onus, olts } from '@/data/mockData';
import { useRole, ROLE_LABELS } from '@/contexts/RoleContext';

interface NavbarProps {
  onMenuClick?: () => void;
  title?: string;
}

export function Navbar({ onMenuClick, title = 'NOCpulse' }: NavbarProps) {
  const { role, user } = useRole();
  const roleStyle = ROLE_LABELS[role];
  const RoleIcon = role === 'super_admin' ? Crown : role === 'admin' ? ShieldCheck : Shield;
  const [time, setTime] = useState(new Date());
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const onuResults = onus
      .filter(o =>
        o.onuNo.toLowerCase().includes(q) ||
        (o.description ?? '').toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.macAddress.toLowerCase().includes(q) ||
        o.clientMac.toLowerCase().includes(q) ||
        o.ponPort.toLowerCase().includes(q) ||
        o.oltPort.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map(o => ({
        id: o.id,
        label: o.description || o.customerName,
        sub: `ONU · ${o.onuNo} · ${o.status}`,
        href: `/onus/${o.id}`,
        status: o.status,
        kind: 'ONU' as const,
      }));
    const oltResults = olts
      .filter(o =>
        o.name.toLowerCase().includes(q) ||
        o.ip.toLowerCase().includes(q) ||
        (o.location ?? '').toLowerCase().includes(q)
      )
      .slice(0, 2)
      .map(o => ({
        id: o.id,
        label: o.name,
        sub: `OLT · ${o.ip} · ${o.status}`,
        href: `/olts/${o.id}`,
        status: o.status,
        kind: 'OLT' as const,
      }));
    return [...onuResults, ...oltResults].slice(0, 6);
  }, [searchQuery]);

  const unacknowledgedAlarms = alarms.filter(a => !a.acknowledged);
  const activeAlarmsCount = unacknowledgedAlarms.length;
  const topAlarms = unacknowledgedAlarms.slice(0, 3);

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'Critical': return 'border-l-red-500 bg-red-500/10 text-red-500';
      case 'Major': return 'border-l-amber-500 bg-amber-500/10 text-amber-500';
      case 'Minor': return 'border-l-blue-500 bg-blue-500/10 text-blue-500';
      default: return 'border-l-slate-500 bg-slate-500/10 text-slate-500';
    }
  };

  const getSeverityBorder = (severity: string) => {
    switch(severity) {
      case 'Critical': return 'border-l-4 border-l-red-500';
      case 'Major': return 'border-l-4 border-l-amber-500';
      case 'Minor': return 'border-l-4 border-l-blue-500';
      default: return 'border-l-4 border-l-slate-500';
    }
  };

  const scrollToTop = () => {
    const m = document.getElementById('nocpulse-main');
    if (m) m.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="flex h-14 items-center gap-3 px-4 sm:px-6 w-full overflow-hidden">
      <Button size="icon" variant="ghost" className="sm:hidden -ml-2 shrink-0" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </Button>

      <h1
        className="flex-1 min-w-0 text-sm font-semibold truncate cursor-pointer select-none hover:text-primary transition-colors"
        title="Scroll to top"
        onClick={scrollToTop}
      >
        {title}
      </h1>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        
        <div className="hidden sm:flex text-xs font-mono text-muted-foreground items-center shrink-0">
          {time.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })} &middot; {time.toLocaleTimeString()}
        </div>

        <div className="hidden lg:flex items-center shrink-0">
          {activeAlarmsCount > 0 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-medium text-amber-500">Active Incidents</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-500">All Systems Operational</span>
            </div>
          )}
        </div>

        <div ref={searchRef} className="hidden sm:block relative shrink-0 ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search devices, IPs…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  navigate(searchResults[0].href);
                  setSearchOpen(false);
                  setSearchQuery('');
                } else if (e.key === 'Escape') {
                  setSearchOpen(false);
                  setSearchQuery('');
                }
              }}
              className="w-52 lg:w-72 bg-card pl-9 border-border/60 rounded-lg shadow-sm focus-visible:ring-1 focus-visible:ring-primary/50 transition-shadow"
            />
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-popover border border-border/70 rounded-lg shadow-xl overflow-hidden">
              <div className="px-3 py-1.5 border-b border-border/50">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </span>
              </div>
              {searchResults.map(r => (
                <button
                  key={r.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left group"
                  onClick={() => { navigate(r.href); setSearchOpen(false); setSearchQuery(''); }}
                >
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    r.kind === 'OLT'
                      ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
                      : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                  }`}>
                    {r.kind}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{r.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.sub}</p>
                  </div>
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    r.status === 'Online' ? 'bg-green-400' :
                    r.status === 'Degraded' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                </button>
              ))}
            </div>
          )}
          {searchOpen && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
            <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-popover border border-border/70 rounded-lg shadow-xl overflow-hidden">
              <div className="px-3 py-1.5 border-b border-border/50">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">No results</span>
              </div>
              <div className="px-3 py-3 text-center">
                <p className="text-xs text-muted-foreground">No devices match <span className="font-medium text-foreground">"{searchQuery}"</span></p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Try an IP, MAC, ONU ID, or customer name</p>
              </div>
            </div>
          )}
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground shrink-0">
              <Bell className="h-5 w-5" />
              {activeAlarmsCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center shadow-[0_0_0_2px_hsl(var(--background))]">
                  {activeAlarmsCount > 99 ? '99+' : activeAlarmsCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[320px] p-0">
            <DropdownMenuLabel className="p-3">Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator className="m-0" />
            <div className="flex flex-col max-h-[300px] overflow-y-auto">
              {topAlarms.length > 0 ? (
                topAlarms.map((alarm) => (
                  <div key={alarm.id} className={`flex flex-col p-3 border-b border-border/50 hover:bg-muted/50 cursor-pointer ${getSeverityBorder(alarm.severity)}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${getSeverityColor(alarm.severity)}`}>
                        {alarm.severity}
                      </span>
                      <span className="text-[10px] text-muted-foreground">2h ago</span>
                    </div>
                    <span className="font-medium text-sm">{alarm.deviceName}</span>
                    <span className="text-xs text-muted-foreground truncate" title={alarm.description}>{alarm.description}</span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">No new notifications</div>
              )}
            </div>
            {activeAlarmsCount > 0 && (
              <div className="p-2 border-t border-border/50">
                <Link href="/alarms" className="block text-center text-xs font-medium text-primary hover:underline py-1">
                  View all {activeAlarmsCount} alarms &rarr;
                </Link>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden sm:block w-px h-6 bg-border mx-1 shrink-0" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`h-8 w-8 rounded-full ${roleStyle.bg} border ${roleStyle.border} flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 outline-none shrink-0`}>
              <span className={`text-xs font-bold ${roleStyle.color}`}>{user.initials}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full ${roleStyle.bg} border ${roleStyle.border} flex items-center justify-center shrink-0`}>
                    <span className={`text-xs font-bold ${roleStyle.color}`}>{user.initials}</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-sm font-semibold leading-none">{user.name}</p>
                    <p className="text-[10px] leading-none text-muted-foreground mt-0.5">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${roleStyle.bg} ${roleStyle.color} ${roleStyle.border} text-[10px] font-bold uppercase tracking-wider`}>
                    <RoleIcon className="h-2.5 w-2.5" /> {roleStyle.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{user.title}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2">
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer gap-2">
              <Link href="/settings" className="w-full flex items-center">
                <SettingsIcon className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer gap-2 text-muted-foreground hover:text-foreground">
              <Link href="/login" className="w-full flex items-center">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
