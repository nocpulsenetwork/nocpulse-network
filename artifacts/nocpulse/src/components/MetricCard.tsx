import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { Link } from 'wouter';

export type AccentColor = 'cyan' | 'green' | 'red' | 'amber';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accentColor: AccentColor;
  description?: string;
  pulse?: boolean;
  alert?: boolean;
  href?: string;
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
  alert,
  href
}: MetricCardProps) {
  const styles = colorMap[accentColor] || colorMap.cyan;

  const cardContent = (
    <Card className={`overflow-hidden transition-all border-l-4 ${styles.border} ${alert ? styles.alertClasses : ''} ${href ? 'cursor-pointer hover:brightness-110 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] duration-200' : ''}`}>
      <CardContent className="p-3 sm:p-4 md:p-5">
        <div className="flex items-center justify-between space-y-0 pb-1.5 sm:pb-2">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground tracking-tight leading-tight">{title}</p>
          <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${styles.bg} ${styles.text} ${pulse ? 'animate-pulse' : ''}`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        <div className="flex flex-col mt-1 sm:mt-2">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</div>
          {description && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-1.5 flex items-center leading-tight">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
