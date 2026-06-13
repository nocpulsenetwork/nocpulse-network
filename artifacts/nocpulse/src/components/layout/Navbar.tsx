import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Bell,
  Menu,
  User,
  Settings as SettingsIcon,
  Crown,
  LogOut,
  ShieldCheck,
  Shield,
  Server,
  Wifi,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { onus, olts } from "@/data/mockData";
import { useRole, ROLE_LABELS } from "@/contexts/RoleContext";
import { useApiData } from "@/contexts/ApiDataContext";
import { formatDistanceToNow } from "date-fns";
import { getAlarmHref } from "@/lib/alarmNav";

interface NavbarProps {
  onMenuClick?: () => void;
  title?: string;
}

export function Navbar({ onMenuClick, title = "NOCpulse" }: NavbarProps) {
  const { role, user, logout } = useRole();
  const roleStyle = ROLE_LABELS[role];
  const RoleIcon =
    role === "super_admin" ? Crown : role === "admin" ? ShieldCheck : Shield;

  const [time, setTime] = useState(new Date());
  const [, navigate] = useLocation();

  /* ── Search state ─────────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  /* Refs for positioning */
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Dropdown pixel coords (fixed position, computed from input rect) */
  const [dropPos, setDropPos] = useState({ top: 58, right: 16, width: 360 });

  /* Recompute position whenever dropdown opens or window resizes */
  const updateDropPos = () => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    setDropPos({
      top: r.bottom + 6,
      right: window.innerWidth - r.right,
      width: Math.max(r.width, 340),
    });
  };

  useLayoutEffect(() => {
    if (isOpen) updateDropPos();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("resize", updateDropPos);
    return () => window.removeEventListener("resize", updateDropPos);
  }, [isOpen]);

  /* Close on outside click */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedIdx(-1);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* Reset keyboard selection when query changes */
  useEffect(() => {
    setSelectedIdx(-1);
  }, [searchQuery]);

  /* Clock */
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── Search results ────────────────────────────────────────────────── */
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const onuResults = onus
      .filter((o) =>
        [o.onuNo, o.description, o.customerName, o.macAddress,
         o.clientMac, o.ponPort, o.oltPort, o.status, o.onuType,
         String(o.vlanId)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        label: o.customerName || o.description || o.onuNo,
        sub: `${o.onuNo} · VLAN ${o.vlanId} · ${o.status}`,
        href: `/onus/${o.id}`,
        status: o.status,
        kind: "ONU" as const,
      }));

    const oltResults = olts
      .filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.ip.toLowerCase().includes(q) ||
          (o.location ?? "").toLowerCase().includes(q) ||
          (o.brand ?? "").toLowerCase().includes(q),
      )
      .slice(0, 3)
      .map((o) => ({
        id: o.id,
        label: o.name,
        sub: `${o.ip} · ${o.location} · ${o.status}`,
        href: `/olts/${o.id}`,
        status: o.status,
        kind: "OLT" as const,
      }));

    return [...onuResults, ...oltResults].slice(0, 7);
  }, [searchQuery]);

  const showDropdown = isOpen && searchQuery.trim().length >= 1;

  /* ── Keyboard navigation ───────────────────────────────────────────── */
  const commitResult = (href: string) => {
    navigate(href);
    setIsOpen(false);
    setSearchQuery("");
    setSelectedIdx(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
      setSelectedIdx(-1);
      return;
    }
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = selectedIdx >= 0 ? searchResults[selectedIdx] : searchResults[0];
      if (target) commitResult(target.href);
    }
  };

  /* ── Alarm helpers — single source of truth from alarm engine ──────── */
  const { alarms: liveAlarms, metrics } = useApiData();
  const activeAlarms = liveAlarms.filter((a) =>
    a.alarmStatus !== undefined ? a.alarmStatus === "active" : !a.acknowledged
  );
  const activeAlarmsCount = metrics.activeAlarms;
  const topAlarms = activeAlarms.slice(0, 10);

  const safeRelativeTime = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "recently";
      return formatDistanceToNow(d, { addSuffix: true });
    } catch {
      return "recently";
    }
  };

  const getSeverityColor = (s: string) =>
    s === "Critical" ? "border-l-red-500 bg-red-500/10 text-red-500"
    : s === "Major"   ? "border-l-amber-500 bg-amber-500/10 text-amber-500"
    : s === "Minor"   ? "border-l-blue-500 bg-blue-500/10 text-blue-500"
    :                   "border-l-slate-500 bg-slate-500/10 text-slate-500";

  const getSeverityBorder = (s: string) =>
    s === "Critical" ? "border-l-4 border-l-red-500"
    : s === "Major"  ? "border-l-4 border-l-amber-500"
    : s === "Minor"  ? "border-l-4 border-l-blue-500"
    :                  "border-l-4 border-l-slate-500";

  const scrollToTop = () => {
    document.getElementById("nocpulse-main")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* Status dot colour for result rows */
  const statusDot = (status: string) =>
    status === "Online" ? "bg-green-500" :
    status === "Offline" ? "bg-red-500" : "bg-amber-500";

  return (
    <header className="flex h-14 items-center gap-3 px-4 sm:px-6 w-full overflow-visible">
      <Button
        size="icon"
        variant="ghost"
        className="sm:hidden -ml-2 shrink-0"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </Button>

      <h1
        className="flex-1 min-w-0 text-sm font-semibold truncate cursor-pointer select-none hover:text-primary transition-colors"
        title="Scroll to top"
        onClick={scrollToTop}
      >
        {title}
      </h1>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Clock */}
        <div className="hidden sm:flex text-xs font-mono text-muted-foreground items-center shrink-0">
          {time.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" })}
          {" · "}
          {time.toLocaleTimeString()}
        </div>

        {/* Active incidents pill */}
        <div className="hidden lg:flex items-center shrink-0">
          {activeAlarmsCount > 0 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-medium text-amber-500">Active Incidents</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-500">All Systems Operational</span>
            </div>
          )}
        </div>

        {/* ── Global search ──────────────────────────────────────────── */}
        <div ref={containerRef} className="relative shrink-0">

          {/* Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              ref={inputRef}
              id="global-search"
              name="global-search"
              type="text"
              placeholder="Search devices, IPs, VLAN..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setIsOpen(true); }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
              className="w-56 lg:w-72 pl-9 pr-8 bg-card text-foreground placeholder:text-muted-foreground border-border/60 rounded-lg shadow-sm focus-visible:ring-1 focus-visible:ring-primary/50 transition-shadow"
            />
            {searchQuery && (
              <button
                onMouseDown={(e) => { e.preventDefault(); setSearchQuery(""); setIsOpen(false); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* ── Dropdown — rendered into document.body via portal ─────── */}
          {showDropdown && createPortal(
            <div
              className="fixed z-[99999] bg-popover border border-border/80 rounded-xl shadow-2xl overflow-hidden"
              style={{
                top: dropPos.top,
                right: dropPos.right,
                width: dropPos.width,
                maxHeight: 380,
                overflowY: "auto",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-muted/30 sticky top-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {searchResults.length > 0
                    ? `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`
                    : "No results"}
                </span>
                <span className="text-[10px] text-muted-foreground hidden sm:block">
                  ↑↓ navigate · Enter to open · Esc to close
                </span>
              </div>

              {/* Results */}
              {searchResults.length > 0 ? (
                <div>
                  {searchResults.map((r, i) => {
                    const isSelected = i === selectedIdx;
                    const Icon = r.kind === "OLT" ? Server : Wifi;
                    const kindCls = r.kind === "OLT"
                      ? "bg-violet-500/15 text-violet-400 border-violet-500/40"
                      : "bg-cyan-500/15 text-cyan-400 border-cyan-500/40";
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); commitResult(r.href); }}
                        onMouseEnter={() => setSelectedIdx(i)}
                        className={[
                          "w-full flex items-center gap-3 px-4 py-3 text-left border-l-[3px] transition-colors",
                          isSelected
                            ? "bg-primary/10 border-l-primary"
                            : "border-l-transparent hover:bg-muted/60 hover:border-l-border",
                        ].join(" ")}
                      >
                        {/* Icon */}
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${r.kind === "OLT" ? "bg-violet-500/10" : "bg-cyan-500/10"}`}>
                          <Icon className={`h-4 w-4 ${r.kind === "OLT" ? "text-violet-400" : "text-cyan-400"}`} />
                        </div>

                        {/* Label + sub */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-foreground truncate leading-none">
                            {r.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {r.sub}
                          </p>
                        </div>

                        {/* Kind badge + status dot */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`inline-flex px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-wide ${kindCls}`}>
                            {r.kind}
                          </span>
                          <span className={`h-2 w-2 rounded-full ${statusDot(r.status)}`} title={r.status} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No results for{" "}
                    <span className="font-semibold text-foreground">"{searchQuery}"</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    Try an OLT name, IP address, ONU number, or VLAN
                  </p>
                </div>
              )}
            </div>
          , document.body)}
        </div>

        {/* ── Bell / Notifications ────────────────────────────────────── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground shrink-0"
            >
              <Bell className="h-5 w-5" />
              {activeAlarmsCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center shadow-[0_0_0_2px_hsl(var(--background))]">
                  {activeAlarmsCount > 99 ? "99+" : activeAlarmsCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[320px] p-0">
            <DropdownMenuLabel className="p-3">Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator className="m-0" />
            <div className="flex flex-col max-h-[300px] overflow-y-auto">
              {topAlarms.length > 0 ? (
                topAlarms.map((alarm) => (
                  <Link
                    key={alarm.id}
                    href={getAlarmHref(alarm)}
                    className={`flex flex-col p-3 border-b border-border/50 hover:bg-muted/50 cursor-pointer ${getSeverityBorder(alarm.severity)}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${getSeverityColor(alarm.severity)}`}>
                        {alarm.severity}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{safeRelativeTime(alarm.timestamp)}</span>
                    </div>
                    <span className="font-medium text-sm">{alarm.deviceName}</span>
                    <span className="text-xs text-muted-foreground truncate" title={alarm.description}>
                      {alarm.description}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              )}
            </div>
            {activeAlarmsCount > 0 && (
              <div className="p-2 border-t border-border/50">
                <Link
                  href="/alarms"
                  className="block text-center text-xs font-medium text-primary hover:underline py-1"
                >
                  View all {activeAlarmsCount} alarms &rarr;
                </Link>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="block w-px h-6 bg-border mx-1 shrink-0" />

        {/* ── User avatar / profile ──────────────────────────────────── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`h-8 w-8 rounded-full ${roleStyle.bg} border ${roleStyle.border} flex items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 outline-none shrink-0`}
            >
              <span className={`text-xs font-bold ${roleStyle.color}`}>{user.initials}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full ${roleStyle.bg} border ${roleStyle.border} flex items-center justify-center shrink-0`}>
                    <span className={`text-xs font-bold ${roleStyle.color}`}>{user.initials}</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-sm font-semibold leading-none">{user.name}</p>
                    <p className="text-[10px] leading-none text-muted-foreground mt-0.5">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${roleStyle.bg} ${roleStyle.color} ${roleStyle.border} text-[10px] font-bold uppercase tracking-wider`}>
                    <RoleIcon className="h-2.5 w-2.5" /> {roleStyle.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{user.title}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2">
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer gap-2">
              <Link href="/settings" className="w-full flex items-center">
                <SettingsIcon className="h-4 w-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => { logout(); window.location.href = '/login'; }}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
