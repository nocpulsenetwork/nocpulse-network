import { ShieldAlert, Eye, Info } from 'lucide-react';
import { useRole, ROLE_LABELS } from '@/contexts/RoleContext';
import { ROLE_MATRIX } from '@/lib/permissions';

interface PermissionBannerProps {
  context: string;
}

export function PermissionBanner({ context }: PermissionBannerProps) {
  const { role, canAdminister } = useRole();
  const roleInfo  = ROLE_LABELS[role];
  const matrix    = ROLE_MATRIX[role];

  if (canAdminister) return null;

  const isViewer   = role === 'viewer';
  const borderCls  = isViewer ? 'border-slate-500/25 bg-slate-500/5'  : 'border-amber-500/25 bg-amber-500/5';
  const iconCls    = isViewer ? 'text-slate-400' : 'text-amber-400';
  const Icon       = isViewer ? Eye : ShieldAlert;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${borderCls}`}>
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconCls}`} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {isViewer ? 'Read-Only Access' : 'Limited Access'}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${roleInfo.bg} ${roleInfo.color} ${roleInfo.border}`}>
            {roleInfo.label}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:block">— {context}</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-0.5">
          {matrix.canDo.map(item => (
            <span key={item} className="flex items-center gap-1 text-[11px] text-green-400">
              <span className="text-[9px]">✓</span> {item}
            </span>
          ))}
          {matrix.cantDo.map(item => (
            <span key={item} className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
              <span className="text-[9px]">✗</span> {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Inline chip used on individual disabled action buttons ─────────────────
export function LockedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/50 bg-muted/40 text-muted-foreground text-[9px] font-bold uppercase tracking-wider ml-1.5">
      <Info className="h-2.5 w-2.5" /> Restricted
    </span>
  );
}
