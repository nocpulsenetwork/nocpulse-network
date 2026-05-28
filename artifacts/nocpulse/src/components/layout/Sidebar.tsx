import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Server,
  Cpu,
  GitBranch,
  Map,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  BellRing,
  Stethoscope,
  Users,
  Building2,
  Crown,
  ShieldCheck,
  Shield,
  Lock,
} from "lucide-react";
import logoUrl from '@/assets/logo.png';
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { alarms } from "@/data/mockData";
import { useRole, type UserRole, ROLE_LABELS } from "@/contexts/RoleContext";

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavClick?: () => void;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  minRole?: UserRole;
};

const roleOrder: Record<UserRole, number> = {
  super_admin: 3,
  admin: 2,
  staff: 1,
};

export function Sidebar({
  className,
  collapsed = false,
  onToggleCollapse,
  onNavClick,
}: SidebarProps) {
  const [location] = useLocation();
  const { role, setRole, isSuperAdmin, isAdmin, isStaff, user } = useRole();

  const canAccess = (minRole?: UserRole) => {
    if (!minRole) return true;
    return roleOrder[role] >= roleOrder[minRole];
  };

  const mainItems: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/alarms", label: "Alarm Center", icon: Bell },
  ];

  const networkItems: NavItem[] = [
    { href: "/olts", label: "OLT Management", icon: Server, minRole: "admin" },
    { href: "/onus", label: "ONU Management", icon: Cpu },
    {
      href: "/diagram",
      label: "Device Diagram",
      icon: GitBranch,
      minRole: "admin",
    },
    { href: "/fiber-map", label: "Fiber Map", icon: Map, minRole: "admin" },
  ];

  const operationsItems: NavItem[] = [
    { href: "/activity-logs", label: "Activity Logs", icon: ClipboardList },
    { href: "/notifications", label: "Notifications", icon: BellRing },
    { href: "/diagnostics", label: "Smart Diagnostics", icon: Stethoscope },
  ];

  const systemItems: NavItem[] = [
    {
      href: "/subscribers",
      label: "Subscribers",
      icon: Building2,
      minRole: "admin",
    },
    {
      href: "/staff",
      label: "Staff & Permissions",
      icon: Users,
      minRole: "admin",
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      minRole: "super_admin",
    },
  ];

  const unacknowledgedAlarmsCount = alarms.filter(
    (a) => !a.acknowledged,
  ).length;

  const renderNavLinks = (items: NavItem[]) => {
    return items
      .filter((item) => canAccess(item.minRole))
      .map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href));
        const showBadge =
          item.href === "/alarms" && unacknowledgedAlarmsCount > 0;

        const navLink = (
          <Link key={item.href} href={item.href}>
            <span
              className={cn(
                "flex items-center rounded-lg px-3 py-2 transition-all cursor-pointer border-l-2 relative",
                isActive
                  ? "border-primary/50 bg-primary/5 text-slate-900 dark:text-white font-semibold"
                  : "border-transparent text-slate-700 dark:text-slate-300 hover:bg-sidebar-accent/60 hover:text-foreground",
                collapsed ? "justify-center px-0" : "gap-3",
              )}
              data-testid={`nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
              onClick={() => {
                const main = document.getElementById('nocpulse-main');
                if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
                onNavClick?.();
              }}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive ? "text-primary" : "",
                )}
              />
              {!collapsed && (
                <span className="flex-1 flex items-center justify-between">
                  {item.label}
                  {showBadge && (
                    <span className="bg-destructive text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold shrink-0">
                      {unacknowledgedAlarmsCount > 99
                        ? "99+"
                        : unacknowledgedAlarmsCount}
                    </span>
                  )}
                </span>
              )}
              {collapsed && showBadge && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
              )}
            </span>
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>{navLink}</TooltipTrigger>
              <TooltipContent
                side="right"
                className="font-semibold flex items-center gap-2"
              >
                {item.label}
                {showBadge && (
                  <span className="bg-destructive text-white text-[9px] rounded-full h-4 px-1.5 flex items-center justify-center font-bold">
                    {unacknowledgedAlarmsCount}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        }

        return navLink;
      });
  };

  const SectionHeader = ({ label }: { label: string }) => {
    if (collapsed) return <div className="h-px bg-border mx-4 my-2" />;
    return (
      <div className="flex items-center px-3 mb-1 mt-4">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mr-2 shrink-0">
          {label}
        </span>
        <div className="h-px bg-border flex-1" />
      </div>
    );
  };

  const systemVisible = systemItems.some((i) => canAccess(i.minRole));

  const RoleIcon = isSuperAdmin ? Crown : isAdmin ? ShieldCheck : Shield;
  const roleStyle = ROLE_LABELS[role];

  return (
    <div
      className={cn(
        "flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out relative",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Brand header */}
      <div
        className={cn(
          "flex h-14 items-center border-b shrink-0",
          collapsed ? "justify-center px-0" : "px-4",
        )}
      >
        {/*
          Logo chip strategy:
          The PNG has a dark-navy background baked in (not transparent).
          We absolute-position the img LARGER than its container so overflow-hidden
          crops precisely to the N icon mark, discarding the text rows at the bottom.

          Math (logo is 1024×683):
            Collapsed  32×32 chip → img 80px wide → 53px tall → top 60% = 32px = N mark ✓
            Expanded   36×36 chip → img 90px wide → 60px tall → top 60% = 36px = N mark ✓
          Horizontal center: left = −(imgWidth − chipSize) / 2
        */}
        <div
          className={cn(
            "relative shrink-0 rounded-xl overflow-hidden",
            "dark:shadow-[0_0_14px_2px_rgba(59,130,246,0.18)]",
            collapsed ? "h-8 w-8" : "h-9 w-9 mr-3",
          )}
          style={{ background: '#0b1628' }}
        >
          <img
            src={logoUrl}
            alt="NOCpulse"
            style={{
              position: 'absolute',
              width:  collapsed ? 80 : 90,
              height: 'auto',
              left:   collapsed ? -24 : -27,
              top: 0,
            }}
          />
        </div>

        {!collapsed && (
          <div className="flex flex-1 items-center justify-between min-w-0">
            <div className="min-w-0">
              <div className="text-[15px] font-bold tracking-tight leading-none text-foreground">
                NOCpulse
              </div>
              <div className="text-[8px] tracking-[0.14em] text-muted-foreground/50 uppercase mt-0.5 leading-none">
                Monitor&nbsp;·&nbsp;Analyze&nbsp;·&nbsp;Optimize
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 shrink-0 ml-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-green-500">
                Live
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-2 flex flex-col">
        <nav className="grid items-start px-2 text-sm font-medium gap-1">
          {!collapsed && (
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 mb-1 mt-2">
              Main
            </div>
          )}
          {renderNavLinks(mainItems)}

          <SectionHeader label="Network" />
          {renderNavLinks(networkItems)}

          <SectionHeader label="Operations" />
          {renderNavLinks(operationsItems)}

          {systemVisible && (
            <>
              <SectionHeader label="System" />
              {renderNavLinks(systemItems)}
            </>
          )}
        </nav>

        {/* Staff restriction notice */}
        {isStaff && !collapsed && (
          <div className="mx-3 mt-4 mb-2 rounded-lg border border-slate-500/20 bg-slate-500/5 px-3 py-2.5 flex items-start gap-2">
            <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold text-slate-400">
                Restricted Access
              </p>
              <p className="text-[9px] text-muted-foreground leading-snug mt-0.5">
                Some sections are hidden based on your Staff role.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      {onToggleCollapse && (
        <div className="px-2 pb-2 shrink-0 hidden sm:block">
          <button
            onClick={onToggleCollapse}
            className="flex items-center justify-center sm:justify-between w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-sidebar-accent/60 transition-colors"
          >
            {!collapsed && (
              <span className="uppercase tracking-widest font-bold text-[9px]">
                Collapse
              </span>
            )}
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      {/* User card */}
      <div className="border-t p-3 shrink-0 space-y-2">
        {collapsed ? (
          <div className="flex justify-center">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div
                  className={`h-8 w-8 rounded-full ${roleStyle.bg} border ${roleStyle.border} flex items-center justify-center cursor-pointer hover:ring-2 ring-primary/50 transition-all shrink-0`}
                >
                  <span className={`text-xs font-bold ${roleStyle.color}`}>
                    {user.initials}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold">{user.name}</p>
                <p className={`text-[10px] ${roleStyle.color}`}>
                  {roleStyle.label}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="rounded-lg bg-card border shadow-sm p-2.5 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className={`h-8 w-8 rounded-full ${roleStyle.bg} border ${roleStyle.border} flex items-center justify-center shrink-0`}
              >
                <span className={`text-xs font-bold ${roleStyle.color}`}>
                  {user.initials}
                </span>
              </div>
              <div className="flex flex-col truncate min-w-0">
                <span className="text-xs font-semibold truncate">
                  {user.name}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <RoleIcon
                    className={`h-2.5 w-2.5 shrink-0 ${roleStyle.color}`}
                  />
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider ${roleStyle.color}`}
                  >
                    {roleStyle.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Demo role switcher */}
            <div className="space-y-1">
              <p className="text-[8px] uppercase tracking-widest font-bold text-muted-foreground/50 px-0.5">
                Demo Role
              </p>
              <div className="flex gap-1">
                {[
                  { r: "super_admin" as UserRole, label: "SAdm", Icon: Crown },
                  { r: "admin" as UserRole, label: "Admin", Icon: ShieldCheck },
                  { r: "staff" as UserRole, label: "Staff", Icon: Shield },
                ].map(({ r, label, Icon }) => {
                  const rs = ROLE_LABELS[r];
                  const active = role === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-0.5 px-1 py-1 rounded text-[9px] font-bold border transition-all",
                        active
                          ? `${rs.bg} ${rs.color} ${rs.border}`
                          : "border-border/40 text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground",
                      )}
                      title={`Switch to ${rs.label}`}
                    >
                      <Icon className="h-2.5 w-2.5 shrink-0" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
