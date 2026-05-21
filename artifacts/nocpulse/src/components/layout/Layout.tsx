import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useLocation } from 'wouter';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getTitle = () => {
    if (location === '/') return 'Dashboard';
    if (location.startsWith('/olts')) return 'OLT Management';
    if (location.startsWith('/onus')) return 'ONU Management';
    if (location.startsWith('/diagram')) return 'Device Diagram';
    if (location.startsWith('/fiber-map')) return 'Fiber Map';
    if (location.startsWith('/alarms')) return 'Alarm Center';
    if (location.startsWith('/settings')) return 'Settings';
    return 'NOCpulse';
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <div className="flex flex-1">
        <Sidebar className="hidden sm:flex" />
        
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar className="w-full" />
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 flex-col sm:pl-0 w-full overflow-hidden">
          <div className="sticky top-0 z-30 flex-none bg-background sm:border-b sm:h-14 flex flex-col justify-center">
             <Navbar onMenuClick={() => setMobileMenuOpen(true)} title={getTitle()} />
          </div>
          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 w-full max-w-full">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
