import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Status, Severity } from '@/data/mockData';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status?: Status;
  severity?: Severity;
  className?: string;
}

export function StatusBadge({ status, severity, className = '' }: StatusBadgeProps) {
  if (status) {
    switch (status) {
      case 'Online':
        return (
          <Badge variant="outline" className={`bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/25 font-semibold gap-1.5 ${className}`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Online
          </Badge>
        );
      case 'Offline':
        return (
          <Badge variant="outline" className={`bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25 font-semibold gap-1.5 ${className}`}>
            <XCircle className="w-3.5 h-3.5" />
            Offline
          </Badge>
        );
      case 'Degraded':
        return (
          <Badge variant="outline" className={`bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25 font-semibold gap-1.5 ${className}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            Degraded
          </Badge>
        );
    }
  }

  if (severity) {
    switch (severity) {
      case 'Critical':
        return (
          <Badge variant="outline" className={`bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25 font-semibold gap-1.5 ${className}`}>
            <XCircle className="w-3.5 h-3.5" />
            Critical
          </Badge>
        );
      case 'Major':
        return (
          <Badge variant="outline" className={`bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25 font-semibold gap-1.5 ${className}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            Major
          </Badge>
        );
      case 'Minor':
        return (
          <Badge variant="outline" className={`bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25 font-semibold gap-1.5 ${className}`}>
            <AlertCircle className="w-3.5 h-3.5" />
            Minor
          </Badge>
        );
      case 'Info':
        return (
          <Badge variant="outline" className={`bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 font-semibold gap-1.5 ${className}`}>
            <Info className="w-3.5 h-3.5" />
            Info
          </Badge>
        );
    }
  }

  return null;
}
