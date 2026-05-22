import React from 'react';
import { Search, Bell, Sun, Moon, Menu } from 'lucide-react';
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
  const activeAlarmsCount = alarms.filter(a => !a.acknowledged).length;

  return (
    <header className="flex h-14 items-center gap-4 px-4 sm:px-6 w-full">
      <Button size="icon" variant="ghost" className="sm:hidden -ml-2" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </Button>
      
      <div className="hidden sm:flex items-center gap-2 mr-auto">
        <h1 className="text-base font-semibold">{title}</h1>
      </div>

      <div className="flex w-full items-center gap-2 md:gap-4 justify-end">
        <form className="hidden sm:block ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search devices, IPs…"
              className="w-64 bg-card pl-9 border-border/60 rounded-lg shadow-sm focus-visible:ring-1 focus-visible:ring-primary/50 transition-shadow"
            />
          </div>
        </form>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative text-muted-foreground hover:text-foreground group"
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
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              {activeAlarmsCount > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive animate-pulse shadow-[0_0_0_2px_hsl(var(--background))]" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[240px]">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/alarms" className="cursor-pointer w-full">
                <div className="flex flex-col gap-1 w-full">
                  <span className="font-medium text-sm">Active Alarms ({activeAlarmsCount})</span>
                  <span className="text-xs text-muted-foreground">Click to view Alarm Center</span>
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden sm:block w-px h-6 bg-border mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 outline-none">
              <span className="text-xs font-bold text-primary">JD</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="cursor-pointer">Profile</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer w-full">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div className="w-full cursor-not-allowed">
                  <DropdownMenuItem disabled className="opacity-50 pointer-events-none">
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
