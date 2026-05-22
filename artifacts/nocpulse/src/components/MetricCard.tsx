import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

export type AccentColor = 'cyan' | 'green' | 'red' | 'amber';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accentColor: AccentColor;
  description?: string;
  pulse?: boolean;
  alert?: boolean;
}

const colorMap = {
  cyan: {
    border: 'border-l-cyan-400',
    bg: 'bg-cyan-400/10',
    text: 'text-cyan-400',
    alertClasses: 'border-y-cyan-400/30 border-r-cyan-400/30 bg-cyan-400/5',
  },
  green: {
    border: 'border-l-green-500',
    bg: 'bg-green-500/10',
    text: 'text-green-500',
    alertClasses: 'border-y-green-500/30 border-r-green-500/30 bg-green-500/5',
  },
  red: {
    border: 'border-l-red-500',
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    alertClasses: 'border-y-red-500/30 border-r-red-500/30 bg-red-500/5',
  },
  amber: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    alertClasses: 'border-y-amber-500/30 border-r-amber-500/30 bg-amber-500/5',
  },
};

export function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  accentColor, 
  description, 
  pulse, 
  alert 
}: MetricCardProps) {
  const styles = colorMap[accentColor] || colorMap.cyan;

  return (
    <Card className={`overflow-hidden transition-all border-l-4 ${styles.border} ${alert ? styles.alertClasses : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground tracking-tight">{title}</p>
          <div className={`p-2 rounded-lg ${styles.bg} ${styles.text} ${pulse ? 'animate-pulse' : ''}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className="flex flex-col mt-2">
          <div className="text-3xl font-bold tracking-tight">{value}</div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
