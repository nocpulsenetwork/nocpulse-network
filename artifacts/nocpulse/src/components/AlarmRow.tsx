import React from 'react';
import { Alarm } from '@/data/mockData';
import { StatusBadge } from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';

interface AlarmRowProps {
  alarm: Alarm;
  onAcknowledge?: (id: string) => void;
  onClick?: () => void;
  compact?: boolean;
}

export function AlarmRow({ alarm, onAcknowledge, onClick, compact }: AlarmRowProps) {
  const getSeverityBorder = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'border-l-red-500';
      case 'Major': return 'border-l-amber-500';
      case 'Minor': return 'border-l-blue-500';
      case 'Info': return 'border-l-slate-400';
      default: return 'border-l-transparent';
    }
  };

  const getSeverityDot = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-500';
      case 'Major': return 'bg-amber-500';
      case 'Minor': return 'bg-blue-500';
      case 'Info': return 'bg-slate-400';
      default: return 'bg-muted';
    }
  };

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-2.5 py-2 border-b last:border-0 hover:bg-muted/50 transition-colors border-l-2 ${getSeverityBorder(alarm.severity)} ${!alarm.acknowledged ? 'bg-muted/20' : 'opacity-60'} ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${getSeverityDot(alarm.severity)}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-medium leading-[1.2] truncate">{alarm.deviceName}</span>
            <span className={`shrink-0 text-[10px] font-bold px-1 py-0.5 rounded leading-none ${
              alarm.severity === 'Critical' ? 'bg-red-500/15 text-red-400' :
              alarm.severity === 'Major'    ? 'bg-amber-500/15 text-amber-400' :
              alarm.severity === 'Minor'    ? 'bg-blue-500/15 text-blue-400' :
              'bg-muted/50 text-muted-foreground'
            }`}>{alarm.severity}</span>
          </div>
          <p className="text-[12px] text-muted-foreground truncate leading-[1.2]">{alarm.description}</p>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground/70 whitespace-nowrap">
          {formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true })}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start justify-between p-4 border-b last:border-0 hover:bg-muted/50 transition-colors border-l-2 ${getSeverityBorder(alarm.severity)} ${!alarm.acknowledged ? 'bg-muted/20' : 'opacity-70'} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
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
          onClick={(e) => { e.stopPropagation(); onAcknowledge(alarm.id); }}
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
