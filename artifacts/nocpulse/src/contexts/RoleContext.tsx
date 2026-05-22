import { createContext, useContext, useState } from 'react';

export type UserRole = 'super_admin' | 'admin' | 'staff';

export interface RoleUser {
  name: string;
  initials: string;
  title: string;
  email: string;
}

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  user: RoleUser;
}

const ROLE_USERS: Record<UserRole, RoleUser> = {
  super_admin: { name: 'John Doe', initials: 'JD', title: 'NOC Lead', email: 'john.doe@isp.net' },
  admin:       { name: 'Sarah Chen', initials: 'SC', title: 'Senior NOC', email: 'sarah.chen@isp.net' },
  staff:       { name: 'Lisa Park', initials: 'LP', title: 'NOC Engineer', email: 'lisa.park@isp.net' },
};

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>('super_admin');

  return (
    <RoleContext.Provider value={{
      role,
      setRole,
      isSuperAdmin: role === 'super_admin',
      isAdmin: role === 'admin',
      isStaff: role === 'staff',
      user: ROLE_USERS[role],
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside RoleProvider');
  return ctx;
}

export const ROLE_LABELS: Record<UserRole, { label: string; color: string; bg: string; border: string }> = {
  super_admin: { label: 'Super Admin', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  admin:       { label: 'Admin',       color: 'text-primary',   bg: 'bg-primary/10',   border: 'border-primary/20'   },
  staff:       { label: 'Staff',       color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
};
