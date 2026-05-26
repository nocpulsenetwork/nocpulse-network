import { useState, useEffect, useMemo } from "react";
import { onus, olts, type SignalStability } from "@/data/mockData";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  WifiOff,
  MoreHorizontal,
  ChevronRight as Crumb,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Filter,
  Eye,
  RotateCcw,
  PowerOff,
  Power,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ConfirmModal";

// ─── Signal helpers ──────────────────────────────────────────────────────────

const getRxStyle = (power: number) => {
  if (power > -24)
    return { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/25" };
  if (power >= -27)
    return { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/25" };
  if (power >= -30)
    return { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/25" };
  return { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25" };
};

const getTxStyle = (power: number) => {
  if (power < -5 || power > 6)
    return { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25" };
  if (power < -1 || power > 4)
    return { text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/25" };
  return { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/25" };
};

const getReasonBadgeColor = (reason: string) => {
  switch (reason) {
    case "Power Loss":   return "bg-red-500/10 text-red-400 border-red-500/20";
    case "Signal Lost":  return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "Admin Reboot": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "LOS":          return "bg-red-500/10 text-red-400 border-red-500/20";
    case "Dying Gasp":   return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    default:             return "bg-muted/50 text-muted-foreground border-border/40";
  }
};

const getStabilityStyle = (stability: SignalStability) => {
  switch (stability) {
    case "Stable":      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "Weak Signal": return "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
    case "Unstable":    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "High Loss":   return "bg-red-500/10 text-red-400 border-red-500/20";
    case "Offline":     return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
};

const getAutoStability = (onu: { status: string; signalLevel: number }): SignalStability => {
  if (onu.status === "Offline") return "Offline";
  if (onu.signalLevel <= -29) return "High Loss";
  if (onu.signalLevel <= -27) return "Unstable";
  if (onu.signalLevel <= -25) return "Weak Signal";
  return "Stable";
};

const STATUS_CONFIG = {
  Online:   { dot: "bg-green-400", text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  Offline:  { dot: "bg-red-400",   text: "text-red-400",   bg: "bg-red-500/10",   border: "border-red-500/20"  },
  Degraded: { dot: "bg-amber-400 animate-pulse", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
} as const;

const getOnuTypeBadgeClass = (type: string) => {
  if (type === "EPON") return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
  if (type === "XPON") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
  return "bg-primary/10 text-primary border-primary/20";
};

// ─── Types ───────────────────────────────────────────────────────────────────

type ConfirmAction = { type: "reboot" | "disable" | "enable"; onuId: string } | null;

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnuManagement() {
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(window.location.search);
  const initialStatus = searchParams.get("status");
  const initialOlt = searchParams.get("olt");
  const initialPon = searchParams.get("pon");

  const normalise = (raw: string | null, fallback: string) =>
    raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : fallback;

  const [searchTerm,      setSearchTerm]      = useState("");
  const [statusFilter,    setStatusFilter]    = useState<string>(normalise(initialStatus, "All Status"));
  const [oltFilter,       setOltFilter]       = useState<string>(initialOlt ?? "All OLTs");
  const [ponFilter,       setPonFilter]       = useState<string>(initialPon ?? "All PONs");
  const [stabilityFilter, setStabilityFilter] = useState<string>("All");
  const [page,            setPage]            = useState(1);
  const [pageSize,        setPageSize]        = useState(100);
  const [editingOnu,      setEditingOnu]      = useState<string | null>(null);
  const [editDesc,        setEditDesc]        = useState("");
  const [confirmAction,   setConfirmAction]   = useState<ConfirmAction>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("status");
    const o = sp.get("olt");
    const p = sp.get("pon");
    if (s) setStatusFilter(s.charAt(0).toUpperCase() + s.slice(1));
    if (o) setOltFilter(o);
    if (p) setPonFilter(p);
  }, []);

  const oltNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    olts.forEach((o) => { m[o.id] = o.name.toLowerCase(); });
    return m;
  }, []);

  const filteredOnus = useMemo(() => {
    return onus.filter((onu) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        onu.onuNo.toLowerCase().includes(term) ||
        onu.description.toLowerCase().includes(term) ||
        onu.macAddress.toLowerCase().includes(term) ||
        onu.clientMac.toLowerCase().includes(term) ||
        onu.customerName.toLowerCase().includes(term) ||
        onu.oltPort.toLowerCase().includes(term) ||
        onu.ponPort.toLowerCase().includes(term) ||
        onu.vlanId.toString().includes(term) ||
        (oltNameMap[onu.oltId] ?? "").includes(term);
      const matchesStatus    = statusFilter === "All Status" || onu.status === statusFilter;
      const matchesOlt       = oltFilter === "All OLTs" || onu.oltId === oltFilter;
      const matchesPon       = ponFilter === "All PONs" || onu.ponPort === ponFilter;
      const matchesStability = stabilityFilter === "All" || onu.signalStability === stabilityFilter;
      return matchesSearch && matchesStatus && matchesOlt && matchesPon && matchesStability;
    });
  }, [searchTerm, statusFilter, oltFilter, ponFilter, stabilityFilter, oltNameMap]);

  const hasActiveFilters =
    searchTerm !== "" ||
    statusFilter !== "All Status" ||
    oltFilter !== "All OLTs" ||
    ponFilter !== "All PONs" ||
    stabilityFilter !== "All";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("All Status");
    setOltFilter("All OLTs");
    setPonFilter("All PONs");
    setStabilityFilter("All");
    setPage(1);
  };

  const totalPages   = Math.ceil(filteredOnus.length / pageSize);
  const paginatedOnus = filteredOnus.slice((page - 1) * pageSize, page * pageSize);
  const activeOlt    = olts.find((o) => o.id === oltFilter);

  const availablePonPorts = useMemo(() => {
    if (oltFilter !== "All OLTs" && activeOlt) {
      return Array.from({ length: activeOlt.ponPortCount }, (_, i) => `PON-${i + 1}`);
    }
    const ports = new Set(onus.map((o) => o.ponPort));
    return Array.from(ports).sort((a, b) => {
      const na = parseInt(a.replace("PON-", ""), 10);
      const nb = parseInt(b.replace("PON-", ""), 10);
      return na - nb;
    });
  }, [oltFilter, activeOlt]);

  useEffect(() => {
    if (ponFilter !== "All PONs" && !availablePonPorts.includes(ponFilter)) {
      setPonFilter("All PONs");
    }
  }, [availablePonPorts, ponFilter]);

  const chipBaseOnus = useMemo(() => {
    return onus.filter((o) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        o.onuNo.toLowerCase().includes(term) ||
        o.description.toLowerCase().includes(term) ||
        o.macAddress.toLowerCase().includes(term) ||
        o.clientMac.toLowerCase().includes(term) ||
        o.customerName.toLowerCase().includes(term) ||
        o.oltPort.toLowerCase().includes(term) ||
        o.ponPort.toLowerCase().includes(term) ||
        o.vlanId.toString().includes(term) ||
        (oltNameMap[o.oltId] ?? "").includes(term);
      const matchesOlt = oltFilter === "All OLTs" || o.oltId === oltFilter;
      const matchesPon = ponFilter === "All PONs" || o.ponPort === ponFilter;
      return matchesSearch && matchesOlt && matchesPon;
    });
  }, [searchTerm, oltFilter, ponFilter, oltNameMap]);

  const confirmOnu = onus.find((o) => o.id === confirmAction?.onuId);

  // Pagination helpers
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const QUICK_CHIPS = [
    { label: "All",         status: "All Status", stability: "All",         color: "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary",         activeColor: "bg-primary/10 border-primary/50 text-primary" },
    { label: "Online",      status: "Online",      stability: "All",         color: "border-border/60 text-muted-foreground hover:border-green-500/40 hover:text-green-400",    activeColor: "bg-green-500/10 border-green-500/50 text-green-400" },
    { label: "Offline",     status: "Offline",     stability: "All",         color: "border-border/60 text-muted-foreground hover:border-red-500/40 hover:text-red-400",       activeColor: "bg-red-500/10 border-red-500/50 text-red-400" },
    { label: "Weak Signal", status: "All Status",  stability: "Weak Signal", color: "border-border/60 text-muted-foreground hover:border-yellow-400/40 hover:text-yellow-400", activeColor: "bg-yellow-400/10 border-yellow-400/50 text-yellow-400" },
    { label: "High Loss",   status: "All Status",  stability: "High Loss",   color: "border-border/60 text-muted-foreground hover:border-red-500/40 hover:text-red-500",       activeColor: "bg-red-500/10 border-red-500/50 text-red-400" },
    { label: "Unstable",    status: "All Status",  stability: "Unstable",    color: "border-border/60 text-muted-foreground hover:border-amber-500/40 hover:text-amber-500",   activeColor: "bg-amber-500/10 border-amber-500/50 text-amber-400" },
  ] as const;

  return (
    <div className="space-y-5 pb-10">

      {/* Breadcrumb */}
      {activeOlt ? (
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/olts" className="hover:text-foreground transition-colors">OLT Management</Link>
          <Crumb className="h-3.5 w-3.5 shrink-0" />
          <Link href={`/olts/${activeOlt.id}`} className="hover:text-foreground transition-colors">{activeOlt.name}</Link>
          <Crumb className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-medium">ONU List</span>
          {statusFilter !== "All Status" && (
            <>
              <Crumb className="h-3.5 w-3.5 shrink-0" />
              <span className={`font-medium ${statusFilter === "Online" ? "text-green-400" : statusFilter === "Offline" ? "text-red-400" : "text-amber-400"}`}>
                {statusFilter} only
              </span>
            </>
          )}
        </nav>
      ) : (
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Network</span>
          <Crumb className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-medium">ONU Management</span>
        </nav>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            ONU Management
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mt-0.5">
            {activeOlt ? (
              <>Showing ONUs connected to <span className="text-primary font-medium">{activeOlt.name}</span></>
            ) : (
              "Monitor and manage customer premises equipment"
            )}
            <Badge variant="secondary" className="text-[11px]">{filteredOnus.length} ONUs</Badge>
          </div>
        </div>
        <Button variant="outline" disabled className="opacity-40 cursor-not-allowed">
          Export CSV
        </Button>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3 w-3" />
            <span>Active filters:</span>
          </div>
          {oltFilter !== "All OLTs" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              OLT: {activeOlt?.name ?? oltFilter}
              <button onClick={() => { setOltFilter("All OLTs"); setPage(1); }} className="ml-0.5 hover:text-foreground">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {statusFilter !== "All Status" && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusFilter === "Online" ? "bg-green-500/10 text-green-400 border-green-500/20" : statusFilter === "Offline" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
              Status: {statusFilter}
              <button onClick={() => { setStatusFilter("All Status"); setPage(1); }} className="ml-0.5 hover:text-foreground">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {ponFilter !== "All PONs" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {ponFilter}
              <button onClick={() => { setPonFilter("All PONs"); setPage(1); }} className="ml-0.5 hover:text-foreground">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {stabilityFilter !== "All" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/50">
              Stability: {stabilityFilter}
              <button onClick={() => { setStabilityFilter("All"); setPage(1); }} className="ml-0.5 hover:text-foreground">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {searchTerm !== "" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/50">
              "{searchTerm}"
              <button onClick={() => { setSearchTerm(""); setPage(1); }} className="ml-0.5 hover:text-foreground">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors ml-1">
            Clear all
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5 bg-card/80 p-3 rounded-xl border border-border/60 shadow-sm">
        <div className="relative flex-1 min-w-[200px] sm:max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search ONU, MAC, VLAN, customer…"
            className="pl-8 h-9 text-sm bg-background"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>

        <Select value={oltFilter} onValueChange={(v) => { setOltFilter(v); setPage(1); }}>
          <SelectTrigger className={`h-9 w-[155px] text-sm ${oltFilter !== "All OLTs" ? "border-primary/50 text-primary bg-primary/5" : "bg-background"}`}>
            <SelectValue placeholder="All OLTs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All OLTs">All OLTs</SelectItem>
            {olts.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={ponFilter} onValueChange={(v) => { setPonFilter(v); setPage(1); }}>
          <SelectTrigger className={`h-9 w-[115px] text-sm ${ponFilter !== "All PONs" ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/5" : "bg-background"}`}>
            <SelectValue placeholder="All PONs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All PONs">All PONs</SelectItem>
            {availablePonPorts.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className={`h-9 w-[125px] text-sm ${statusFilter === "Online" ? "border-green-500/50 text-green-400 bg-green-500/5" : statusFilter === "Offline" ? "border-red-500/50 text-red-400 bg-red-500/5" : statusFilter === "Degraded" ? "border-amber-500/50 text-amber-400 bg-amber-500/5" : "bg-background"}`}>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Status">All Status</SelectItem>
            <SelectItem value="Online">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-400" />Online</span>
            </SelectItem>
            <SelectItem value="Offline">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-400" />Offline</span>
            </SelectItem>
            <SelectItem value="Degraded">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400" />Degraded</span>
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={stabilityFilter} onValueChange={(v) => { setStabilityFilter(v); setPage(1); }}>
          <SelectTrigger className={`h-9 w-[135px] text-sm ${stabilityFilter !== "All" ? "border-primary/40 bg-primary/5" : "bg-background"}`}>
            <SelectValue placeholder="All Stability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Stability</SelectItem>
            <SelectItem value="Stable">Stable</SelectItem>
            <SelectItem value="Weak Signal">Weak Signal</SelectItem>
            <SelectItem value="Unstable">Unstable</SelectItem>
            <SelectItem value="High Loss">High Loss</SelectItem>
            <SelectItem value="Offline">Offline</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground hover:text-foreground gap-1.5 ml-auto">
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Quick filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK_CHIPS.map((chip) => {
          const isActive =
            chip.label === "All"
              ? statusFilter === "All Status" && stabilityFilter === "All"
              : statusFilter === chip.status && stabilityFilter === chip.stability;
          const count =
            chip.label === "All"
              ? chipBaseOnus.length
              : chipBaseOnus.filter((o) =>
                  (chip.status === "All Status" || o.status === chip.status) &&
                  (chip.stability === "All" || o.signalStability === chip.stability)
                ).length;
          return (
            <button
              key={chip.label}
              onClick={() => { setStatusFilter(chip.status as string); setStabilityFilter(chip.stability as string); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${isActive ? chip.activeColor : chip.color}`}
            >
              {chip.label}
              <span className={`min-w-[18px] text-center text-[10px] font-bold px-1 py-0.5 rounded-full ${isActive ? "bg-current/15" : "bg-muted/70"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card/80 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-20rem)] scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/60">
                <TableHead className="sticky top-0 bg-card z-10 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-4 py-3">
                  ONU / PON
                </TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-4 py-3">
                  Customer
                </TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-4 py-3 hidden md:table-cell">
                  OLT / Port
                </TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-4 py-3 hidden lg:table-cell">
                  MAC Addresses
                </TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-4 py-3">
                  <span className="text-cyan-400">RX</span>
                </TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-4 py-3">
                  <span className="text-violet-400">TX</span>
                </TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-4 py-3 text-right hidden lg:table-cell">
                  <span className="text-orange-400">Dist</span>
                </TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-4 py-3 hidden md:table-cell">
                  Uptime
                </TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-4 py-3 hidden md:table-cell">
                  Stability
                </TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-4 py-3">
                  Status
                </TableHead>
                <TableHead className="sticky top-0 bg-card z-10 w-10 px-3 py-3" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedOnus.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <div className="h-14 w-14 rounded-full bg-muted/30 flex items-center justify-center">
                        <WifiOff className="h-7 w-7 opacity-40" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-foreground">No ONUs found</p>
                        <p className="text-sm mt-0.5">Try adjusting your filters or search term</p>
                      </div>
                      {hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOnus.map((onu) => {
                  const parentOlt = olts.find((o) => o.id === onu.oltId);
                  const ponNum    = onu.onuNo.split("/")[1] ?? "?";
                  const delta     = onu.lastOfflineRxPower !== null
                    ? parseFloat((onu.signalLevel - onu.lastOfflineRxPower).toFixed(1))
                    : null;
                  const improved  = delta !== null && delta > 0;
                  const worsened  = delta !== null && delta < 0;
                  const rxStyle   = getRxStyle(onu.signalLevel);
                  const txStyle   = getTxStyle(onu.txPower);
                  const statusCfg = STATUS_CONFIG[onu.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.Offline;
                  const stability = getAutoStability(onu);

                  return (
                    <TableRow
                      key={onu.id}
                      className="border-b border-border/30 cursor-pointer select-none group transition-all duration-100 hover:bg-primary/[0.07] dark:hover:bg-primary/[0.09] border-l-2 border-l-transparent hover:border-l-primary/50"
                      onClick={(e) => {
                        if (!(e.target as HTMLElement).closest(".action-col")) {
                          setLocation(`/onus/${onu.id}`);
                        }
                      }}
                    >
                      {/* ONU / PON */}
                      <TableCell className="px-4 py-3.5">
                        <div className="font-mono font-bold text-sm tracking-tight">{onu.onuNo}</div>
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className="text-[9px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5">
                            VLAN {onu.vlanId}
                          </span>
                          <span className="text-[9px] text-muted-foreground bg-muted/50 border border-border/40 rounded px-1.5 py-0.5">
                            PON-{ponNum}
                          </span>
                          <span className={`text-[9px] font-semibold border rounded px-1.5 py-0.5 ${getOnuTypeBadgeClass(onu.onuType)}`}>
                            {onu.onuType}
                          </span>
                        </div>
                      </TableCell>

                      {/* Customer */}
                      <TableCell className="px-4 py-3.5 max-w-[120px]">
                        <div className="text-sm font-medium truncate" title={onu.description}>
                          {onu.description}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {onu.customerName}
                        </div>
                      </TableCell>

                      {/* OLT / Port */}
                      <TableCell className="px-4 py-3.5 whitespace-nowrap hidden md:table-cell">
                        <div className="text-sm font-medium text-primary">{parentOlt?.name ?? onu.oltId}</div>
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{onu.oltPort}</div>
                      </TableCell>

                      {/* MAC Addresses */}
                      <TableCell className="px-4 py-3.5 whitespace-nowrap hidden lg:table-cell">
                        <div className="text-[10px] font-mono text-muted-foreground">{onu.macAddress}</div>
                        <div className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">{onu.clientMac}</div>
                      </TableCell>

                      {/* RX Power */}
                      <TableCell className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono border ${rxStyle.text} ${rxStyle.bg} ${rxStyle.border}`}>
                          {onu.signalLevel} dBm
                        </span>
                        {delta !== null ? (
                          <div className={`flex items-center gap-0.5 mt-1 text-[10px] font-medium ${improved ? "text-green-400" : worsened ? "text-red-400" : "text-muted-foreground"}`}>
                            {improved ? <TrendingUp className="h-2.5 w-2.5" /> : worsened ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                            {improved ? "+" : ""}{delta}
                          </div>
                        ) : (
                          <div className="text-[9px] text-muted-foreground/40 mt-1">no snap</div>
                        )}
                      </TableCell>

                      {/* TX Power */}
                      <TableCell className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono border ${txStyle.text} ${txStyle.bg} ${txStyle.border}`}>
                          {onu.txPower} dBm
                        </span>
                      </TableCell>

                      {/* Distance */}
                      <TableCell className="px-4 py-3.5 text-right whitespace-nowrap hidden lg:table-cell">
                        <span className="text-xs font-semibold font-mono text-cyan-300">{onu.distance}</span>
                      </TableCell>

                      {/* Uptime / Reason */}
                      <TableCell className="px-4 py-3.5 whitespace-nowrap hidden md:table-cell">
                        <div className={`text-xs font-medium ${onu.status === "Online" ? "text-green-400" : onu.status === "Offline" ? "text-red-400" : onu.status === "Degraded" ? "text-amber-400" : "text-muted-foreground"}`}>
                          {onu.onlineDuration === "N/A" ? "—" : onu.onlineDuration}
                        </div>
                        {onu.lastLogoutReason !== "N/A" && (
                          <Badge variant="outline" className={`text-[9px] mt-1.5 font-semibold ${getReasonBadgeColor(onu.lastLogoutReason)}`}>
                            {onu.lastLogoutReason}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Stability */}
                      <TableCell className="px-4 py-3.5 whitespace-nowrap hidden md:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getStabilityStyle(stability)}`}>
                          {stability}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.border}`}>
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusCfg.dot}`} />
                          <span className={statusCfg.text}>{onu.status}</span>
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="action-col px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground border-border/50 hover:border-border bg-transparent hover:bg-muted/60 transition-colors data-[state=open]:bg-muted/60 data-[state=open]:border-border"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-xl border border-border/50 shadow-xl">
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onClick={() => setLocation("/onus/" + onu.id)}
                            >
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                              View ONU Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onClick={() => setConfirmAction({ type: "reboot", onuId: onu.id })}
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                              Instant Reboot
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {onu.status !== "Offline" ? (
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
                                onClick={() => setConfirmAction({ type: "disable", onuId: onu.id })}
                              >
                                <PowerOff className="h-3.5 w-3.5" />
                                Disable Service
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-green-500 focus:text-green-500 focus:bg-green-500/10"
                                onClick={() => setConfirmAction({ type: "enable", onuId: onu.id })}
                              >
                                <Power className="h-3.5 w-3.5" />
                                Restore Service
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onClick={() => { setEditingOnu(onu.id); setEditDesc(onu.description); }}
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              Edit Description
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages >= 1 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{filteredOnus.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredOnus.length)}</span> of <span className="font-medium text-foreground">{filteredOnus.length}</span> ONUs
            </p>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-7 w-[90px] text-xs bg-background border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100, 200, 300, 500, 1000].map(n => (
                  <SelectItem key={n} value={String(n)} className="text-xs">{n} / page</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={page === 1}
              onClick={() => setPage(1)}
              title="First page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              title="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            {getPageNumbers().map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "ghost"}
                  size="icon"
                  className={`h-8 w-8 text-xs font-medium ${p === page ? "" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </Button>
              )
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              title="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
              title="Last page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Description Dialog */}
      <Dialog open={!!editingOnu} onOpenChange={(open) => !open && setEditingOnu(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Description</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Enter new description"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOnu(null)}>Cancel</Button>
            <Button onClick={() => { toast.success("Description updated successfully"); setEditingOnu(null); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Modals */}
      <ConfirmModal
        open={confirmAction?.type === "reboot"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => toast.success("Reboot sent to ONU", { description: "ONU will restart within 30 seconds" })}
        title="Reboot ONU"
        description="This will send a remote reboot command to the ONU. The customer will lose connectivity for approximately 30–60 seconds while the device restarts."
        device={confirmOnu ? confirmOnu.onuNo + " — " + confirmOnu.description : ""}
        confirmLabel="Reboot ONU"
        variant="warning"
        icon="reboot"
      />
      <ConfirmModal
        open={confirmAction?.type === "disable"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => toast.error("ONU disabled", { description: "Service suspended. Use Enable to restore." })}
        title="Disable ONU"
        description="This action will immediately disconnect the customer ONU from the OLT network. Internet service will stop until the ONU is restored manually by an administrator."
        device={confirmOnu ? confirmOnu.onuNo + " — " + confirmOnu.description : ""}
        confirmLabel="Disable ONU"
        variant="danger"
        icon="disable"
      />
      <ConfirmModal
        open={confirmAction?.type === "enable"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => toast.success("ONU enabled", { description: "ONU is coming back online" })}
        title="Enable ONU"
        description="This action will restore ONU connectivity and allow the customer device to reconnect to the OLT network automatically."
        device={confirmOnu ? confirmOnu.onuNo + " — " + confirmOnu.description : ""}
        confirmLabel="Enable ONU"
        variant="warning"
        icon="enable"
      />
    </div>
  );
}
