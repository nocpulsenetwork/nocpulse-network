import { useEffect, useRef } from 'react';
import { AlertTriangle, XCircle, RefreshCw, Power, PowerOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Variant = 'warning' | 'danger';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  device: string;
  confirmLabel?: string;
  variant?: Variant;
  icon?: 'reboot' | 'disable' | 'enable' | 'router';
}

const ICON_MAP = {
  reboot: RefreshCw,
  disable: PowerOff,
  enable: Power,
  router: RefreshCw,
};

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  device,
  confirmLabel = 'Confirm',
  variant = 'warning',
  icon = 'reboot',
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  /* Focus trap & Escape key */
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const isDanger = variant === 'danger';
  const Icon = ICON_MAP[icon];

  const accentCls = isDanger
    ? { ring: 'ring-red-500/20', iconBg: 'bg-red-500/10 border-red-500/20', iconColor: 'text-red-400', btn: 'bg-red-600 hover:bg-red-700 text-white border-red-600' }
    : { ring: 'ring-amber-500/20', iconBg: 'bg-amber-500/10 border-amber-500/20', iconColor: 'text-amber-400', btn: 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600' };

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className={`relative z-10 w-full max-w-sm rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/30 ring-1 ${accentCls.ring} animate-in fade-in-0 zoom-in-95 duration-150`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 space-y-4">
          {/* Icon */}
          <div className={`h-12 w-12 rounded-xl border flex items-center justify-center ${accentCls.iconBg}`}>
            <Icon className={`h-6 w-6 ${accentCls.iconColor}`} />
          </div>

          {/* Text */}
          <div className="space-y-1.5">
            <h2 id="confirm-modal-title" className="text-base font-bold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </div>

          {/* Device highlight */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
            <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${accentCls.iconColor}`} />
            <span className="text-xs text-muted-foreground">Target device:</span>
            <span className="text-xs font-mono font-semibold text-foreground">{device}</span>
          </div>

          {/* Warning note */}
          <p className="text-[11px] text-muted-foreground/70 flex items-start gap-1.5">
            <XCircle className="h-3 w-3 shrink-0 mt-0.5 opacity-50" />
            This action will be recorded in Activity Logs under your account.
          </p>

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              ref={cancelRef}
              variant="outline"
              className="flex-1 h-9 text-sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className={`flex-1 h-9 text-sm border font-semibold ${accentCls.btn}`}
              onClick={() => { onConfirm(); onClose(); }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
