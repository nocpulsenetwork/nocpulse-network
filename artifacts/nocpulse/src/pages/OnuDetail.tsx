import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { onus, olts } from "@/data/mockData";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ConfirmModal";

import {
  Signal,
  Pencil,
  Radio,
  Ruler,
  Clock,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Thermometer,
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  Power,
  PowerOff,
  TrendingDown,
  TrendingUp,
  Settings,
  ShieldCheck,
  Network,
  Tag,
  PlugZap,
  Layers,
  Minus,
  Gauge,
  GitBranch,
  Download,
  Upload,
  Timer,
  PackageX,
} from "lucide-react";

const generateBandwidthData = () =>
  Array.from({ length: 24 }).map((_, i) => ({
    time: `${i}:00`,
    download: Math.floor(Math.random() * 800) + 200,
    upload: Math.floor(Math.random() * 300) + 50,
  }));

const bandwidthData = generateBandwidthData();

const mockLogs = [
  {
    time: "2 mins ago",
    level: "INFO",
    event: "Temperature check OK",
    details: "Operational at 42°C",
  },
  {
    time: "10 mins ago",
    level: "INFO",
    event: "Config pushed",
    details: "Updated traffic profile successfully",
  },
  {
    time: "1 hour ago",
    level: "WARN",
    event: "Bandwidth utilization peaked at 94%",
    details: "High traffic on PON port",
  },
  {
    time: "1 hour ago",
    level: "INFO",
    event: "Admin login",
    details: "Web interface accessed by admin",
  },
  {
    time: "5 hours ago",
    level: "WARN",
    event: "Signal fluctuation",
    details: "RX power dropped by 2dBm temporarily",
  },
  {
    time: "2 days ago",
    level: "INFO",
    event: "DHCP lease obtained",
    details: "IP assigned to client device",
  },
  {
    time: "2 days ago",
    level: "INFO",
    event: "Signal check passed",
    details: "Optical link established",
  },
  {
    time: "2 days ago",
    level: "INFO",
    event: "ONU registered",
    details: "Device authenticated with OLT",
  },
];

export default function OnuDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [modal, setModal] = useState<
    "reboot" | "disable" | "enable" | "router" | "description" | null
  >(null);

  const id = params?.id;
  const onu = onus.find((o) => o.id === id);

  const displayDescription = onu?.customerName || onu?.onuNo || "Unknown ONU";

  if (!onu) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold">ONU not found</h2>
        <p className="text-muted-foreground">
          The requested ONU does not exist or has been removed.
        </p>
        <Button onClick={() => setLocation("/onus")} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to ONU List
        </Button>
      </div>
    );
  }

  const parentOlt = olts.find((o) => o.id === onu.oltId);
  const isPoorSignal = onu.signalLevel < -28;
  const isWarningSignal = onu.signalLevel >= -28 && onu.signalLevel < -25;
  const ponNumber = onu.onuNo.split("/")[1] ?? "?";
  const slotNumber = onu.onuNo.split("/")[0] ?? "?";
  const onuIndex = onu.onuNo.split("/")[2] ?? "?";

  const clientIp = "103.152.18.24";
  const gatewayIp = "10.10.10.1";
  const lastLoginIp = "192.168.0.12";

  // Power delta vs offline snapshot
  // Derived mock performance metrics (deterministic per ONU)
  const seed = onu.id.charCodeAt(onu.id.length - 1);
  const maxBwMbps =
    parseInt(onu.bandwidth.split("/")[0].replace(/[^0-9]/g, "")) || 1000;
  const isUp = onu.status !== "Offline";
  const pingMs = !isUp
    ? null
    : onu.signalLevel > -25
      ? 5 + (seed % 4)
      : onu.signalLevel > -28
        ? 12 + (seed % 8)
        : 28 + (seed % 12);
  const jitterMs = !isUp
    ? null
    : onu.signalLevel > -25
      ? 1.2
      : onu.signalLevel > -28
        ? 4.5
        : 9.8;
  const lossRate = !isUp
    ? null
    : onu.signalLevel > -25
      ? 0.04
      : onu.signalLevel > -28
        ? 2.8
        : 8.2;
  const dlMbps = !isUp ? 0 : Math.round(maxBwMbps * 0.62 + (seed % 25));
  const ulMbps = !isUp ? 0 : Math.round(maxBwMbps * 0.23 + (seed % 12));
  const lossColor =
    lossRate === null
      ? "text-muted-foreground"
      : lossRate < 1
        ? "text-green-500"
        : lossRate < 5
          ? "text-amber-500"
          : "text-red-500";
  const pingColor =
    pingMs === null
      ? "text-muted-foreground"
      : pingMs < 10
        ? "text-green-500"
        : pingMs < 20
          ? "text-amber-500"
          : "text-red-500";

  const lossReasons = [
    {
      label: "Fiber attenuation",
      prob: isPoorSignal ? "High" : isWarningSignal ? "Medium" : "Low",
      pct: isPoorSignal ? 72 : isWarningSignal ? 38 : 8,
    },
    {
      label: "QoS / buffer congestion",
      prob: lossRate && lossRate > 5 ? "Medium" : "Low",
      pct: lossRate && lossRate > 5 ? 42 : 12,
    },
    {
      label: "Customer router overload",
      prob: onu.signalStability === "Unstable" ? "Medium" : "Low",
      pct: onu.signalStability === "Unstable" ? 35 : 10,
    },
    { label: "OLT PON port congestion", prob: "Very Low", pct: 5 },
    {
      label: "Physical layer / connector",
      prob: isPoorSignal ? "Medium" : "Very Low",
      pct: isPoorSignal ? 30 : 4,
    },
  ];

  const powerDelta =
    onu.lastOfflineRxPower !== null
      ? parseFloat((onu.signalLevel - onu.lastOfflineRxPower).toFixed(1))
      : null;
  const powerImproved = powerDelta !== null && powerDelta > 0;
  const powerWorsened = powerDelta !== null && powerDelta < 0;

  const bars = 5;
  const filledBars =
    onu.signalLevel > -20
      ? 5
      : onu.signalLevel > -25
        ? 4
        : onu.signalLevel > -28
          ? 3
          : onu.signalLevel > -32
            ? 2
            : 1;
  const barColor =
    filledBars >= 4
      ? "bg-green-500"
      : filledBars === 3
        ? "bg-amber-500"
        : "bg-red-500";
  const qualityLabel =
    filledBars >= 4
      ? "Excellent"
      : filledBars === 3
        ? "Good"
        : filledBars === 2
          ? "Fair"
          : "Poor";

  const getStabilityConfig = () => {
    switch (onu.signalStability) {
      case "Stable":
        return {
          color: "text-green-500",
          bg: "bg-green-500/10",
          border: "border-l-green-500",
          badge: "bg-green-500/10 text-green-600 border-green-500/20",
          label: "Stable",
          desc: "Signal is consistent within ±0.5 dBm over the last 24h",
        };
      case "Weak Signal":
        return {
          color: "text-amber-400",
          bg: "bg-amber-500/10",
          border: "border-l-amber-400",
          badge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
          label: "Weak Signal",
          desc: "RX power near warning threshold — check fiber path and connectors",
        };
      case "Unstable":
        return {
          color: "text-amber-500",
          bg: "bg-amber-500/10",
          border: "border-l-amber-500",
          badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
          label: "Unstable",
          desc: "Signal varies ±2–4 dBm — possible micro-bend or loose connector",
        };
      case "High Loss":
        return {
          color: "text-red-500",
          bg: "bg-red-500/10",
          border: "border-l-red-500",
          badge: "bg-red-500/10 text-red-600 border-red-500/20",
          label: "High Loss",
          desc: "Sustained signal decline — fiber inspection and OTDR recommended",
        };
      case "Offline":
        return {
          color: "text-slate-400",
          bg: "bg-slate-500/10",
          border: "border-l-slate-500",
          badge: "bg-slate-500/10 text-slate-400 border-slate-500/20",
          label: "Offline",
          desc: "ONU is not reachable — no optical signal detected on the PON port",
        };
    }
  };
  const stability = getStabilityConfig();

  const getLogBadge = (level: string) => {
    switch (level) {
      case "ERROR":
        return (
          <Badge
            variant="outline"
            className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px]"
          >
            ERROR
          </Badge>
        );
      case "WARN":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"
          >
            WARN
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]"
          >
            INFO
          </Badge>
        );
    }
  };

  const getLogBorder = (level: string) => {
    switch (level) {
      case "ERROR":
        return "border-l-2 border-l-red-500";
      case "WARN":
        return "border-l-2 border-l-amber-500";
      default:
        return "border-l-2 border-l-blue-500";
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link href="/onus" className="hover:text-foreground transition-colors">
          ONU Management
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{onu.onuNo}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight font-mono break-all">
              {onu.onuNo}
            </h1>
            <StatusBadge
              status={onu.status}
              className="text-sm px-2.5 py-0.5"
            />
            <Badge
              variant="outline"
              className={`text-[10px] ${stability.badge}`}
            >
              {stability.label}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-lg">
            {onu.description}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span className="font-mono break-all bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5">
              VLAN {onu.vlanId}
            </span>
            <span className="font-mono break-all bg-muted/60 border border-border/40 rounded px-1.5 py-0.5">
              {onu.ponPort}
            </span>
            <span className="font-mono break-all bg-muted/60 border border-border/40 rounded px-1.5 py-0.5">
              {onu.oltPort}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span
              className={`font-bold border rounded px-1.5 py-0.5 ${
                onu.onuType === "EPON"
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                  : onu.onuType === "XPON"
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    : "bg-primary/10 text-primary border-primary/20"
              }`}
            >
              {onu.onuType}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span>
              {parentOlt?.brand ?? "—"} {parentOlt?.type ?? ""}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
            {onu.onlineDuration !== "N/A" && (
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3 text-green-500" />
                <span className="text-green-500 font-medium">
                  Up {onu.onlineDuration}
                </span>
              </span>
            )}
            {onu.lastLogoutTime !== "N/A" && (
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Last reboot:{" "}
                <span className="font-mono break-all text-foreground/70">
                  {onu.lastLogoutTime}
                </span>
              </span>
            )}
            {onu.lastLogoutReason !== "N/A" && (
              <span
                className={`flex items-center gap-1 font-medium ${
                  onu.lastLogoutReason === "Power Loss"
                    ? "text-red-400"
                    : onu.lastLogoutReason === "Signal Lost"
                      ? "text-amber-400"
                      : "text-blue-400"
                }`}
              >
                <AlertCircle className="h-3 w-3" />
                {onu.lastLogoutReason}
              </span>
            )}
            {onu.lastOfflineRxPower !== null && (
              <span className="flex items-center gap-1">
                <Signal className="h-3 w-3" />
                Snapshot:{" "}
                <span className="font-mono break-all text-foreground/70">
                  {onu.lastOfflineRxPower ?? "N/A"} dBm
                </span>
                {powerDelta !== null && (
                  <span
                    className={`ml-0.5 ${powerImproved ? "text-green-500" : "text-red-400"}`}
                  >
                    ({powerImproved ? "+" : ""}
                    {powerDelta})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation("/onus")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to ONU List
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
            onClick={() => setModal("reboot")}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reboot
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20"
            onClick={() => setModal("description")}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>

      {/* Row 1: Core Signal Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card className="shadow-sm border-border/50 border-l-4 border-l-blue-500">
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-between items-start pb-1">
              <p className="text-sm font-medium text-muted-foreground">
                RX Power
              </p>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                <Signal className="h-4 w-4" />
              </div>
            </div>
            <div
              className={`text-3xl font-bold tracking-tight mt-1 ${isPoorSignal ? "text-red-500" : isWarningSignal ? "text-amber-500" : "text-green-500"}`}
            >
              {onu.signalLevel}{" "}
              <span className="text-base font-normal text-muted-foreground">
                dBm
              </span>
            </div>
            {powerDelta !== null && (
              <div
                className={`flex items-center gap-1 mt-1.5 text-[11px] font-medium ${powerImproved ? "text-green-500" : powerWorsened ? "text-red-500" : "text-muted-foreground"}`}
              >
                {powerImproved ? (
                  <TrendingUp className="h-3 w-3" />
                ) : powerWorsened ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {powerImproved ? "+" : ""}
                {powerDelta} dBm vs snapshot
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 border-l-4 border-l-purple-500">
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-between items-start pb-1">
              <p className="text-sm font-medium text-muted-foreground">
                TX Power
              </p>
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
                <Radio className="h-4 w-4" />
              </div>
            </div>
            <div
              className={`text-3xl font-bold tracking-tight mt-1 ${onu.txPower < -3 || onu.txPower > 5 ? "text-red-500" : onu.txPower < 0 ? "text-amber-500" : "text-green-500"}`}
            >
              {onu.txPower}{" "}
              <span className="text-base font-normal text-muted-foreground">
                dBm
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5">
              Normal range: −3 to +5 dBm
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 border-l-4 border-l-cyan-500">
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-between items-start pb-1">
              <p className="text-sm font-medium text-muted-foreground">
                Distance
              </p>
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
                <Ruler className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight mt-1">
              {onu.distance.replace(" km", "")}{" "}
              <span className="text-base font-normal text-muted-foreground">
                km
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5">
              Optical fiber length
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 border-l-4 border-l-green-500">
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-between items-start pb-1">
              <p className="text-sm font-medium text-muted-foreground">
                Online Duration
              </p>
              <div className="p-1.5 rounded-lg bg-green-500/10 text-green-500">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div
              className={`text-xl font-bold tracking-tight mt-1 ${onu.status === "Offline" ? "text-muted-foreground" : "text-foreground"}`}
            >
              {onu.onlineDuration === "N/A" ? "—" : onu.onlineDuration}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5">
              Continuous uptime session
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Signal Quality | Signal Stability | Temperature */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card
          className={`shadow-sm border-border/50 border-l-4 ${filledBars >= 4 ? "border-l-green-500" : filledBars === 3 ? "border-l-amber-500" : "border-l-red-500"}`}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-between items-start pb-1">
              <p className="text-sm font-medium text-muted-foreground">
                Signal Quality
              </p>
              <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-end gap-1 h-8">
                {Array.from({ length: bars }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 rounded-sm ${i < filledBars ? barColor : "bg-muted"}`}
                    style={{ height: `${(i + 1) * 20}%` }}
                  />
                ))}
              </div>
              <div className="text-xl font-bold">{qualityLabel}</div>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              {onu.signalLevel} dBm RX reading
            </div>
          </CardContent>
        </Card>

        <Card
          className={`shadow-sm border-border/50 border-l-4 ${stability.border}`}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-between items-start pb-1">
              <p className="text-sm font-medium text-muted-foreground">
                Signal Stability
              </p>
              <div className={`p-1.5 rounded-lg ${stability.bg}`}>
                <Gauge className={`h-4 w-4 ${stability.color}`} />
              </div>
            </div>
            <div className={`text-xl font-bold mt-2 ${stability.color}`}>
              {stability.label}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              {stability.desc}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 border-l-4 border-l-amber-500">
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-between items-start pb-1">
              <p className="text-sm font-medium text-muted-foreground">
                Temperature
              </p>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                <Thermometer className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-bold mt-2 text-muted-foreground/50">
              —{" "}
              <span className="text-base font-normal text-muted-foreground">
                °C
              </span>
            </div>
            <p className="text-[10px] text-amber-500/80 font-medium mt-2 uppercase tracking-widest">
              Requires SNMP backend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Power Intelligence (only if offline snapshot exists) */}
      {
        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PlugZap className="h-4 w-4 text-primary" />
                  Power Intelligence — Offline Snapshot Comparison
                </CardTitle>
                <CardDescription>
                  Comparing current RX power against last recorded offline
                  snapshot
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] ${powerImproved ? "bg-green-500/10 text-green-600 border-green-500/20" : powerWorsened ? "bg-red-500/10 text-red-600 border-red-500/20" : "bg-muted text-muted-foreground"}`}
              >
                {powerImproved
                  ? "▲ Improved"
                  : powerWorsened
                    ? "▼ Worsening"
                    : "— Unchanged"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Client IP
                </p>

                <div className="text-xl font-bold text-cyan-400 font-mono break-all">
                  {clientIp}
                </div>

                <p className="text-[11px] text-muted-foreground mt-1">
                  Internet session IP
                </p>
              </div>
              <div className="col-span-full mt-2">
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  Network Session
                </h3>
              </div>
              <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  PPPoE Username
                </p>

                <div className="text-xl font-bold text-cyan-400 font-mono break-all">
                  client_{onu.id}
                </div>

                <p className="text-[11px] text-muted-foreground mt-1">
                  Broadband authentication account
                </p>
              </div>
              <div className="bg-muted/30 border border-border/50 rounded-lg p-4 mt-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Router MAC
                </p>

                <div className="text-lg font-bold text-cyan-300 font-mono break-all">
                  A4:C3:F0:85:12:33
                </div>

                <p className="text-[11px] text-muted-foreground mt-1">
                  Customer router hardware address
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Vendor
                  </span>

                  <span className="text-[11px] font-medium text-cyan-400">
                    Unknown / Auto Detect
                  </span>
                </div>
              </div>
              <div className="bg-muted/30 border border-border/50 rounded-lg p-4 mt-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Login Server
                </p>

                <div className="text-lg font-bold text-green-400 font-mono break-all">
                  radius-main-01
                </div>

                <p className="text-[11px] text-muted-foreground mt-1">
                  Active authentication node
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Status
                  </span>

                  <span className="text-[11px] font-medium text-green-400">
                    Online
                  </span>
                </div>
              </div>

              <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Gateway IP
                </p>

                <div className="text-xl font-bold text-primary font-mono break-all">
                  {gatewayIp}
                </div>

                <p className="text-[11px] text-muted-foreground mt-1">
                  ISP server gateway
                </p>
              </div>
              <div className="bg-muted/30 border border-border/50 rounded-lg p-4 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Current Session
                  </p>

                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />

                    <span className="text-[10px] text-green-400">LIVE</span>
                  </div>
                </div>

                <div className="mt-3 text-xl font-bold text-green-400">
                  Connected
                </div>

                <p className="text-[11px] text-muted-foreground mt-1">
                  ONU currently authenticated and passing traffic
                </p>

                <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Session Time
                  </span>

                  <span className="text-[11px] font-mono break-all text-cyan-300">
                    12h 44m
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-muted/30 border border-border/50 rounded-lg p-4 mt-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Client Device
              </p>

              <div className="text-lg font-bold text-cyan-300">
                Auto Detected Device
              </div>

              <p className="text-[11px] text-muted-foreground mt-1">
                Connected customer endpoint
              </p>

              <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Device Type
                  </span>

                  <span className="text-[11px] font-medium text-primary">
                    Router / ONU Client
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Connection
                  </span>

                  <span className="text-[11px] font-medium text-green-400">
                    Active
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Last Login IP
              </p>

              <div className="text-xl font-bold text-amber-400 font-mono break-all">
                {lastLoginIp}
              </div>

              <p className="text-[11px] text-muted-foreground mt-1">
                Last authenticated session
              </p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-widest text-green-400 mb-2">
                Session Status
              </p>

              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />

                <span className="text-lg font-bold text-green-400">
                  Active Session
                </span>
                <span className="text-[10px] text-green-300 animate-pulse ml-2">
                  LIVE
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border border-border/40 rounded-lg px-3 py-2 bg-background/40">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Session Status
                  </p>

                  <p className="text-sm font-semibold text-green-400">
                    Connected Securely
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />

                  <span className="text-[11px] text-muted-foreground">
                    Realtime Monitoring
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground mt-2">
                Auto logout after 30 minutes inactivity
              </p>
            </div>
            <div className="bg-muted/30 border border-border/50 rounded-lg p-4 mt-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Traffic Usage
              </p>

              <div className="text-xl font-bold text-primary">128.4 GB</div>

              <p className="text-[11px] text-muted-foreground mt-1">
                Total bandwidth consumed
              </p>

              <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Download
                  </span>

                  <span className="text-[11px] font-medium text-cyan-300">
                    104.7 GB
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Upload
                  </span>

                  <span className="text-[11px] font-medium text-violet-300">
                    23.7 GB
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Live Internet Activity
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Download</p>

                  <div className="text-xl font-bold text-cyan-300 mt-1">
                    92 Mbps
                  </div>
                </div>

                <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Upload</p>

                  <div className="text-xl font-bold text-violet-300 mt-1">
                    24 Mbps
                  </div>
                </div>

                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Ping</p>

                  <div className="text-xl font-bold text-green-300 mt-1">
                    4 ms
                  </div>
                </div>

                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    Packet Loss
                  </p>

                  <div className="text-xl font-bold text-amber-300 mt-1">
                    0.2%
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Session Health
                </span>

                <span className="text-[11px] px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  Excellent
                </span>
              </div>
            </div>
            {/* Offline Snapshot */}
            <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Offline Snapshot
                </p>
              </div>
              <p className="text-xl font-bold font-mono break-all text-red-500">
                {onu.lastOfflineRxPower ?? "N/A"}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  dBm
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Last RX before disconnect
              </p>
            </div>
            <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Connection Intelligence
              </p>

              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Last Disconnect
                  </span>

                  <span className="text-[11px] font-medium text-red-400">
                    Fiber Power Loss
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Last Reboot
                  </span>

                  <span className="text-[11px] font-medium text-cyan-300">
                    3h 24m ago
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Session Stability
                  </span>

                  <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-[10px]">
                    Excellent
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Fiber Health
                  </span>

                  <span className="px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px]">
                    Clean Signal
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Live Traffic Usage
              </p>

              <div className="space-y-3 mt-3">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">Download</span>

                    <span className="text-cyan-300 font-semibold text-sm">
                      1.24 GB
                    </span>
                  </div>

                  <div className="h-1.5 rounded-full" bg-muted overflow-hidden>
                    <div className="h-full w-[84%] bg-cyan-400 rounded-full" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">Upload</span>

                    <span className="text-cyan-300 font-semibold text-sm">
                      680 MB
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-[22%] bg-violet-400 rounded-full" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Monthly Usage
                    </p>

                    <p className="text-lg font-bold text-green-400 mt-1">
                      482 GB
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Bandwidth Profile
                    </p>

                    <p className="text-lg font-bold text-cyan-300 mt-1">
                      100M / 100M
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Security Protection
              </p>

              <div className="space-y-2 mt-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Session Encryption
                  </span>

                  <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-[10px]">
                    AES Protected
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Firewall Status
                  </span>

                  <span className="px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px]">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Unauthorized Login
                  </span>

                  <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-[10px]">
                    Not Detected
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Auto Logout
                  </span>

                  <span className="text-[11px] font-medium text-amber-300">
                    30 Minutes Idle
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Trusted Device
                  </span>

                  <span className="text-[11px] font-medium text-violet-300">
                    Verified
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-muted/30 border border-border/50 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Device & Fiber Information
              </p>

              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    ONU Model
                  </span>

                  <span className="text-[11px] font-medium text-cyan-300">
                    Huawei HG8145X6
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Firmware Version
                  </span>

                  <span className="text-[11px] font-medium text-green-400">
                    V5R021C00
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Fiber Length
                  </span>

                  <span className="text-[11px] font-medium text-amber-300">
                    1.24 KM
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    PON Port
                  </span>

                  <span className="text-[11px] font-medium text-violet-300">
                    GPON 0/1/0
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Vendor OUI
                  </span>

                  <span className="text-[11px] font-medium text-cyan-300">
                    A4:C3:F0
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Authentication
                  </span>

                  <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-[10px]">
                    PPPoE Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Current Reading */}
            <div
              className={`border rounded-lg p-3 ${isPoorSignal ? "bg-red-500/5 border-red-500/20" : isWarningSignal ? "bg-amber-500/5 border-amber-500/20" : "bg-green-500/5 border-green-500/20"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`h-2 w-2 rounded-full ${isPoorSignal ? "bg-red-500" : isWarningSignal ? "bg-amber-500" : "bg-green-500"}`}
                />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Current Reading
                </p>
              </div>
              <p
                className={`text-3xl font-bold tracking-tight font-mono break-all ${isPoorSignal ? "text-red-500" : isWarningSignal ? "text-amber-500" : "text-green-500"}`}
              >
                {onu.signalLevel} dBm
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Live RX power reading
              </p>
            </div>

            {/* Delta */}
            <div
              className={`border rounded-lg p-3 ${powerImproved ? "bg-green-500/5 border-green-500/20" : powerWorsened ? "bg-red-500/5 border-red-500/20" : "bg-muted/30 border-border/50"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {powerImproved ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                ) : powerWorsened ? (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Power Delta
                </p>
              </div>
              <p
                className={`text-xl font-bold font-mono break-all ${powerImproved ? "text-green-500" : powerWorsened ? "text-red-500" : "text-muted-foreground"}`}
              >
                {powerDelta !== null && powerDelta > 0 ? "+" : ""}
                {powerDelta}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  dBm
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {powerImproved
                  ? "Signal recovered since last outage"
                  : powerWorsened
                    ? "Signal has worsened — monitor closely"
                    : "No significant change"}
              </p>
            </div>
          </CardContent>
        </Card>
      }

      {/* Row 4: Network Configuration (VLAN / PON / OLT Port) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 sm:grid-cols-4">
        <Card className="shadow-sm border-border/50 border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-3.5 w-3.5 text-primary" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                VLAN ID
              </p>
            </div>
            <p className="text-xl font-bold font-mono break-all text-primary">
              {onu.vlanId}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Service VLAN tag
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 border-l-4 border-l-indigo-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                PON Details
              </p>
            </div>
            <p className="text-xl font-bold font-mono break-all">
              {onu.ponPort}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Slot {slotNumber} · PON {ponNumber} · ONU {onuIndex}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 border-l-4 border-l-violet-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <PlugZap className="h-3.5 w-3.5 text-violet-500" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                OLT Port
              </p>
            </div>
            <p className="text-sm font-bold font-mono break-all text-violet-500">
              {onu.oltPort}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {parentOlt?.name ?? onu.oltId}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 border-l-4 border-l-teal-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="h-3.5 w-3.5 text-teal-500" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Network Type
              </p>
            </div>
            <p className="text-xl font-bold text-teal-500">
              {parentOlt?.type ?? "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {onu.bandwidth} bandwidth plan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Hardware Details + Charts */}
      <div className="grid gap-6 md:grid-cols-1 sm:grid-cols-3">
        {/* Hardware Details — enhanced */}
        <Card className="md:col-span-1 shadow-sm border-border/50 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              Hardware Details
            </CardTitle>
            <CardDescription>
              Identity, network binding, and port mapping
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3 text-sm">
            {/* Uptime block */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border border-border/50">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-widest mb-1 font-bold">
                  ONU Uptime
                </p>
                <p className="font-semibold text-sm">
                  {onu.onlineDuration === "N/A" ? "—" : onu.onlineDuration}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-widest mb-1 font-bold">
                  Last Disconnect
                </p>
                <p className="font-semibold text-xs">{onu.lastLogoutReason}</p>
              </div>
            </div>

            {/* MACs */}
            <div className="space-y-2">
              <div>
                <p className="text-muted-foreground text-xs mb-1">
                  ONU MAC Address
                </p>
                <p className="font-mono break-all text-xs font-medium bg-muted p-1.5 rounded">
                  {onu.macAddress}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">
                  Router MAC Address
                </p>
                <p className="font-mono break-all text-xs font-medium bg-muted p-1.5 rounded">
                  {onu.clientMac}
                </p>
              </div>
            </div>

            <Separator />

            {/* Network config */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3">
              <div>
                <p className="text-muted-foreground text-xs mb-1">VLAN ID</p>
                <p className="font-mono break-all font-bold text-primary">
                  {onu.vlanId}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">PON Port</p>
                <p className="font-medium">{onu.ponPort}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">OLT Port</p>
                <p className="font-mono break-all text-xs font-medium">
                  {onu.oltPort}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Port Type</p>
                <p className="font-medium">{parentOlt?.type ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Parent OLT</p>
                <Link
                  href="/olts"
                  className="text-primary hover:underline font-medium text-xs"
                >
                  {parentOlt?.name ?? onu.oltId}
                </Link>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Bandwidth</p>
                <p className="font-medium">{onu.bandwidth}</p>
              </div>
            </div>

            <Separator />

            {/* Logout details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3">
              <div>
                <p className="text-muted-foreground text-xs mb-1">
                  Last Logout
                </p>
                <p
                  className={`text-xs font-medium ${onu.lastLogoutTime === "N/A" ? "text-muted-foreground" : ""}`}
                >
                  {onu.lastLogoutTime}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Customer</p>
                <p className="font-medium text-xs">{displayDescription}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts column */}
        <div className="md:col-span-2 space-y-5 flex flex-col">
          {/* Bandwidth Chart */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">
                  Live Bandwidth Usage
                </CardTitle>
                <CardDescription>
                  Real-time data will appear when connected to backend
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 border-amber-500/20"
              >
                DEMO DATA
              </Badge>
            </CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={bandwidthData}
                  margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="colorDownload"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="colorUpload"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--chart-2))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--chart-2))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                    opacity={0.4}
                  />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="download"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorDownload)"
                    name="Download (Mbps)"
                  />
                  <Area
                    type="monotone"
                    dataKey="upload"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorUpload)"
                    name="Upload (Mbps)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Download / Upload / Ping / Packet Loss speed-metric row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                icon: Download,
                label: "Download",
                color: "text-cyan-400",
                border: "border-cyan-500/20",
                bg: "bg-cyan-500/5",
                value: isUp ? `${dlMbps}` : "—",
                unit: isUp ? "Mbps" : "",
                sub: isUp ? `of ${maxBwMbps} Mbps plan` : "Device offline",
                bar: isUp ? Math.min(100, (dlMbps / maxBwMbps) * 100) : 0,
                barColor: "bg-cyan-500",
              },
              {
                icon: Upload,
                label: "Upload",
                color: "text-violet-400",
                border: "border-violet-500/20",
                bg: "bg-violet-500/5",
                value: isUp ? `${ulMbps}` : "—",
                unit: isUp ? "Mbps" : "",
                sub: isUp ? `of ${maxBwMbps} Mbps plan` : "Device offline",
                bar: isUp ? Math.min(100, (ulMbps / maxBwMbps) * 100) : 0,
                barColor: "bg-violet-500",
              },
              {
                icon: Timer,
                label: "Ping Latency",
                color: pingColor,
                border: "border-border/50",
                bg: "bg-card/60",
                value: pingMs !== null ? `${pingMs}` : "—",
                unit: pingMs !== null ? "ms" : "",
                sub:
                  pingMs === null
                    ? "Offline"
                    : pingMs < 10
                      ? "Excellent"
                      : pingMs < 20
                        ? "Acceptable"
                        : "High latency",
                bar: pingMs !== null ? Math.min(100, (pingMs / 50) * 100) : 0,
                barColor:
                  pingMs !== null && pingMs < 10
                    ? "bg-green-500"
                    : pingMs !== null && pingMs < 20
                      ? "bg-amber-500"
                      : "bg-red-500",
              },
              {
                icon: PackageX,
                label: "Packet Loss",
                color: lossColor,
                border: "border-border/50",
                bg: "bg-card/60",
                value: lossRate !== null ? `${lossRate}` : "—",
                unit: lossRate !== null ? "%" : "",
                sub:
                  lossRate === null
                    ? "Offline"
                    : lossRate < 1
                      ? "Normal"
                      : lossRate < 5
                        ? "Elevated"
                        : "Critical",
                bar:
                  lossRate !== null ? Math.min(100, (lossRate / 10) * 100) : 0,
                barColor:
                  lossRate !== null && lossRate < 1
                    ? "bg-green-500"
                    : lossRate !== null && lossRate < 5
                      ? "bg-amber-500"
                      : "bg-red-500",
              },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.label}
                  className={`rounded-xl border ${m.border} ${m.bg} p-4 space-y-2`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {m.label}
                    </span>
                    <Icon className={`h-3.5 w-3.5 ${m.color}`} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-xl font-bold font-mono break-all ${m.color}`}
                    >
                      {m.value}
                    </span>
                    {m.unit && (
                      <span className="text-xs text-muted-foreground">
                        {m.unit}
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${m.barColor} transition-all`}
                      style={{ width: `${m.bar}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{m.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Packet Loss Analysis + Suggested Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PackageX className="h-4 w-4 text-muted-foreground" />
                  Packet Loss Analysis
                </CardTitle>
                <CardDescription className="text-xs">
                  {lossRate !== null
                    ? `Current: ${lossRate}% — Root causes ranked by probability`
                    : "Device offline — no packet data available"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {lossRate === null ? (
                  <p className="text-xs text-muted-foreground">
                    Bring device online to run packet loss diagnostics.
                  </p>
                ) : (
                  lossReasons.map((r) => {
                    const probColor =
                      r.prob === "High"
                        ? "text-red-400"
                        : r.prob === "Medium"
                          ? "text-amber-400"
                          : r.prob === "Low"
                            ? "text-blue-400"
                            : "text-muted-foreground";
                    const barColor =
                      r.prob === "High"
                        ? "bg-red-500"
                        : r.prob === "Medium"
                          ? "bg-amber-500"
                          : r.prob === "Low"
                            ? "bg-blue-500"
                            : "bg-slate-600";
                    return (
                      <div key={r.label} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">
                            {r.label}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${probColor}`}
                          >
                            {r.prob}
                          </span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${r.pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card
              className={`shadow-sm border ${isPoorSignal ? "border-red-500/30 bg-red-500/5" : onu.status === "Offline" ? "border-amber-500/30 bg-amber-500/5" : "border-green-500/30 bg-green-500/5"}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {isPoorSignal ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-500" /> Suggested
                      Actions
                    </>
                  ) : onu.status === "Offline" ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-500" />{" "}
                      Offline — Next Steps
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" /> All
                      Systems Normal
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs space-y-2 text-muted-foreground">
                  {isPoorSignal ? (
                    <div className="space-y-1.5">
                      {[
                        "Inspect fiber splice at premises entry point",
                        "Clean SC/APC optical connectors (ONU + OLT side)",
                        "Check for excessive bend radius in the drop cable",
                        "Verify upstream splitter ratio (1:8 vs 1:4)",
                        "Compare RX delta vs last offline snapshot for trend",
                      ].map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="h-4 w-4 shrink-0 rounded-full bg-red-500/15 border border-red-500/20 flex items-center justify-center text-[9px] font-bold text-red-400">
                            {i + 1}
                          </span>
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  ) : onu.status === "Offline" ? (
                    <div className="space-y-1.5">
                      {[
                        "Verify customer premises power supply and UPS",
                        "Check upstream OLT PON port link status",
                        "Run remote reachability ping from OLT side",
                        "Dispatch field technician if power is confirmed OK",
                      ].map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="h-4 w-4 shrink-0 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-[9px] font-bold text-amber-400">
                            {i + 1}
                          </span>
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-foreground text-xs">
                        No active issues detected. Signal parameters are within
                        operational tolerances.
                      </p>
                      <div className="pt-1 space-y-1.5">
                        {[
                          {
                            label: "Signal quality",
                            val: "Within range",
                            ok: true,
                          },
                          {
                            label: "Packet loss",
                            val: `${lossRate ?? "—"}%`,
                            ok: (lossRate ?? 0) < 1,
                          },
                          {
                            label: "Ping latency",
                            val: `${pingMs ?? "—"} ms`,
                            ok: (pingMs ?? 0) < 20,
                          },
                          {
                            label: "Jitter",
                            val: `±${jitterMs ?? "—"} ms`,
                            ok: (jitterMs ?? 0) < 5,
                          },
                        ].map((s) => (
                          <div
                            key={s.label}
                            className="flex items-center justify-between"
                          >
                            <span className="text-[11px] text-muted-foreground">
                              {s.label}
                            </span>
                            <span
                              className={`text-[11px] font-medium ${s.ok ? "text-green-400" : "text-amber-400"}`}
                            >
                              {s.val}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Event Logs */}
      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Recent Event Logs</CardTitle>
          <CardDescription>
            System and hardware events for this terminal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">
                      Timestamp
                    </th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">
                      Level
                    </th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">
                      Event
                    </th>
                    <th className="px-4 py-2.5 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mockLogs.map((log, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-muted/30 ${i % 2 === 0 ? "bg-muted/10" : "bg-transparent"} ${getLogBorder(log.level)}`}
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                        {log.time}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {getLogBadge(log.level)}
                      </td>
                      <td className="px-4 py-2 font-medium whitespace-nowrap">
                        {log.event}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-base">ONU Activity Timeline</CardTitle>
          <CardDescription>
            Full history — online/offline, signal, reboots, alarms, config
            changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {[
              {
                icon: Wifi,
                iconCls: "text-green-400 bg-green-500/10 border-green-500/20",
                label: "ONU came online",
                detail: `Registered on ${onu.oltPort} → ${onu.ponPort} — link established`,
                time: "2 mins ago",
                meta: "Status: Online",
                metaCls: "text-green-400",
              },
              {
                icon: TrendingUp,
                iconCls: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
                label: "Signal normalized",
                detail: `RX power recovered to ${onu.signalLevel} dBm after brief fluctuation`,
                time: "18 mins ago",
                meta: `${onu.signalLevel} dBm`,
                metaCls: "text-cyan-400",
              },
              {
                icon: TrendingDown,
                iconCls: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                label: "Signal fluctuation detected",
                detail:
                  "RX power dropped by 2 dBm transiently — possible fiber micro-bend",
                time: "24 mins ago",
                meta: "-2 dBm drop",
                metaCls: "text-amber-400",
              },
              {
                icon: WifiOff,
                iconCls: "text-red-400 bg-red-500/10 border-red-500/20",
                label: "ONU went offline",
                detail:
                  "Lost keep-alive — customer power interruption suspected",
                time: "30 mins ago",
                meta: "Duration: 6m 42s",
                metaCls: "text-red-400",
              },
              {
                icon: Bell,
                iconCls: "text-red-400 bg-red-500/10 border-red-500/20",
                label: "Alarm triggered",
                detail:
                  "Minor alarm: TX power slightly low — 0.8 dBm detected on this ONU",
                time: "1 hour ago",
                meta: "Alarm: Minor",
                metaCls: "text-amber-400",
              },
              {
                icon: RefreshCw,
                iconCls:
                  "text-purple-400 bg-purple-500/10 border-purple-500/20",
                label: "Manual reboot issued",
                detail:
                  "Remote reboot command sent by Sarah Chen (Admin) via NOCpulse",
                time: "3 hours ago",
                meta: "Initiated by staff",
                metaCls: "text-purple-400",
              },
              {
                icon: Settings,
                iconCls: "text-primary bg-primary/10 border-primary/20",
                label: "Config pushed",
                detail: `Traffic profile updated — VLAN ${onu.vlanId} upstream bandwidth limit increased to match customer plan`,
                time: "5 hours ago",
                meta: "Policy update",
                metaCls: "text-primary",
              },
              {
                icon: TrendingDown,
                iconCls: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                label: "Elevated signal degradation",
                detail:
                  "Sustained RX fluctuation over 4-hour window — NOC notified via Telegram",
                time: "8 hours ago",
                meta: "Notification sent",
                metaCls: "text-amber-400",
              },
              {
                icon: Power,
                iconCls: "text-green-400 bg-green-500/10 border-green-500/20",
                label: "ONU initial registration",
                detail: `Authenticated with ${parentOlt?.name ?? onu.oltId} — MAC ${onu.macAddress} registered on ${onu.ponPort} (${onu.oltPort})`,
                time: "2 days ago",
                meta: "First registration",
                metaCls: "text-green-400",
              },
              {
                icon: ShieldCheck,
                iconCls: "text-green-400 bg-green-500/10 border-green-500/20",
                label: "Previous alarm cleared",
                detail:
                  "Signal check passed — optical link stable after splice repair",
                time: "2 days ago",
                meta: "Resolved",
                metaCls: "text-green-400",
              },
            ].map((entry, idx, arr) => {
              const Icon = entry.icon;
              return (
                <div key={idx} className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={`h-7 w-7 rounded-full border flex items-center justify-center ${entry.iconCls}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="w-0.5 h-6 bg-border/50 my-0.5" />
                    )}
                  </div>
                  <div className="pb-4 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">
                        {entry.label}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold ${entry.metaCls}`}
                        >
                          {entry.meta}
                        </span>
                        <span className="text-[10px] text-muted-foreground break-all flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {entry.time}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {entry.detail}
                    </p>
                  </div>
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
        onConfirm={() =>
          toast.success(`Reboot command sent to ${onu.onuNo}`, {
            description: "ONU will restart within 30 seconds",
          })
        }
        title="Reboot ONU"
        description="This will send a remote reboot command to the ONU. The customer will lose internet connectivity for approximately 30–60 seconds while the device restarts."
        device={`${onu.onuNo} — ${onu.description}`}
        confirmLabel="Reboot ONU"
        variant="warning"
        icon="reboot"
      />

      <ConfirmModal
        open={modal === "router"}
        onClose={() => setModal(null)}
        onConfirm={() =>
          toast.success(`Router reboot sent via TR-069`, {
            description: "CPE will restart within 60 seconds",
          })
        }
        title="Reboot Customer Router"
        description="This will send a TR-069 reboot command to the customer's CPE/router. The customer's LAN devices will lose connectivity while the router restarts."
        device={`${onu.onuNo} — ${onu.description} (LAN port)`}
        confirmLabel="Reboot Router"
        variant="warning"
        icon="router"
      />

      <ConfirmModal
        open={modal === "disable"}
        onClose={() => setModal(null)}
        onConfirm={() =>
          toast.error(`ONU disabled: ${onu.onuNo}`, {
            description: "Service suspended. Use Enable to restore.",
          })
        }
        title="Disable ONU"
        description="This will administratively shut down the ONU on the OLT. The customer will lose all internet access immediately and remain offline until the ONU is manually re-enabled."
        device={`${onu.onuNo} — ${onu.description}`}
        confirmLabel="Disable ONU"
        variant="danger"
        icon="disable"
      />

      <ConfirmModal
        open={modal === "enable"}
        onClose={() => setModal(null)}
        onConfirm={() =>
          toast.success(`ONU enabled: ${onu.onuNo}`, {
            description: "ONU is coming back online",
          })
        }
        title="Enable ONU"
        description="This will bring the ONU back online and restore the customer's internet service. The ONU will re-register with the OLT and re-obtain its signal lock."
        device={`${onu.onuNo} — ${onu.description}`}
        confirmLabel="Enable ONU"
        variant="warning"
        icon="enable"
      />
    </div>
  );
}
