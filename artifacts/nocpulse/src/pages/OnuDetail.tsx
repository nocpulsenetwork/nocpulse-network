import { useState, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { onus, olts } from "@/data/mockData";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  Signal,
  Radio,
  Ruler,
  Clock,
  ArrowLeft,
  AlertTriangle,
  Thermometer,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  Power,
  PowerOff,
  TrendingDown,
  TrendingUp,
  Minus,
  MoreVertical,
  MapPin,
  Tag,
  Globe,
  CheckCircle2,
  Timer,
  Settings,
  ShieldCheck,
  Download,
  Upload,
  Activity,
  Gauge,
} from "lucide-react";

const MAC_VENDOR_MAP: Record<string, { vendor: string; model: string }> = {
  "A4:C3:F0": { vendor: "TP-Link", model: "Archer Series" },
  "00:1A:2B": { vendor: "Cisco", model: "ISR Series" },
  "B0:4E:26": { vendor: "Huawei", model: "HG Series" },
  "FC:EC:DA": { vendor: "Ubiquiti", model: "EdgeRouter" },
  "DC:A6:32": { vendor: "Raspberry Pi", model: "Pi Router" },
};

function generateChartData(seed: number, dlBase: number, ulBase: number) {
  return Array.from({ length: 20 }).map((_, i) => {
    const t = i * 3;
    const noise = ((seed * (i + 1) * 2654435761) >>> 0) % 100;
    const pingNoise = ((seed * (i + 3) * 1234567891) >>> 0) % 20;
    return {
      t: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`,
      dl: Math.max(10, dlBase - 80 + (noise % 160)),
      ul: Math.max(5, ulBase - 30 + (noise % 60)),
      ping: Math.max(2, (seed % 15) + 5 + (pingNoise % 18)),
    };
  });
}

export default function OnuDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [modal, setModal] = useState<"reboot" | "disable" | "enable" | null>(null);

  const id = params?.id;
  const onu = onus.find((o) => o.id === id);

  if (!onu) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground opacity-40" />
        <h2 className="text-xl font-semibold">ONU not found</h2>
        <p className="text-sm text-muted-foreground">
          The requested ONU does not exist or has been removed.
        </p>
        <Button onClick={() => setLocation("/onus")} variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to ONU List
        </Button>
      </div>
    );
  }

  const parentOlt = olts.find((o) => o.id === onu.oltId);

  const displayDescription =
    onu.description || onu.customerName || onu.onuNo || "Unknown ONU";

  const isPoorSignal = onu.signalLevel < -28;
  const isWarningSignal = onu.signalLevel >= -28 && onu.signalLevel < -25;
  const isUp = onu.status !== "Offline";

  const seed = onu.id.charCodeAt(onu.id.length - 1);
  const maxBwMbps =
    parseInt(onu.bandwidth.split("/")[0].replace(/[^0-9]/g, "")) || 1000;
  const dlMbps = isUp ? Math.round(maxBwMbps * 0.62 + (seed % 25)) : 0;
  const ulMbps = isUp ? Math.round(maxBwMbps * 0.23 + (seed % 12)) : 0;
  const pingMs = !isUp
    ? null
    : onu.signalLevel > -25
      ? 5 + (seed % 4)
      : onu.signalLevel > -28
        ? 12 + (seed % 8)
        : 28 + (seed % 12);

  const powerDelta =
    onu.lastOfflineRxPower !== null
      ? parseFloat((onu.signalLevel - onu.lastOfflineRxPower).toFixed(1))
      : null;
  const powerImproved = powerDelta !== null && powerDelta > 0;
  const powerWorsened = powerDelta !== null && powerDelta < 0;

  const lossRate = !isUp ? null : onu.signalLevel > -25 ? 0.04 : onu.signalLevel > -28 ? 2.8 : 8.2;

  const disconnectDuration =
    onu.lastLogoutTime !== "N/A"
      ? `${3 + (seed % 5)}m ${String((seed % 55) + 5).padStart(2, "0")}s`
      : null;
  const disconnectResolved = onu.status !== "Offline";
  const disconnectNote =
    onu.lastLogoutReason === "Power Loss"
      ? "Customer premises power loss. Verify UPS and mains supply."
      : onu.lastLogoutReason === "Signal Lost"
        ? "Fiber path interruption. Inspect splice joints and connectors."
        : onu.lastLogoutReason === "Admin Reboot"
          ? "Scheduled reboot by NOC staff. Normal operation resumed."
          : disconnectResolved
            ? "Signal recovered after reconnect. No action required."
            : "ONU offline. Investigate fiber path and customer premises.";

  const filledBars =
    onu.signalLevel > -20 ? 5
      : onu.signalLevel > -25 ? 4
        : onu.signalLevel > -28 ? 3
          : onu.signalLevel > -32 ? 2 : 1;
  const barColor =
    filledBars >= 4 ? "bg-green-500" : filledBars === 3 ? "bg-amber-500" : "bg-red-500";

  const stabilityConfig = useMemo(() => {
    const map: Record<string, { color: string; bg: string; border: string; badge: string; label: string; desc: string }> = {
      Stable: { color: "text-green-500", bg: "bg-green-500/10", border: "border-l-green-500", badge: "bg-green-500/10 text-green-500 border-green-500/20", label: "Stable", desc: "Signal consistent within ±0.5 dBm" },
      "Weak Signal": { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-l-amber-400", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20", label: "Weak Signal", desc: "RX near warning threshold" },
      Unstable: { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-l-amber-500", badge: "bg-amber-500/10 text-amber-500 border-amber-500/20", label: "Unstable", desc: "Signal varies ±2–4 dBm" },
      "High Loss": { color: "text-red-500", bg: "bg-red-500/10", border: "border-l-red-500", badge: "bg-red-500/10 text-red-500 border-red-500/20", label: "High Loss", desc: "Sustained decline — OTDR recommended" },
      Offline: { color: "text-slate-400", bg: "bg-slate-500/10", border: "border-l-slate-500", badge: "bg-slate-500/10 text-slate-400 border-slate-500/20", label: "Offline", desc: "No optical signal detected" },
    };
    return map[onu.signalStability] ?? map["Stable"];
  }, [onu.signalStability]);

  const onuTypeBadge =
    onu.onuType === "EPON"
      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
      : onu.onuType === "XPON"
        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
        : "bg-primary/10 text-primary border-primary/20";

  const macPrefix = onu.clientMac.slice(0, 8).toUpperCase();
  const routerInfo = MAC_VENDOR_MAP[macPrefix] ?? { vendor: "Unknown", model: "Generic Router" };

  const pppoeUser = `pppoe_${onu.customerName.toLowerCase().replace(/[\s.]+/g, "_")}@isp.net`;
  const oltIdx = parseInt(onu.oltId.replace("olt-", "")) || 1;
  const gatewayIp = `10.${oltIdx}.0.1`;
  const clientIp = `103.${oltIdx}.18.${(seed % 200) + 10}`;

  const dlGb = ((dlMbps * 86400) / 8 / 1024).toFixed(1);
  const ulGb = ((ulMbps * 86400) / 8 / 1024).toFixed(1);
  const totalGb = (parseFloat(dlGb) + parseFloat(ulGb)).toFixed(1);
  const monthGb = (parseFloat(totalGb) * 30).toFixed(0);

  const chartData = useMemo(
    () => generateChartData(seed, dlMbps, ulMbps),
    [seed, dlMbps, ulMbps]
  );

  const timelineEvents = [
    { Icon: onu.status === "Offline" ? WifiOff : Wifi, color: onu.status === "Offline" ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-green-400 bg-green-500/10 border-green-500/20", label: onu.status === "Offline" ? "ONU went offline" : "ONU came online", detail: onu.status === "Offline" ? "Lost keepalive — power interruption suspected" : `Registered on ${onu.oltPort} — link established`, time: "2 mins ago" },
    { Icon: TrendingUp, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", label: "Signal normalized", detail: `RX recovered to ${onu.signalLevel} dBm after brief fluctuation`, time: "18 mins ago" },
    { Icon: Bell, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Alarm triggered", detail: "Minor: TX power slightly low on this ONU", time: "1 hour ago" },
    { Icon: RefreshCw, color: "text-purple-400 bg-purple-500/10 border-purple-500/20", label: "Manual reboot issued", detail: "Remote reboot sent by NOC Admin via NOCpulse", time: "3 hours ago" },
    { Icon: Settings, color: "text-primary bg-primary/10 border-primary/20", label: "Config pushed", detail: `Traffic profile updated — VLAN ${onu.vlanId} bandwidth policy applied`, time: "5 hours ago" },
    { Icon: ShieldCheck, color: "text-green-400 bg-green-500/10 border-green-500/20", label: "Previous alarm cleared", detail: "Signal check passed — optical link stable", time: "2 days ago" },
  ];

  return (
    <div className="space-y-4 pb-10 max-w-full">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Link href="/onus">
            <Button variant="ghost" size="sm" className="-ml-2 shrink-0 text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> ONU List
            </Button>
          </Link>
          <div className="w-px h-8 bg-border hidden sm:block mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-lg tracking-tight">{onu.onuNo}</span>
              <StatusBadge status={onu.status} />
              <Badge variant="outline" className={`text-[10px] ${stabilityConfig.badge}`}>
                {stabilityConfig.label}
              </Badge>
              <Badge variant="outline" className={`text-[10px] font-bold ${onuTypeBadge}`}>
                {onu.onuType}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground flex-wrap">
              <span className="font-medium text-foreground truncate">{displayDescription}</span>
              {parentOlt?.location && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />{parentOlt.location}
                  </span>
                </>
              )}
              <span className="opacity-40">·</span>
              <span>{onu.ponPort}</span>
              <span className="opacity-40">·</span>
              <span className="font-mono text-xs">{onu.oltPort}</span>
              {onu.onlineDuration !== "N/A" && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="flex items-center gap-1 text-green-500 font-medium">
                    <Timer className="h-3 w-3 shrink-0" />Up {onu.onlineDuration}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
            onClick={() => setModal("reboot")}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reboot ONU
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => toast.info("Description editor coming soon")}>
                Edit Description
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onu.status !== "Offline" ? (
                <DropdownMenuItem
                  className="text-red-500"
                  onClick={() => setModal("disable")}
                >
                  <PowerOff className="h-4 w-4 mr-2" /> Disable ONU
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setModal("enable")}>
                  <Power className="h-4 w-4 mr-2" /> Enable ONU
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation(`/olts/${onu.oltId}`)}>
                View Parent OLT
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── 5 Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* RX Power */}
        <Card className={`border-l-4 ${isPoorSignal ? "border-l-red-500" : isWarningSignal ? "border-l-amber-500" : "border-l-green-500"}`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">RX Power</span>
              <Signal className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className={`text-xl font-bold ${isPoorSignal ? "text-red-500" : isWarningSignal ? "text-amber-500" : "text-green-500"}`}>
              {onu.signalLevel} <span className="text-xs font-normal text-muted-foreground">dBm</span>
            </div>
            {powerDelta !== null ? (
              <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${powerImproved ? "text-green-500" : powerWorsened ? "text-red-400" : "text-muted-foreground"}`}>
                {powerImproved ? <TrendingUp className="h-3 w-3" /> : powerWorsened ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {powerImproved ? "+" : ""}{powerDelta} vs snapshot
              </div>
            ) : (
              <div className="mt-1 text-[10px] text-muted-foreground">No prior snapshot</div>
            )}
          </CardContent>
        </Card>

        {/* TX Power */}
        <Card className={`border-l-4 ${onu.txPower < -3 || onu.txPower > 5 ? "border-l-red-500" : "border-l-purple-500"}`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">TX Power</span>
              <Radio className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className={`text-xl font-bold ${onu.txPower < -3 || onu.txPower > 5 ? "text-red-500" : onu.txPower < 0 ? "text-amber-500" : "text-green-500"}`}>
              {onu.txPower} <span className="text-xs font-normal text-muted-foreground">dBm</span>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">Range: −3 to +5 dBm</div>
          </CardContent>
        </Card>

        {/* Distance */}
        <Card className="border-l-4 border-l-cyan-500">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Distance</span>
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold">
              {onu.distance.replace(" km", "")} <span className="text-xs font-normal text-muted-foreground">km</span>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">Fiber length</div>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Uptime</span>
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className={`text-lg font-bold leading-tight ${onu.status === "Offline" ? "text-muted-foreground" : ""}`}>
              {onu.onlineDuration === "N/A" ? "—" : onu.onlineDuration}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">Current session</div>
          </CardContent>
        </Card>

        {/* Temperature */}
        <Card className="border-l-4 border-l-slate-500 col-span-2 sm:col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Temperature</span>
              <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold text-muted-foreground/40">—</div>
            <div className="mt-1 text-[10px] text-muted-foreground">Sensor not available</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Middle 3-column Info Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Device Information */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Device Information
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {([
              { label: "OLT", value: parentOlt?.name ?? onu.oltId },
              { label: "OLT Port", value: onu.oltPort, mono: true },
              { label: "PON Port", value: onu.ponPort },
              { label: "VLAN", value: `${onu.vlanId}`, mono: true },
              { label: "ONU Type", value: onu.onuType },
              { label: "ONU MAC", value: onu.macAddress, mono: true },
              { label: "Client MAC", value: onu.clientMac, mono: true },
              { label: "Client IP", value: clientIp, mono: true },
              { label: "Serial No.", value: onu.macAddress.replace(/:/g, "").slice(0, 12), mono: true },
              { label: "Router Vendor", value: routerInfo.vendor },
              { label: "Router Model", value: routerInfo.model },
            ] as { label: string; value: string; mono?: boolean }[]).map(({ label, value, mono }) => (
              <div key={label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className={`font-medium text-right truncate ${mono ? "font-mono" : ""}`}>{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* PPPoE / Network */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-cyan-400" /> PPPoE / Network
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {([
              { label: "PPPoE Username", value: pppoeUser, mono: true },
              { label: "Gateway IP", value: gatewayIp, mono: true },
              { label: "DNS Primary", value: "8.8.8.8", mono: true },
              { label: "DNS Secondary", value: "1.1.1.1", mono: true },
              { label: "Connection Type", value: "Fiber PON" },
              { label: "Bandwidth Plan", value: onu.bandwidth },
              { label: "Status", value: onu.status },
              { label: "VLAN Tag", value: `${onu.vlanId}`, mono: true },
              { label: "Last Sync", value: onu.lastSync },
            ] as { label: string; value: string; mono?: boolean }[]).map(({ label, value, mono }) => (
              <div key={label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className={`font-medium text-right truncate ${mono ? "font-mono" : ""} ${label === "Status" ? (onu.status === "Online" ? "text-green-500" : onu.status === "Offline" ? "text-red-400" : "text-amber-400") : ""}`}>
                  {value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Traffic Usage */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-green-400" /> Traffic Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
                <Download className="h-4 w-4 text-blue-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-blue-400">{dlGb}</div>
                <div className="text-[10px] text-muted-foreground">GB Download</div>
              </div>
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
                <Upload className="h-4 w-4 text-green-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-green-400">{ulGb}</div>
                <div className="text-[10px] text-muted-foreground">GB Upload</div>
              </div>
            </div>
            <div className="space-y-2">
              {([
                { label: "Current DL Speed", value: `${dlMbps} Mbps` },
                { label: "Current UL Speed", value: `${ulMbps} Mbps` },
                { label: "Daily Average", value: `${totalGb} GB/day` },
                { label: "Monthly Est.", value: `${monthGb} GB` },
              ]).map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium font-mono">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Realtime Internet Usage Chart ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Realtime Internet Usage
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {pingMs !== null && (
                <span className={`font-mono font-medium ${pingMs < 10 ? "text-green-500" : pingMs < 20 ? "text-amber-500" : "text-red-500"}`}>
                  Ping: {pingMs} ms
                </span>
              )}
              <span className="font-mono text-blue-400">DL: {dlMbps} Mbps</span>
              <span className="font-mono text-green-400">UL: {ulMbps} Mbps</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ulGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={4} />
              <YAxis yAxisId="bw" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="ping" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} domain={[0, 80]} />
              <RechartsTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11 }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              <Area yAxisId="bw" type="monotone" dataKey="dl" name="Download (Mbps)" stroke="#3b82f6" fill="url(#dlGrad)" strokeWidth={1.5} dot={false} />
              <Area yAxisId="bw" type="monotone" dataKey="ul" name="Upload (Mbps)" stroke="#22c55e" fill="url(#ulGrad)" strokeWidth={1.5} dot={false} />
              <Line yAxisId="ping" type="monotone" dataKey="ping" name="Ping (ms)" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Optical Readings ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={`border-l-4 ${isPoorSignal ? "border-l-red-500" : isWarningSignal ? "border-l-amber-500" : "border-l-green-500"}`}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Signal className="h-4 w-4" /> Current Optical Reading
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-end gap-4 mb-3">
              <div>
                <div className={`text-3xl font-bold ${isPoorSignal ? "text-red-500" : isWarningSignal ? "text-amber-500" : "text-green-500"}`}>
                  {onu.signalLevel}
                </div>
                <div className="text-xs text-muted-foreground">dBm RX Power</div>
              </div>
              <div className="flex items-end gap-1 h-10 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 rounded-sm transition-none ${i < filledBars ? barColor : "bg-muted"}`}
                    style={{ height: `${(i + 1) * 20}%` }}
                  />
                ))}
              </div>
              <Badge variant="outline" className={`text-xs ${stabilityConfig.badge} mb-1`}>
                {stabilityConfig.label}
              </Badge>
            </div>
            <div className="space-y-1.5 text-xs">
              {([
                { label: "TX Power", value: `${onu.txPower} dBm` },
                { label: "Stability", value: stabilityConfig.label },
                { label: "Note", value: stabilityConfig.desc },
              ]).map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="text-right text-foreground/80">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-500">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-slate-400" /> Last Offline Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {onu.lastOfflineRxPower !== null ? (
              <>
                <div className="flex items-end gap-4 mb-3">
                  <div>
                    <div className="text-3xl font-bold text-slate-300">{onu.lastOfflineRxPower}</div>
                    <div className="text-xs text-muted-foreground">dBm at last offline</div>
                  </div>
                  {powerDelta !== null && (
                    <div className={`text-sm font-semibold mb-1 ${powerImproved ? "text-green-500" : "text-red-400"}`}>
                      {powerImproved ? "+" : ""}{powerDelta} dBm vs now
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 text-xs">
                  {([
                    { label: "Reason", value: onu.lastLogoutReason !== "N/A" ? onu.lastLogoutReason : "Unknown" },
                    { label: "Time", value: onu.lastLogoutTime !== "N/A" ? onu.lastLogoutTime : "—" },
                    { label: "Delta", value: powerDelta !== null ? `${powerImproved ? "+" : ""}${powerDelta} dBm (${powerImproved ? "improved" : "degraded"})` : "—" },
                  ]).map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">{label}</span>
                      <span className="text-right text-foreground/80">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground/50">
                <Signal className="h-8 w-8 opacity-30" />
                <span className="text-xs">No offline snapshot recorded</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Activity Timeline + Last Disconnect Details ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Timeline — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" /> Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-0">
              {timelineEvents.map((entry, idx) => {
                const Icon = entry.Icon;
                return (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`h-7 w-7 rounded-full border flex items-center justify-center ${entry.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      {idx < timelineEvents.length - 1 && (
                        <div className="w-px h-5 bg-border/50 my-0.5" />
                      )}
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{entry.label}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{entry.time}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{entry.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Last Disconnect Details */}
        <Card className={`border-l-4 ${disconnectResolved ? "border-l-green-500" : "border-l-red-500"}`}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-muted-foreground" /> Last Disconnect
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {onu.lastLogoutTime !== "N/A" ? (
              <div className="space-y-3">
                {/* Status badge */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${disconnectResolved ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${disconnectResolved ? "bg-green-500" : "bg-red-500"}`} />
                  {disconnectResolved ? "Resolved" : "Active Fault"}
                </div>

                {/* Key fields */}
                <div className="space-y-2 text-xs">
                  {([
                    { label: "Date / Time", value: onu.lastLogoutTime, mono: true },
                    { label: "Duration", value: disconnectDuration ?? "—", mono: true },
                    { label: "Reason", value: onu.lastLogoutReason !== "N/A" ? onu.lastLogoutReason : "Unknown" },
                    { label: "Before RX", value: onu.lastOfflineRxPower !== null ? `${onu.lastOfflineRxPower} dBm` : "—", mono: true },
                    { label: "Current RX", value: `${onu.signalLevel} dBm`, mono: true },
                    { label: "Power Delta", value: powerDelta !== null ? `${powerImproved ? "+" : ""}${powerDelta} dBm` : "—", mono: true },
                  ] as { label: string; value: string; mono?: boolean }[]).map(({ label, value, mono }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">{label}</span>
                      <span className={`font-medium text-right ${mono ? "font-mono" : ""} ${label === "Power Delta" ? (powerImproved ? "text-green-500" : powerWorsened ? "text-red-400" : "text-muted-foreground") : ""}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Note */}
                <div className={`rounded-lg border p-2.5 text-[11px] leading-relaxed ${disconnectResolved ? "bg-green-500/5 border-green-500/15 text-green-700 dark:text-green-300" : "bg-amber-500/5 border-amber-500/15 text-amber-700 dark:text-amber-300"}`}>
                  {disconnectNote}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-28 gap-2">
                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
                <span className="text-xs text-muted-foreground text-center">No disconnects recorded</span>
                <span className="text-[10px] text-muted-foreground/60">ONU has been online without interruption</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Network Quality Overview ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" /> Network Quality Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {([
              {
                label: "Ping Latency",
                value: pingMs !== null ? `${pingMs} ms` : "—",
                sub: pingMs === null ? "Offline" : pingMs < 10 ? "Excellent" : pingMs < 20 ? "Acceptable" : "High",
                status: pingMs === null ? "neutral" : pingMs < 10 ? "good" : pingMs < 20 ? "warn" : "bad",
                Icon: Timer,
              },
              {
                label: "Packet Loss",
                value: lossRate !== null ? `${lossRate}%` : "—",
                sub: lossRate === null ? "Offline" : lossRate < 1 ? "Negligible" : lossRate < 5 ? "Moderate" : "High",
                status: lossRate === null ? "neutral" : lossRate < 1 ? "good" : lossRate < 5 ? "warn" : "bad",
                Icon: TrendingDown,
              },
              {
                label: "Router Overload",
                value: onu.signalStability === "Unstable" ? "Possible" : "None",
                sub: onu.signalStability === "Unstable" ? "Check CPU" : "Normal",
                status: onu.signalStability === "Unstable" ? "warn" : "good",
                Icon: Activity,
              },
              {
                label: "Fiber Attenuation",
                value: isPoorSignal ? "High" : isWarningSignal ? "Moderate" : "Normal",
                sub: isPoorSignal ? "Inspect fiber" : isWarningSignal ? "Monitor" : "Within range",
                status: isPoorSignal ? "bad" : isWarningSignal ? "warn" : "good",
                Icon: Signal,
              },
              {
                label: "Signal Quality",
                value: filledBars >= 4 ? "Excellent" : filledBars === 3 ? "Good" : filledBars === 2 ? "Fair" : "Poor",
                sub: `${onu.signalLevel} dBm`,
                status: filledBars >= 4 ? "good" : filledBars === 3 ? "warn" : "bad",
                Icon: Radio,
              },
              {
                label: "Stability",
                value: onu.signalStability,
                sub: stabilityConfig.desc,
                status: onu.signalStability === "Stable" ? "good" : onu.signalStability === "Offline" || onu.signalStability === "High Loss" ? "bad" : "warn",
                Icon: Gauge,
              },
            ] as { label: string; value: string; sub: string; status: "good" | "warn" | "bad" | "neutral"; Icon: React.ElementType }[]).map(({ label, value, sub, status, Icon }) => {
              const cls = {
                good: { dot: "bg-green-500", val: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 dark:bg-green-500/10", border: "border-green-500/25" },
                warn: { dot: "bg-amber-500", val: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 dark:bg-amber-500/10", border: "border-amber-500/25" },
                bad:  { dot: "bg-red-500",   val: "text-red-600 dark:text-red-400",     bg: "bg-red-500/10 dark:bg-red-500/10",     border: "border-red-500/25"   },
                neutral: { dot: "bg-slate-400", val: "text-muted-foreground", bg: "bg-muted/30", border: "border-border/40" },
              }[status];
              return (
                <div key={label} className={`rounded-xl border p-3 ${cls.bg} ${cls.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`h-3.5 w-3.5 ${cls.val}`} />
                    <span className={`h-2 w-2 rounded-full ${cls.dot}`} />
                  </div>
                  <div className={`text-sm font-bold leading-tight ${cls.val}`}>{value}</div>
                  <div className="text-[10px] font-medium text-foreground/70 mt-0.5">{label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{sub}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Confirmation Modals ── */}
      <ConfirmModal
        open={modal === "reboot"}
        onClose={() => setModal(null)}
        onConfirm={() => toast.success(`Reboot sent to ${displayDescription}`, { description: "ONU will restart within 30 seconds" })}
        title="Reboot ONU"
        description="This will send a remote reboot command to the ONU. The customer will lose connectivity for approximately 30–60 seconds while the device restarts."
        device={`${onu.onuNo} — ${displayDescription}`}
        confirmLabel="Reboot ONU"
        variant="warning"
        icon="reboot"
      />
      <ConfirmModal
        open={modal === "disable"}
        onClose={() => setModal(null)}
        onConfirm={() => toast.error(`ONU disabled: ${displayDescription}`, { description: "Service suspended. Use Enable to restore." })}
        title="Disable ONU"
        description="This will administratively shut down the ONU on the OLT. The customer will lose all internet access immediately."
        device={`${onu.onuNo} — ${displayDescription}`}
        confirmLabel="Disable ONU"
        variant="danger"
        icon="disable"
      />
      <ConfirmModal
        open={modal === "enable"}
        onClose={() => setModal(null)}
        onConfirm={() => toast.success(`ONU enabled: ${displayDescription}`, { description: "ONU is coming back online" })}
        title="Enable ONU"
        description="This will bring the ONU back online and restore the customer's internet service."
        device={`${onu.onuNo} — ${displayDescription}`}
        confirmLabel="Enable ONU"
        variant="warning"
        icon="enable"
      />
    </div>
  );
}
