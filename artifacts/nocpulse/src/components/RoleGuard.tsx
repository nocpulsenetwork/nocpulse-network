import { Lock } from 'lucide-react';
import { useRole, type UserRole, ROLE_LABELS } from '@/contexts/RoleContext';

interface RoleGuardProps {
  allow: UserRole[];
  children: React.ReactNode;
  message?: string;
}

export function RoleGuard({ allow, children, message }: RoleGuardProps) {
  const { role } = useRole();

  if (allow.includes(role)) return <>{children}</>;

  const roleInfo = ROLE_LABELS[role];

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-5 text-center p-8">
      <div className="h-16 w-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center">
        <Lock className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h3 className="text-base font-semibold">Access Restricted</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {message ?? 'This section requires elevated permissions. Contact your administrator to request access.'}
        </p>
      </div>
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${roleInfo.bg} ${roleInfo.color} ${roleInfo.border}`}>
        Signed in as: {roleInfo.label}
      </div>
    </div>
  );
}
