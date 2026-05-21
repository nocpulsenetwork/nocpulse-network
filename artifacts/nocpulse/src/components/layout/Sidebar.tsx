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
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
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
    <div className={cn("flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex h-14 items-center border-b px-4">
        <Activity className="h-6 w-6 text-primary mr-2" />
        <span className="text-lg font-bold tracking-tight">NOCpulse</span>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start px-2 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary cursor-pointer mb-1",
                    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "hover:bg-sidebar-accent/50"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "")} />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto border-t p-4">
        <div className="flex items-center gap-3 rounded-lg bg-card p-3 border shadow-sm">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">JD</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium">John Doe</span>
            <span className="text-[10px] text-muted-foreground">Network Engineer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
