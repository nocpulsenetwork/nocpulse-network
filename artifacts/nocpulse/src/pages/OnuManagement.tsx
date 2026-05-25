import { useState, useEffect, useMemo } from "react";
import { onus, olts, type SignalStability } from "@/data/mockData";
import { StatusBadge } from "@/components/StatusBadge";
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
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  ChevronRight as Crumb,
  Filter,
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

const getRxColor = (power: number) => {
  if (power > -25) return "text-green-500";
  if (power >= -28) return "text-amber-500";
  return "text-red-500";
};

const getTxColor = (power: number) => {
  if (power < -3 || power > 5) return "text-red-500";
  if (power < 0) return "text-amber-500";
  return "text-green-500";
};

const getReasonBadgeColor = (reason: string) => {
  switch (reason) {
    case "Power Loss":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "Signal Lost":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "Admin Reboot":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    default:
      return "bg-muted/50 text-muted-foreground border-border/40";
  }
};

const getStabilityStyle = (stability: SignalStability) => {
  switch (stability) {
    case "Stable":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "Weak Signal":
      return "bg-amber-400/10 text-amber-500 border-amber-400/20";
    case "Unstable":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "High Loss":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "Offline":
      return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
};

const getOnuTypeBadgeClass = (type: string) => {
  if (type === "EPON") return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
  if (type === "XPON")
    return "bg-purple-500/10 text-purple-400 border-purple-500/20";
  return "bg-primary/10 text-primary border-primary/20";
};

type ConfirmAction = {
  type: "reboot" | "disable" | "enable";
  onuId: string;
} | null;

export default function OnuManagement() {
  const [, setLocation] = useLocation();

  const searchParams = new URLSearchParams(window.location.search);
  const initialStatus = searchParams.get("status");
  const initialOlt = searchParams.get("olt");
  const initialPon = searchParams.get("pon");

  const normalise = (raw: string | null, fallback: string) =>
    raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : fallback;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    normalise(initialStatus, "All Status"),
  );
  const [oltFilter, setOltFilter] = useState<string>(initialOlt ?? "All OLTs");
  const [ponFilter, setPonFilter] = useState<string>(initialPon ?? "All PONs");
  const [stabilityFilter, setStabilityFilter] = useState<string>("All");

  const [page, setPage] = useState(1);
  const [editingOnu, setEditingOnu] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("status");
    const o = sp.get("olt");
    const p = sp.get("pon");
    if (s) setStatusFilter(s.charAt(0).toUpperCase() + s.slice(1));
    if (o) setOltFilter(o);
    if (p) setPonFilter(p);
  }, []);

  // Precompute OLT name map for fast lookups
  const oltNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    olts.forEach((o) => {
      m[o.id] = o.name.toLowerCase();
    });
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
      const matchesStatus =
        statusFilter === "All Status" || onu.status === statusFilter;
      const matchesOlt = oltFilter === "All OLTs" || onu.oltId === oltFilter;
      const matchesPon = ponFilter === "All PONs" || onu.ponPort === ponFilter;
      const matchesStability =
        stabilityFilter === "All" || onu.signalStability === stabilityFilter;
      return (
        matchesSearch &&
        matchesStatus &&
        matchesOlt &&
        matchesPon &&
        matchesStability
      );
    });
  }, [
    searchTerm,
    statusFilter,
    oltFilter,
    ponFilter,
    stabilityFilter,
    oltNameMap,
  ]);

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

  const paginatedOnus = filteredOnus.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );
  const totalPages = Math.ceil(filteredOnus.length / ITEMS_PER_PAGE);

  const activeOlt = olts.find((o) => o.id === oltFilter);

  // Dynamic PON ports: when an OLT is selected, generate all its ports; otherwise derive from data
  const availablePonPorts = useMemo(() => {
    if (oltFilter !== "All OLTs" && activeOlt) {
      return Array.from(
        { length: activeOlt.ponPortCount },
        (_, i) => `PON-${i + 1}`,
      );
    }
    const ports = new Set(onus.map((o) => o.ponPort));
    return Array.from(ports).sort((a, b) => {
      const na = parseInt(a.replace("PON-", ""), 10);
      const nb = parseInt(b.replace("PON-", ""), 10);
      return na - nb;
    });
  }, [oltFilter, activeOlt]);

  // Reset PON filter if selected port no longer exists in current OLT's port list
  useEffect(() => {
    if (ponFilter !== "All PONs" && !availablePonPorts.includes(ponFilter)) {
      setPonFilter("All PONs");
    }
  }, [availablePonPorts, ponFilter]);

  // Chip counts respect OLT / PON / search context but ignore status/stability
  // so they accurately show "how many match this chip within current view"
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

  return (
    <div className="space-y-5 pb-10">
      {/* Breadcrumb */}
      {activeOlt ? (
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            href="/olts"
            className="hover:text-foreground transition-colors"
          >
            OLT Management
          </Link>
          <Crumb className="h-3.5 w-3.5 shrink-0" />
          <Link
            href={`/olts/${activeOlt.id}`}
            className="hover:text-foreground transition-colors"
          >
            {activeOlt.name}
          </Link>
          <Crumb className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-medium">ONU List</span>
          {statusFilter !== "All Status" && (
            <>
              <Crumb className="h-3.5 w-3.5 shrink-0" />
              <span
                className={`font-medium ${statusFilter === "Online" ? "text-green-400" : statusFilter === "Offline" ? "text-red-400" : "text-amber-400"}`}
              >
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
          <h1 className="text-2xl font-bold tracking-tight">ONU Management</h1>
          <div className="text-muted-foreground flex items-center gap-2 text-sm mt-0.5">
            {activeOlt ? (
              <>
                Showing ONUs connected to{" "}
                <span className="text-primary font-medium">
                  {activeOlt.name}
                </span>
              </>
            ) : (
              "Monitor and manage customer premises equipment"
            )}
            <Badge variant="secondary">Total: {filteredOnus.length} ONUs</Badge>
          </div>
        </div>
        <Button
          variant="outline"
          disabled
          className="opacity-50 cursor-not-allowed"
        >
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
              <button
                onClick={() => {
                  setOltFilter("All OLTs");
                  setPage(1);
                }}
                className="ml-0.5 hover:text-foreground transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {statusFilter !== "All Status" && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                statusFilter === "Online"
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : statusFilter === "Offline"
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              Status: {statusFilter}
              <button
                onClick={() => {
                  setStatusFilter("All Status");
                  setPage(1);
                }}
                className="ml-0.5 hover:text-foreground transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {ponFilter !== "All PONs" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {ponFilter}
              <button
                onClick={() => {
                  setPonFilter("All PONs");
                  setPage(1);
                }}
                className="ml-0.5 hover:text-foreground transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {stabilityFilter !== "All" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/50">
              Stability: {stabilityFilter}
              <button
                onClick={() => {
                  setStabilityFilter("All");
                  setPage(1);
                }}
                className="ml-0.5 hover:text-foreground transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {searchTerm !== "" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/50">
              Search: "{searchTerm}"
              <button
                onClick={() => {
                  setSearchTerm("");
                  setPage(1);
                }}
                className="ml-0.5 hover:text-foreground transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full sm:w-[260px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ONU, MAC, VLAN, port..."
            className="pl-8 text-sm"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select
          value={oltFilter}
          onValueChange={(v) => {
            setOltFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger
            className={`w-[160px] ${oltFilter !== "All OLTs" ? "border-primary/50 text-primary" : ""}`}
          >
            <SelectValue placeholder="All OLTs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All OLTs">All OLTs</SelectItem>
            {olts.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={ponFilter}
          onValueChange={(v) => {
            setPonFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger
            className={`w-[120px] ${ponFilter !== "All PONs" ? "border-cyan-500/50 text-cyan-400" : ""}`}
          >
            <SelectValue placeholder="All PONs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All PONs">All PONs</SelectItem>
            {availablePonPorts.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger
            className={`w-[130px] ${
              statusFilter === "Online"
                ? "border-green-500/50 text-green-400"
                : statusFilter === "Offline"
                  ? "border-red-500/50 text-red-400"
                  : statusFilter === "Degraded"
                    ? "border-amber-500/50 text-amber-400"
                    : ""
            }`}
          >
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Status">All Status</SelectItem>
            <SelectItem value="Online">Online</SelectItem>
            <SelectItem value="Offline">Offline</SelectItem>
            <SelectItem value="Degraded">Degraded</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={stabilityFilter}
          onValueChange={(v) => {
            setStabilityFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
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
      </div>

      {/* Quick filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            {
              label: "All",
              status: "All Status",
              stability: "All",
              color:
                "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary",
              activeColor: "bg-primary/10 border-primary/50 text-primary",
            },
            {
              label: "Online",
              status: "Online",
              stability: "All",
              color:
                "border-border/60 text-muted-foreground hover:border-green-500/40 hover:text-green-400",
              activeColor: "bg-green-500/10 border-green-500/50 text-green-400",
            },
            {
              label: "Offline",
              status: "Offline",
              stability: "All",
              color:
                "border-border/60 text-muted-foreground hover:border-red-500/40 hover:text-red-400",
              activeColor: "bg-red-500/10 border-red-500/50 text-red-400",
            },
            {
              label: "Weak Signal",
              status: "All Status",
              stability: "Weak Signal",
              color:
                "border-border/60 text-muted-foreground hover:border-amber-400/40 hover:text-amber-400",
              activeColor: "bg-amber-400/10 border-amber-400/50 text-amber-400",
            },
            {
              label: "High Loss",
              status: "All Status",
              stability: "High Loss",
              color:
                "border-border/60 text-muted-foreground hover:border-red-500/40 hover:text-red-500",
              activeColor: "bg-red-500/10 border-red-500/50 text-red-500",
            },
            {
              label: "Unstable",
              status: "All Status",
              stability: "Unstable",
              color:
                "border-border/60 text-muted-foreground hover:border-amber-500/40 hover:text-amber-500",
              activeColor: "bg-amber-500/10 border-amber-500/50 text-amber-500",
            },
          ] as const
        ).map((chip) => {
          const isActive =
            chip.label === "All"
              ? statusFilter === "All Status" && stabilityFilter === "All"
              : statusFilter === chip.status &&
                stabilityFilter === chip.stability;
          const count =
            chip.label === "All"
              ? chipBaseOnus.length
              : chipBaseOnus.filter(
                  (o) =>
                    (chip.status === "All Status" ||
                      o.status === chip.status) &&
                    (chip.stability === "All" ||
                      o.signalStability === chip.stability),
                ).length;
          return (
            <button
              key={chip.label}
              onClick={() => {
                setStatusFilter(chip.status as string);
                setStabilityFilter(chip.stability as string);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isActive ? chip.activeColor : chip.color}`}
            >
              {chip.label}
              <span
                className={`text-[10px] font-mono px-1 py-0.5 rounded ${isActive ? "bg-current/10" : "bg-muted/60"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden bg-card/80 shadow-lg">
        <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                <TableHead className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-3">
                  ONU / PON
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-3">
                  Customer
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-3">
                  OLT / Port
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-3">
                  MAC Addresses
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-3">
                  RX Power
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-3">
                  TX Power
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-3 text-right">
                  Distance
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-3">
                  Uptime / Reason
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground whitespace-nowrap px-3">
                  Stability
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-3">
                  Status
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground w-[60px] px-3">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOnus.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <WifiOff className="h-10 w-10 mb-4 opacity-20" />
                      <p className="text-lg font-medium text-foreground">
                        No ONUs found
                      </p>
                      <p className="text-sm mb-4">
                        Try adjusting your filters or search term
                      </p>
                      {hasActiveFilters && (
                        <Button variant="outline" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOnus.map((onu) => {
                  const parentOlt = olts.find((o) => o.id === onu.oltId);
                  const ponNum = onu.onuNo.split("/")[1] ?? "?";
                  const delta =
                    onu.lastOfflineRxPower !== null
                      ? parseFloat(
                          (onu.signalLevel - onu.lastOfflineRxPower).toFixed(1),
                        )
                      : null;
                  const improved = delta !== null && delta > 0;
                  const worsened = delta !== null && delta < 0;

                  return (
                    <TableRow
                      key={onu.id}
                      className="hover:bg-primary/5 hover:border-l-4 hover:border-l-primary hover:shadow-lg hover:scale-[1.01] hover:shadow-primary/10
                      transition-all duration-200 border-b border-border/40
                      cursor-pointer select-none hover:text-foreground group"
                      onClick={(e) => {
                        if (!(e.target as HTMLElement).closest(".action-col")) {
                          setLocation(`/onus/${onu.id}`);
                        }
                      }}
                    >
                      <TableCell className="px-3 py-2.5">
                        <div className="font-mono font-bold text-xs">
                          {onu.onuNo}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[9px] font-mono bg-primary/10 text-primary border border-primary/20 rounded px-1 py-0.5">
                            VLAN {onu.vlanId}
                          </span>
                          <span className="text-[9px] text-muted-foreground bg-muted/50 border border-border/40 rounded px-1 py-0.5">
                            PON {ponNum}
                          </span>
                          <span
                            className={`text-[9px] font-bold border rounded px-1 py-0.5 ${getOnuTypeBadgeClass(onu.onuType)}`}
                          >
                            {onu.onuType}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="px-3 py-2.5 max-w-[160px]">
                        <div
                          className="text-xs font-medium truncate"
                          title={onu.description}
                        >
                          {onu.description}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {onu.customerName}
                        </div>
                      </TableCell>

                      <TableCell className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-xs font-medium text-primary">
                          {parentOlt?.name ?? onu.oltId}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                          {onu.oltPort}
                        </div>
                      </TableCell>

                      <TableCell className="px-3 py-2.5 whitespace-nowrap">
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {onu.macAddress}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                          {onu.clientMac}
                        </div>
                      </TableCell>

                      <TableCell className="px-3 py-2.5 whitespace-nowrap">
                        <div
                          className={`text-xs font-semibold ${getRxColor(onu.signalLevel)}`}
                        >
                          {onu.signalLevel} dBm
                        </div>
                        {delta !== null ? (
                          <div
                            className={`flex items-center gap-0.5 mt-0.5 text-[10px] font-medium ${improved ? "text-green-500" : worsened ? "text-red-500" : "text-muted-foreground"}`}
                          >
                            {improved ? (
                              <TrendingUp className="h-2.5 w-2.5" />
                            ) : worsened ? (
                              <TrendingDown className="h-2.5 w-2.5" />
                            ) : (
                              <Minus className="h-2.5 w-2.5" />
                            )}
                            {improved ? "+" : ""}
                            {delta} vs snapshot
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground/40 mt-0.5">
                            no snapshot
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="px-3 py-2.5 whitespace-nowrap">
                        <div
                          className={`text-xs font-semibold ${getTxColor(onu.txPower)}`}
                        >
                          {onu.txPower} dBm
                        </div>
                      </TableCell>

                      <TableCell className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="text-xs text-muted-foreground font-mono">
                          {onu.distance}
                        </div>
                      </TableCell>

                      <TableCell className="px-3 py-2.5 whitespace-nowrap">
                        <div
                          className={`text-xs font-medium ${
                            onu.status === "Online"
                              ? "text-green-500"
                              : onu.status === "Offline"
                                ? "text-red-500"
                                : onu.status === "Degraded"
                                  ? "text-yellow-500"
                                  : "text-muted-foreground"
                          }`}
                        >
                          {onu.onlineDuration === "N/A"
                            ? "—"
                            : onu.onlineDuration}
                        </div>
                        {onu.lastLogoutReason !== "N/A" && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] mt-1 ${getReasonBadgeColor(onu.lastLogoutReason)}`}
                          >
                            {onu.lastLogoutReason}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="px-3 py-2.5 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${getStabilityStyle(onu.signalStability)}`}
                        >
                          {onu.signalStability}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-3 py-2.5">
                        <StatusBadge
                          status={onu.status}
                          className={
                            onu.status === "Online"
                              ? "border-green-500/30 bg-green-500/10 text-green-500"
                              : onu.status === "Offline"
                                ? "border-red-500/30 bg-red-500/10 text-red-500"
                                : onu.status === "Degraded"
                                  ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500"
                                  : ""
                          }
                        />
                      </TableCell>

                      <TableCell
                        className="action-col px-3 py-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-7 w-7 p-0 opacity-40 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-56 rounded-xl border border-border/50 shadow-2xl"
                            >
                              <DropdownMenuItem
                                onClick={() => setLocation(`/onus/${onu.id}`)}
                              >
                                View ONU Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmAction({
                                    type: "reboot",
                                    onuId: onu.id,
                                  })
                                }
                              >
                                Instant Reboot ONU
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {onu.status !== "Offline" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmAction({
                                      type: "disable",
                                      onuId: onu.id,
                                    })
                                  }
                                  className="text-red-500"
                                >
                                  Disable ONU Service
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmAction({
                                      type: "enable",
                                      onuId: onu.id,
                                    })
                                  }
                                >
                                  Restore ONU Service
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingOnu(onu.id);
                                  setEditDesc(onu.description);
                                }}
                              >
                                Edit Description
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(page * ITEMS_PER_PAGE, filteredOnus.length)} of{" "}
            {filteredOnus.length} ONUs
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Edit Description Dialog */}
      <Dialog
        open={!!editingOnu}
        onOpenChange={(open) => !open && setEditingOnu(null)}
      >
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
            <Button variant="outline" onClick={() => setEditingOnu(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success("Description updated successfully");
                setEditingOnu(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation Modals ── */}
      <ConfirmModal
        open={confirmAction?.type === "reboot"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() =>
          toast.success(`Reboot sent to ${confirmOnu?.description ?? "ONU"}`, {
            description: "ONU will restart within 30 seconds",
          })
        }
        title="Reboot ONU"
        description="This will send a remote reboot command to the ONU. The customer will lose connectivity for approximately 30–60 seconds while the device restarts."
        device={
          confirmOnu ? `${confirmOnu.onuNo} — ${confirmOnu.description}` : ""
        }
        confirmLabel="Reboot ONU"
        variant="warning"
        icon="reboot"
      />

      <ConfirmModal
        open={confirmAction?.type === "disable"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() =>
          toast.error(`ONU disabled: ${confirmOnu?.description ?? "ONU"}`, {
            description: "Service suspended. Use Enable to restore.",
          })
        }
        title="Disable ONU"
        description="This action will immediately disconnect the customer ONU from the OLT network. Internet service will stop until the ONU is restored manually by an administrator."
        device={
          confirmOnu ? `${confirmOnu.onuNo} — ${confirmOnu.description}` : ""
        }
        confirmLabel="Disable ONU"
        variant="danger"
        icon="disable"
      />

      <ConfirmModal
        open={confirmAction?.type === "enable"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() =>
          toast.success(`ONU enabled: ${confirmOnu?.description ?? "ONU"}`, {
            description: "ONU is coming back online",
          })
        }
        title="Enable ONU"
        description="This action will restore ONU connectivity and allow the customer device to reconnect to the OLT network automatically."
        device={
          confirmOnu ? `${confirmOnu.onuNo} — ${confirmOnu.description}` : ""
        }
        confirmLabel="Enable ONU"
        variant="warning"
        icon="enable"
      />
    </div>
  );
}
