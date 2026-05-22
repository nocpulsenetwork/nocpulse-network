import { useState, useEffect } from 'react';
import { Search, Bell, Sun, Moon, Menu, User, Settings as SettingsIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { Link } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { alarms } from '@/data/mockData';

interface NavbarProps {
  onMenuClick?: () => void;
  title?: string;
}

export function Navbar({ onMenuClick, title = 'NOCpulse' }: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  return (
    <header className="flex h-14 items-center gap-4 px-4 sm:px-6 w-full">
      <Button size="icon" variant="ghost" className="sm:hidden -ml-2 shrink-0" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </Button>
      
      <div className="flex items-center gap-2 mr-auto">
        <h1 className="text-base font-semibold truncate">{title}</h1>
      </div>

      <div className="flex w-full items-center gap-2 md:gap-4 justify-end shrink-0">
        
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

        <form className="hidden sm:block shrink-0 ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search devices, IPs…"
              className="w-48 lg:w-64 bg-card pl-9 border-border/60 rounded-lg shadow-sm focus-visible:ring-1 focus-visible:ring-primary/50 transition-shadow"
            />
          </div>
        </form>
        
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative text-muted-foreground hover:text-foreground group border border-border/60 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium hidden sm:flex shrink-0"
          title="Toggle theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
              <span>Dark</span>
            </>
          )}
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative text-muted-foreground hover:text-foreground group sm:hidden shrink-0"
          title="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5 transition-transform duration-300 group-hover:rotate-180" />
          ) : (
            <Moon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-180" />
          )}
        </Button>

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
            <button className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 outline-none shrink-0">
              <span className="text-xs font-bold text-primary">JD</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">John Doe</p>
                <p className="text-xs leading-none text-muted-foreground">Network Engineer</p>
                <p className="text-xs leading-none text-muted-foreground mt-1">j.doe@isp.local</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2">
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer gap-2">
              <Link href="/settings" className="w-full flex items-center">
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="w-full cursor-not-allowed">
                  <DropdownMenuItem disabled className="opacity-50 pointer-events-none gap-2">
                    Sign Out
                  </DropdownMenuItem>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Auth coming soon</p>
              </TooltipContent>
            </Tooltip>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
