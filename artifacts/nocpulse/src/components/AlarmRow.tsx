import React from 'react';
import { Alarm } from '@/data/mockData';
import { StatusBadge } from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';

interface AlarmRowProps {
  alarm: Alarm;
  onAcknowledge?: (id: string) => void;
}

export function AlarmRow({ alarm, onAcknowledge }: AlarmRowProps) {
  const getSeverityBorder = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'border-l-red-500';
      case 'Major': return 'border-l-amber-500';
      case 'Minor': return 'border-l-blue-500';
      case 'Info': return 'border-l-slate-400';
      default: return 'border-l-transparent';
    }
  };

  return (
    <div className={`flex items-start justify-between p-4 border-b last:border-0 hover:bg-muted/50 transition-colors border-l-2 ${getSeverityBorder(alarm.severity)} ${!alarm.acknowledged ? 'bg-muted/20' : 'opacity-70'}`}>
      <div className="flex items-start gap-4">
        <StatusBadge severity={alarm.severity} className="mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium leading-none">
            {alarm.deviceName}
          </p>
          <p className="text-sm text-muted-foreground">
            {alarm.description}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{new Date(alarm.timestamp).toLocaleString()}</span>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
      {onAcknowledge && !alarm.acknowledged && (
        <button 
          onClick={() => onAcknowledge(alarm.id)}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors px-3 py-1 rounded-md bg-primary/10 hover:bg-primary/20"
          data-testid={`btn-ack-${alarm.id}`}
        >
          Acknowledge
        </button>
      )}
      {alarm.acknowledged && (
        <span className="text-xs text-muted-foreground font-medium px-3 py-1">
          Acknowledged
        </span>
      )}
    </div>
  );
}
