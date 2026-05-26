import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useLocation } from 'wouter';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Track collapse state with localStorage sync
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('nocpulse-sidebar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('nocpulse-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  const toggleCollapse = () => setCollapsed((prev) => !prev);

  // Scroll main content to top on every route change
  useEffect(() => {
    const main = document.getElementById('nocpulse-main');
    if (main) main.scrollTop = 0;
  }, [location]);

  const getTitle = () => {
    if (location === '/') return 'Dashboard';
    if (location.match(/^\/olts\/[^/]+$/)) return 'OLT Details';
    if (location.startsWith('/olts')) return 'OLT Management';
    if (location.match(/^\/onus\/[^/]+$/)) return 'ONU Details';
    if (location.startsWith('/onus')) return 'ONU Management';
    if (location.startsWith('/diagram')) return 'Device Diagram';
    if (location.startsWith('/fiber-map')) return 'Fiber Map';
    if (location.startsWith('/alarms')) return 'Alarm Center';
    if (location.startsWith('/activity-logs')) return 'Activity Logs';
    if (location.startsWith('/notifications')) return 'Notifications';
    if (location.startsWith('/diagnostics')) return 'Smart Diagnostics';
    if (location.startsWith('/staff')) return 'Staff & Permissions';
    if (location.startsWith('/subscribers')) return 'Subscribers';
    if (location.startsWith('/settings')) return 'Settings';
    return 'NOCpulse';
  };

  return (
    <TooltipProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar 
          className="hidden sm:flex fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 ease-in-out" 
          collapsed={collapsed} 
          onToggleCollapse={toggleCollapse} 
        />
        
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-64 border-r-0">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <Sidebar className="w-full h-full" collapsed={false} />
          </SheetContent>
        </Sheet>

        <div 
          className={`flex flex-1 flex-col w-full min-h-screen transition-all duration-300 ease-in-out ${
            collapsed ? 'sm:ml-16' : 'sm:ml-64'
          }`}
        >
          <div className="sticky top-0 z-30 flex-none h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex flex-col justify-center">
             <Navbar onMenuClick={() => setMobileMenuOpen(true)} title={getTitle()} />
          </div>
          <main id="nocpulse-main" className="flex-1 overflow-auto p-3 sm:p-6 lg:p-8 w-full max-w-full">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
