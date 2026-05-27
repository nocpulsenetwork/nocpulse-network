import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { type OltDevice } from "@/data/mockData";
import { useApiData } from "@/contexts/ApiDataContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  LayoutGrid,
  List,
  Server,
  Cpu,
  MemoryStick,
  Thermometer,
  Activity,
  RefreshCw,
  Settings,
  Eye,
  MoreHorizontal,
  Wifi,
  WifiOff,
} from "lucide-react";

function BrandBadge({ brand }: { brand: string }) {
  const colors: Record<string, string> = {
    Huawei: "bg-red-500/10 text-red-400 border-red-500/20",
    ZTE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Nokia: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    Fiberhome: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    Calix: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colors[brand] ?? "bg-muted text-muted-foreground border-border"}`}
    >
      {brand}
    </span>
  );
}

function TypeBadge({ type }: { type: "GPON" | "EPON" }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
        type === "GPON"
          ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
          : "bg-violet-500/10 text-violet-400 border-violet-500/20"
      }`}
    >
      {type}
    </span>
  );
}

function UsageBar({
  value,
  icon: Icon,
}: {
  value: number;
  icon: React.ElementType;
}) {
  const color =
    value > 80 ? "bg-red-500" : value > 60 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span
        className={`text-[11px] font-mono shrink-0 w-8 text-right ${value > 80 ? "text-red-400" : value > 60 ? "text-amber-400" : "text-muted-foreground"}`}
      >
        {value}%
      </span>
    </div>
  );
}

export function UplinkBadge({
  status,
}: {
  status: "Active" | "Standby" | "Down";
}) {
  if (status === "Active")
    return (
      <span className="flex items-center gap-1 text-[11px] text-green-400">
        <Wifi className="h-3 w-3" />
        Active
      </span>
    );
  if (status === "Standby")
    return (
      <span className="flex items-center gap-1 text-[11px] text-amber-400">
        <Activity className="h-3 w-3" />
        Standby
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[11px] text-red-400">
      <WifiOff className="h-3 w-3" />
      Down
    </span>
  );
}

function OltActions({
  olt,
  onNavigate,
}: {
  olt: OltDevice;
  onNavigate: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg border border-border/50 hover:bg-primary/10 hover:border-primary/40 transition-all"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 rounded-xl border border-border/50"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(olt.id);
          }}
          className="gap-2 cursor-pointer"
        >
          <Eye className="h-4 w-4" /> View Details
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 cursor-pointer opacity-60" disabled>
          <RefreshCw className="h-4 w-4" /> Reboot (soon)
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 cursor-pointer opacity-60" disabled>
          <Settings className="h-4 w-4" /> Configure (soon)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function OltManagement() {
  const { olts, onus } = useApiData();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialStatus = searchParams.get("status");

  const [view, setView] = useState<"card" | "table">("card");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    initialStatus
      ? initialStatus.charAt(0).toUpperCase() + initialStatus.slice(1)
      : "All Status",
  );
  const [brandFilter, setBrandFilter] = useState<string>("All Brands");
  const [typeFilter, setTypeFilter] = useState<string>("All Types");

  const brands = Array.from(new Set(olts.map((o) => o.brand)));

  // Per-OLT ONU stats derived from live data
  const oltStats = useMemo(() => {
    const stats: Record<
      string,
      { online: number; offline: number; total: number; usedPons: Set<string> }
    > = {};
    onus.forEach((o) => {
      if (!stats[o.oltId])
        stats[o.oltId] = {
          online: 0,
          offline: 0,
          total: 0,
          usedPons: new Set(),
        };
      stats[o.oltId].total++;
      stats[o.oltId].usedPons.add(o.ponPort);
      if (o.status === "Online") stats[o.oltId].online++;
      else stats[o.oltId].offline++;
    });
    return stats;
  }, [onus]);

  const filteredOlts = useMemo(() => {
    return olts.filter((olt) => {
      const matchesSearch =
        olt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        olt.ip.includes(searchTerm) ||
        olt.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "All Status" || olt.status === statusFilter;
      const matchesBrand =
        brandFilter === "All Brands" || olt.brand === brandFilter;
      const matchesType = typeFilter === "All Types" || olt.type === typeFilter;

      return matchesSearch && matchesStatus && matchesBrand && matchesType;
    });
  }, [olts, searchTerm, statusFilter, brandFilter, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">OLT Management</h1>
          <div className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
            Optical Line Terminals
            <Badge variant="secondary">
              {filteredOlts.length} of {olts.length} OLTs
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-card/60 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-border/60">
        <div className="relative flex-1 min-w-[140px] sm:flex-none sm:w-full sm:max-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search OLTs..."
            className="pl-8 bg-background/50 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[130px] bg-background/50 min-w-[100px] flex-1 sm:flex-none">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Status">All Status</SelectItem>
            <SelectItem value="Online">Online</SelectItem>
            <SelectItem value="Offline">Offline</SelectItem>
            <SelectItem value="Degraded">Degraded</SelectItem>
          </SelectContent>
        </Select>

        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-full sm:w-[130px] bg-background/50 min-w-[100px] flex-1 sm:flex-none">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Brands">All Brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[120px] bg-background/50 min-w-[100px] flex-1 sm:flex-none">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Types">All Types</SelectItem>
            <SelectItem value="GPON">GPON</SelectItem>
            <SelectItem value="EPON">EPON</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center ml-auto gap-1 border border-border/60 p-1 rounded-md bg-background/50 shrink-0">
          <Button
            variant={view === "card" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("card")}
            className="h-7 px-2"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("table")}
            className="h-7 px-2"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOlts.map((olt) => {
            const s = oltStats[olt.id] ?? {
              online: 0,
              offline: 0,
              total: 0,
              usedPons: new Set<string>(),
            };
            const usedPon = s.usedPons.size;
            const emptyPon = Math.max(0, olt.ponPortCount - usedPon);
            return (
              <div
                key={olt.id}
                onClick={() => navigate(`/olts/${olt.id}`)}
                className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg hover:border-primary/40 hover:shadow-primary/10 transition-all duration-200 cursor-pointer group p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm">{olt.name}</h3>
                    <StatusBadge status={olt.status} className="mt-1" />
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <OltActions
                      olt={olt}
                      onNavigate={(id) => navigate(`/olts/${id}`)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <BrandBadge brand={olt.brand} />
                  <TypeBadge type={olt.type} />
                  {olt.mode === "BOTH" && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-purple-500/10 text-purple-400 border-purple-500/20">
                      BOTH
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {olt.location}
                  </span>
                </div>

                <div className="font-mono text-[10px] text-muted-foreground">
                  {olt.ip}
                </div>

                <div className="h-px w-full bg-border/60" />

                <div className="space-y-1.5">
                  {olt.cpu === 0 && olt.memory === 0 ? (
                    <div className="text-xs text-muted-foreground py-1 italic text-center">
                      Metrics unavailable
                    </div>
                  ) : (
                    <>
                      <UsageBar value={olt.cpu} icon={Cpu} />
                      <UsageBar value={olt.memory} icon={MemoryStick} />
                      <div className="flex items-center gap-2">
                        <Thermometer className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span
                          className={`text-[11px] font-mono font-bold ${olt.temperature > 55 ? "text-red-400" : olt.temperature > 45 ? "text-amber-400" : "text-green-400"}`}
                        >
                          {olt.temperature}°C
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="h-px w-full bg-border/60" />

                {/* ONU counts */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px]">
                      Online
                    </span>
                    <span className="font-semibold text-green-400 font-mono">
                      {s.online}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px]">
                      Offline
                    </span>
                    <span
                      className={`font-semibold font-mono ${s.offline > 0 ? "text-red-400" : "text-muted-foreground"}`}
                    >
                      {s.offline}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px]">
                      Used PON
                    </span>
                    <span className="font-semibold font-mono">
                      {usedPon}/{olt.ponPortCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px]">
                      Free PON
                    </span>
                    <span
                      className={`font-semibold font-mono ${emptyPon === 0 ? "text-red-400" : "text-muted-foreground"}`}
                    >
                      {emptyPon}
                    </span>
                  </div>
                </div>

                <div className="h-px w-full bg-border/60" />

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <UplinkBadge status={olt.uplinkStatus} />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {olt.uplinkPort}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right">
                    Sync: {new Date(olt.lastSync).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden backdrop-blur-sm bg-card/80 shadow-lg overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Brand
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Type
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  IP Address
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Ports
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Active ONUs
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  CPU
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Uplink
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Last Sync
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOlts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No OLTs found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOlts.map((olt) => (
                  <TableRow
                    key={olt.id}
                    onClick={() => navigate(`/onus?olt=${olt.id}`)}
                    className="hover:bg-primary/5 transition-colors duration-150 border-b border-border/40 cursor-pointer group"
                  >
                    <TableCell className="font-medium">{olt.name}</TableCell>
                    <TableCell>
                      <BrandBadge brand={olt.brand} />
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={olt.type} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {olt.ip}
                    </TableCell>
                    <TableCell>{olt.ponPortCount}</TableCell>
                    <TableCell>{olt.activeOnus}</TableCell>
                    <TableCell>
                      {olt.cpu === 0 ? (
                        <span className="text-muted-foreground text-xs">
                          --
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${olt.cpu > 80 ? "bg-red-500" : olt.cpu > 60 ? "bg-amber-500" : "bg-green-500"}`}
                              style={{ width: `${olt.cpu}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono">{olt.cpu}%</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <UplinkBadge status={olt.uplinkStatus} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={olt.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(olt.lastSync).toLocaleString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <OltActions
                        olt={olt}
                        onNavigate={(id) => navigate(`/olts/${id}`)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
