import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  description?: string;
  alert?: boolean;
}

export function MetricCard({ title, value, icon: Icon, trend, trendUp, description, alert }: MetricCardProps) {
  return (
    <Card className={`overflow-hidden transition-all ${alert ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground tracking-tight">{title}</p>
          <div className={`p-2 rounded-md ${alert ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex flex-col mt-2">
          <div className="text-3xl font-bold tracking-tight">{value}</div>
          {(trend || description) && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center">
              {trend && (
                <span className={`font-medium mr-2 ${trendUp === true ? 'text-green-500' : trendUp === false ? 'text-red-500' : 'text-amber-500'}`}>
                  {trend}
                </span>
              )}
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
