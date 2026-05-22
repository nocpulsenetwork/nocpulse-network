import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  Server, 
  Router, 
  Network, 
  Map, 
  AlertTriangle, 
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ className, collapsed = false, onToggleCollapse }: SidebarProps) {
  const [location] = useLocation();

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/olts', label: 'OLT Management', icon: Server },
    { href: '/onus', label: 'ONU Management', icon: Router },
    { href: '/diagram', label: 'Device Diagram', icon: Network },
    { href: '/fiber-map', label: 'Fiber Map', icon: Map },
    { href: '/alarms', label: 'Alarm Center', icon: AlertTriangle },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div 
      className={cn(
        "flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out relative",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className={cn("flex h-14 items-center border-b", collapsed ? "justify-center px-0" : "px-4")}>
        <Activity className={cn("text-primary", collapsed ? "h-6 w-6" : "h-6 w-6 mr-2")} />
        {!collapsed && (
          <div className="flex flex-1 items-center justify-between">
            <span className="text-lg font-bold tracking-tight">NOCpulse</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-green-500">Live</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto py-4 flex flex-col justify-between">
        <nav className="grid items-start px-2 text-sm font-medium gap-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            
            const navLink = (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center rounded-lg px-3 py-2 transition-all cursor-pointer border-l-2",
                    isActive 
                      ? "border-primary bg-primary/10 text-primary font-semibold" 
                      : "border-transparent text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    collapsed ? "justify-center px-0" : "gap-3"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "")} />
                  {!collapsed && <span>{item.label}</span>}
                </span>
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {navLink}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-semibold">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navLink;
          })}
        </nav>
      </div>

      {onToggleCollapse && (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onToggleCollapse}
          className="absolute -right-3 top-16 h-6 w-6 rounded-full border bg-background shadow-sm hover:bg-accent z-50 hidden sm:flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      )}

      <div className="mt-auto border-t p-3">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center cursor-pointer hover:ring-2 ring-primary/50 transition-all">
              <span className="text-xs font-bold text-primary">JD</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-card p-3 border shadow-sm">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">JD</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium">John Doe</span>
              <span className="text-[10px] text-muted-foreground">Network Engineer</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
