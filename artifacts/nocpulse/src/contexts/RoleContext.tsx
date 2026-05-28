import { createContext, useContext, useState } from 'react';

export type UserRole = 'super_admin' | 'admin' | 'noc_engineer' | 'viewer';

export interface RoleUser {
  name: string;
  initials: string;
  title: string;
  email: string;
}

interface RoleContextType {
  role: UserRole;
  user: RoleUser;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isNocEngineer: boolean;
  isViewer: boolean;
  canEdit: boolean;
  canAdminister: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
  setRole: (role: UserRole) => void;
}

const ROLE_USERS: Record<UserRole, RoleUser> = {
  super_admin:  { name: 'John Doe',   initials: 'JD', title: 'NOC Lead',     email: 'admin@nocpulse.io'   },
  admin:        { name: 'Sarah Chen', initials: 'SC', title: 'Senior NOC',   email: 'manager@nocpulse.io' },
  noc_engineer: { name: 'Lisa Park',  initials: 'LP', title: 'NOC Engineer', email: 'noc@nocpulse.io'     },
  viewer:       { name: 'Mark Evans', initials: 'ME', title: 'Viewer',       email: 'viewer@nocpulse.io'  },
};

const VALID_ROLES: UserRole[] = ['super_admin', 'admin', 'noc_engineer', 'viewer'];

function getInitialState(): { isAuthenticated: boolean; role: UserRole } {
  const token = localStorage.getItem('auth-token');
  const stored = localStorage.getItem('user-role') as UserRole | null;
  const role = stored && VALID_ROLES.includes(stored) ? stored : 'super_admin';
  return { isAuthenticated: !!token, role };
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const initial = getInitialState();
  const [isAuthenticated, setIsAuthenticated] = useState(initial.isAuthenticated);
  const [role, setRoleState] = useState<UserRole>(initial.role);

  const login = (r: UserRole) => {
    localStorage.setItem('auth-token', `mock-token-${r}`);
    localStorage.setItem('user-role', r);
    setRoleState(r);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('auth-token');
    localStorage.removeItem('user-role');
    setIsAuthenticated(false);
    setRoleState('super_admin');
  };

  const setRole = (r: UserRole) => {
    localStorage.setItem('user-role', r);
    setRoleState(r);
  };

  return (
    <RoleContext.Provider value={{
      role,
      user: ROLE_USERS[role],
      isAuthenticated,
      isSuperAdmin: role === 'super_admin',
      isAdmin: role === 'super_admin' || role === 'admin',
      isNocEngineer: role === 'noc_engineer',
      isViewer: role === 'viewer',
      canEdit: role !== 'viewer',
      canAdminister: role === 'super_admin' || role === 'admin',
      login,
      logout,
      setRole,
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
  super_admin:  { label: 'Super Admin',  color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  admin:        { label: 'Admin',        color: 'text-primary',   bg: 'bg-primary/10',   border: 'border-primary/20'   },
  noc_engineer: { label: 'NOC Engineer', color: 'text-cyan-400',  bg: 'bg-cyan-500/10',  border: 'border-cyan-500/20'  },
  viewer:       { label: 'Viewer',       color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
};
