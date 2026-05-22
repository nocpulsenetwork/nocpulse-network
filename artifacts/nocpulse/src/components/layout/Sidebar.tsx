import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  Server,
  Cpu,
  GitBranch,
  Map,
  Bell,
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  BellRing,
  Stethoscope,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { alarms } from '@/data/mockData';

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ className, collapsed = false, onToggleCollapse }: SidebarProps) {
  const [location] = useLocation();

  const mainItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/alarms', label: 'Alarm Center', icon: Bell },
  ];

  const networkItems = [
    { href: '/olts', label: 'OLT Management', icon: Server },
    { href: '/onus', label: 'ONU Management', icon: Cpu },
    { href: '/diagram', label: 'Device Diagram', icon: GitBranch },
    { href: '/fiber-map', label: 'Fiber Map', icon: Map },
  ];

  const operationsItems = [
    { href: '/activity-logs', label: 'Activity Logs', icon: ClipboardList },
    { href: '/notifications', label: 'Notifications', icon: BellRing },
    { href: '/diagnostics', label: 'Smart Diagnostics', icon: Stethoscope },
  ];

  const systemItems = [
    { href: '/staff', label: 'Staff & Permissions', icon: Users },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const unacknowledgedAlarmsCount = alarms.filter(a => !a.acknowledged).length;

  const renderNavLinks = (items: { href: string; label: string; icon: React.ElementType }[]) => {
    return items.map((item) => {
      const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
      const showBadge = item.href === '/alarms' && unacknowledgedAlarmsCount > 0;

      const navLink = (
        <Link key={item.href} href={item.href}>
          <span
            className={cn(
              'flex items-center rounded-lg px-3 py-2 transition-all cursor-pointer border-l-2 relative',
              isActive
                ? 'border-primary bg-primary/10 text-primary font-semibold shadow-[inset_-2px_0_0_hsl(var(--primary)/0.3)]'
                : 'border-transparent text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              collapsed ? 'justify-center px-0' : 'gap-3'
            )}
            data-testid={`nav-${item.label.toLowerCase().replace(/ /g, '-')}`}
          >
            <item.icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-primary' : '')} />
            {!collapsed && (
              <span className="flex-1 flex items-center justify-between">
                {item.label}
                {showBadge && (
                  <span className="bg-destructive text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold shrink-0">
                    {unacknowledgedAlarmsCount > 99 ? '99+' : unacknowledgedAlarmsCount}
                  </span>
                )}
              </span>
            )}
            {collapsed && showBadge && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
            )}
          </span>
        </Link>
      );

      if (collapsed) {
        return (
          <Tooltip key={item.href} delayDuration={0}>
            <TooltipTrigger asChild>{navLink}</TooltipTrigger>
            <TooltipContent side="right" className="font-semibold flex items-center gap-2">
              {item.label}
              {showBadge && (
                <span className="bg-destructive text-white text-[9px] rounded-full h-4 px-1.5 flex items-center justify-center font-bold">
                  {unacknowledgedAlarmsCount}
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        );
      }

      return navLink;
    });
  };

  const SectionHeader = ({ label }: { label: string }) => {
    if (collapsed) return <div className="h-px bg-border mx-4 my-2" />;
    return (
      <div className="flex items-center px-3 mb-1 mt-4">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mr-2 shrink-0">
          {label}
        </span>
        <div className="h-px bg-border flex-1" />
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out relative',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      <div className={cn('flex h-14 items-center border-b shrink-0', collapsed ? 'justify-center px-0' : 'px-4')}>
        <Activity className={cn('text-primary shrink-0', collapsed ? 'h-6 w-6' : 'h-6 w-6 mr-2')} />
        {!collapsed && (
          <div className="flex flex-1 items-center justify-between truncate">
            <span className="text-lg font-bold tracking-tight">NOCpulse</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-green-500">Live</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2 flex flex-col">
        <nav className="grid items-start px-2 text-sm font-medium gap-1">
          {!collapsed && (
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 mb-1 mt-2">
              Main
            </div>
          )}
          {renderNavLinks(mainItems)}

          <SectionHeader label="Network" />
          {renderNavLinks(networkItems)}

          <SectionHeader label="Operations" />
          {renderNavLinks(operationsItems)}

          <SectionHeader label="System" />
          {renderNavLinks(systemItems)}
        </nav>
      </div>

      {onToggleCollapse && (
        <div className="px-2 pb-2 shrink-0 hidden sm:block">
          <button
            onClick={onToggleCollapse}
            className="flex items-center justify-center sm:justify-between w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-sidebar-accent/60 transition-colors"
          >
            {!collapsed && <span className="uppercase tracking-widest font-bold text-[9px]">Collapse</span>}
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      )}

      <div className="mt-auto border-t p-3 shrink-0">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center cursor-pointer hover:ring-2 ring-primary/50 transition-all shrink-0">
              <span className="text-xs font-bold text-primary">JD</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-card p-3 border shadow-sm shrink-0">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">JD</span>
            </div>
            <div className="flex flex-col truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium truncate">John Doe</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold uppercase tracking-wider shrink-0">
                  Admin
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground truncate">NOC Lead</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
