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
    border: 'border-l-cyan-500',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-700 dark:text-cyan-400',
    alertClasses: 'border-y-cyan-500/30 border-r-cyan-500/30 bg-cyan-500/5',
  },
  green: {
    border: 'border-l-green-500',
    bg: 'bg-green-500/10',
    text: 'text-green-700 dark:text-green-500',
    alertClasses: 'border-y-green-500/30 border-r-green-500/30 bg-green-500/5',
  },
  red: {
    border: 'border-l-red-500',
    bg: 'bg-red-500/10',
    text: 'text-red-700 dark:text-red-500',
    alertClasses: 'border-y-red-500/30 border-r-red-500/30 bg-red-500/5',
  },
  amber: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-500',
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
  href,
}: MetricCardProps) {
  const styles = colorMap[accentColor] || colorMap.cyan;

  /* Card content — fixed minimum height so all 7 KPI cards stay equal */
  const cardContent = (
    <Card className={`h-full overflow-hidden transition-all border-l-4 ${styles.border} ${alert ? styles.alertClasses : ''} ${href ? 'cursor-pointer hover:brightness-110 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] duration-200' : ''}`}>
      <CardContent className="p-3 sm:p-4 flex flex-col justify-between h-full">
        {/* Top row: title + icon */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground tracking-tight leading-tight">{title}</p>
          <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${styles.bg} ${styles.text} ${pulse ? 'animate-pulse' : ''}`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        {/* Bottom: value + description */}
        <div className="flex flex-col mt-2">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</div>
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mt-1 leading-tight min-h-[2.5em]">
            {description ?? '\u00a0'}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
