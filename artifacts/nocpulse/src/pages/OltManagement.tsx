import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { type OltDevice } from "@/data/mockData";
import { useApiData } from "@/contexts/ApiDataContext";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionBanner } from "@/components/PermissionBanner";
import { usePermissions } from "@/lib/permissions";
import { useRole } from "@/contexts/RoleContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Search, LayoutGrid, List, Cpu, MemoryStick, Thermometer,
  Activity, Eye, MoreHorizontal, Wifi, WifiOff,
  Plus, Pencil, Trash2, Power, PowerOff, Signal,
  CheckCircle2, XCircle, Loader2, Server,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ManagedOlt extends OltDevice {
  snmpVersion: "v1" | "v2c" | "v3";
  community: string;
  snmpPort: number;
  sshPort: number;
  telnetPort: number;
  username: string;
  password: string;
  description: string;
  addedDate: string;
  isEnabled: boolean;
  isCustom: boolean;
  safePollingMode: boolean;
  verified: boolean;
  verificationStatus: "verified" | "unverified" | "pending";
  lastTestTime: string | null;
  lastSuccessTime: string | null;
}

interface OltFormData {
  name: string;
  brand: string;
  ip: string;
  type: "GPON" | "EPON";
  snmpVersion: "v1" | "v2c" | "v3";
  community: string;
  snmpPort: string;
  sshPort: string;
  telnetPort: string;
  username: string;
  password: string;
  location: string;
  description: string;
  safePollingMode: boolean;
}

type FormErrors = Partial<Record<keyof OltFormData, string>>;
type TestState = "idle" | "testing" | "pass" | "fail";

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "nocpulse-managed-olts";
const VENDORS = [
  "Huawei", "ZTE", "BDCOM", "VSOL", "CDATA", "HSGQ",
  "Syrotech", "Corelink", "Zibix", "Nokia", "Fiberhome", "Calix", "Generic",
] as const;

const INVENTORY_SYNC_KEY = "nocpulse-inventory";
const OLT_MODEL_MAP: Record<string, string> = {
  "Huawei:GPON": "MA5800-X15",    "Huawei:EPON": "MA5600T",
  "ZTE:GPON": "ZXA10 C300",       "ZTE:EPON": "ZXA10 C600",
  "Nokia:GPON": "ISAM 7360",      "Nokia:EPON": "ISAM 7363",
  "Fiberhome:GPON": "AN5516-06",  "Fiberhome:EPON": "AN5516-04",
  "Calix:GPON": "E7-2",           "Calix:EPON": "E3-48C",
};

const DEFAULT_FORM: OltFormData = {
  name: "",
  brand: "Huawei",
  ip: "",
  type: "GPON",
  snmpVersion: "v2c",
  community: "public",
  snmpPort: "161",
  sshPort: "22",
  telnetPort: "23",
  username: "",
  password: "",
  location: "",
  description: "",
  safePollingMode: false,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidIp(ip: string): boolean {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

function generateId(): string {
  return `olt-custom-${Date.now()}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return "—";
  }
}

function seedFromApi(apiOlts: OltDevice[]): ManagedOlt[] {
  return apiOlts.map((olt) => ({
    ...olt,
    snmpVersion: "v2c" as const,
    community: "public",
    snmpPort: 161,
    sshPort: 22,
    telnetPort: 23,
    username: "",
    password: "",
    description: "",
    addedDate: olt.lastSync,
    isEnabled: true,
    isCustom: false,
    safePollingMode: false,
    verified: false,
    verificationStatus: "unverified" as const,
    lastTestTime: null,
    lastSuccessTime: null,
  }));
}

function syncOltToInventory(olt: ManagedOlt): void {
  try {
    const raw = localStorage.getItem(INVENTORY_SYNC_KEY);
    if (!raw) return; // inventory not seeded yet; DeviceInventory will pick it up on mount
    const inv = JSON.parse(raw) as Array<{ id: string; ip: string }>;
    const invId = `inv-olt-${olt.id}`;
    if (inv.some((d) => d.id === invId || d.ip === olt.ip)) return;
    const entry = {
      id: invId,
      name: olt.name,
      deviceType: "OLT",
      vendor: olt.brand,
      model: OLT_MODEL_MAP[`${olt.brand}:${olt.type}`] ?? `${olt.brand} OLT`,
      ip: olt.ip,
      macOrSerial: `SN:${olt.id.replace(/-/g, "").toUpperCase()}`,
      status: olt.status,
      location: olt.location,
      lastSeen: olt.lastSeen,
      addedDate: olt.addedDate,
      isEnabled: olt.isEnabled,
      description: olt.description,
      isCustom: olt.isCustom,
      sourceId: olt.isCustom ? undefined : olt.id,
    };
    localStorage.setItem(INVENTORY_SYNC_KEY, JSON.stringify([...inv, entry]));
  } catch {
    // Silently ignore storage errors
  }
}

function loadOlts(): ManagedOlt[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Normalize entries from older storage versions that lack new fields.
    const parsed = JSON.parse(raw) as ManagedOlt[];
    return parsed.map((o) => ({
      ...o,
      verificationStatus: o.verificationStatus ?? (o.verified ? "verified" : "unverified"),
      lastSuccessTime: o.lastSuccessTime ?? null,
    }));
  } catch {
    return null;
  }
}

function storeOlts(olts: ManagedOlt[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(olts));
}

function isValidPort(val: string): boolean {
  if (!val.trim()) return false;
  const n = parseInt(val, 10);
  return Number.isInteger(n) && n >= 1 && n <= 65535 && String(n) === val.trim();
}

function validateForm(
  form: OltFormData,
  olts: ManagedOlt[],
  editId?: string
): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "OLT name is required";
  const ipRaw = form.ip.trim();
  if (!ipRaw) {
    errors.ip = "IP address is required";
  } else if (ipRaw.startsWith("http") || ipRaw.includes("://")) {
    errors.ip = "Enter only the IPv4 address — no URL prefix";
  } else if (ipRaw.includes(":")) {
    errors.ip = "Enter only the IPv4 address — no port suffix";
  } else if (!isValidIp(ipRaw)) {
    errors.ip = "Enter a valid IPv4 address (e.g. 192.168.1.1)";
  } else if (olts.some((o) => o.ip === ipRaw && o.id !== editId)) {
    errors.ip = "An OLT with this IP already exists";
  }
  if (!form.community.trim()) errors.community = "Community string is required";
  if (!form.snmpPort.trim()) {
    errors.snmpPort = "SNMP Port is required";
  } else if (!isValidPort(form.snmpPort)) {
    errors.snmpPort = "SNMP Port must be 1–65535";
  }
  if (form.sshPort.trim() && !isValidPort(form.sshPort))
    errors.sshPort = "SSH Port must be 1–65535";
  if (form.telnetPort.trim() && !isValidPort(form.telnetPort))
    errors.telnetPort = "Telnet Port must be 1–65535";
  return errors;
}

function createFromForm(form: OltFormData, verified: boolean): ManagedOlt {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: form.name.trim(),
    ip: form.ip.trim(),
    brand: form.brand,
    type: form.type,
    mode: form.type,
    location: form.location.trim(),
    // A successful Test Connection means the device is reachable — mark Online.
    status: verified ? "Online" : "Offline",
    uptime: verified ? "0d 0h" : "0d 0h",
    lastSeen: verified ? now : "Never",
    portCount: 0,
    activeOnus: 0,
    cpu: 0,
    memory: 0,
    temperature: 0,
    lastSync: now,
    uplinkStatus: verified ? "Active" : "Down",
    uplinkPort: "",
    ponPortCount: 0,
    snmpVersion: form.snmpVersion,
    community: form.community.trim() || "public",
    snmpPort: parseInt(form.snmpPort, 10) || 161,
    sshPort: form.sshPort.trim() ? (parseInt(form.sshPort, 10) || 22) : 22,
    telnetPort: form.telnetPort.trim() ? (parseInt(form.telnetPort, 10) || 23) : 23,
    username: form.username.trim(),
    password: form.password,
    description: form.description.trim(),
    addedDate: now,
    isEnabled: true,
    isCustom: true,
    safePollingMode: form.safePollingMode,
    verified,
    verificationStatus: verified ? "verified" : "unverified",
    lastTestTime: verified ? now : null,
    lastSuccessTime: verified ? now : null,
  };
}

function applyFormToOlt(existing: ManagedOlt, form: OltFormData, verified: boolean): ManagedOlt {
  const now = new Date().toISOString();
  return {
    ...existing,
    name: form.name.trim(),
    brand: form.brand,
    ip: form.ip.trim(),
    type: form.type,
    mode: form.type,
    location: form.location.trim(),
    snmpVersion: form.snmpVersion,
    community: form.community.trim() || "public",
    snmpPort: parseInt(form.snmpPort, 10) || 161,
    sshPort: form.sshPort.trim() ? (parseInt(form.sshPort, 10) || existing.sshPort) : existing.sshPort,
    telnetPort: form.telnetPort.trim() ? (parseInt(form.telnetPort, 10) || existing.telnetPort) : existing.telnetPort,
    username: form.username.trim(),
    password: form.password,
    description: form.description.trim(),
    safePollingMode: form.safePollingMode,
    // A verified edit re-confirms the device is reachable; Force Save marks Offline.
    status: verified ? "Online" : "Offline",
    uplinkStatus: verified ? "Active" : "Down",
    lastSeen: verified ? now : existing.lastSeen,
    verified,
    verificationStatus: verified ? "verified" : "unverified",
    lastTestTime: verified ? now : existing.lastTestTime,
    lastSuccessTime: verified ? now : (existing.lastSuccessTime ?? null),
  };
}

function oltToForm(olt: ManagedOlt): OltFormData {
  return {
    name: olt.name,
    brand: olt.brand,
    ip: olt.ip,
    type: olt.type,
    snmpVersion: olt.snmpVersion,
    community: olt.community,
    snmpPort: String(olt.snmpPort ?? 161),
    sshPort: String(olt.sshPort ?? 22),
    telnetPort: String(olt.telnetPort ?? 23),
    username: olt.username ?? "",
    password: olt.password ?? "",
    location: olt.location,
    description: olt.description,
    safePollingMode: olt.safePollingMode ?? false,
  };
}

// ── Small sub-components ───────────────────────────────────────────────────

function BrandBadge({ brand }: { brand: string }) {
  const colors: Record<string, string> = {
    Huawei:    "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25",
    ZTE:       "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25",
    BDCOM:     "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/25",
    VSOL:      "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25",
    CDATA:     "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/25",
    HSGQ:      "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/25",
    Syrotech:  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    Corelink:  "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25",
    Zibix:     "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/25",
    Nokia:     "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25",
    Fiberhome: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/25",
    Calix:     "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/25",
    Generic:   "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shadow-sm ${
        colors[brand] ?? "bg-muted text-muted-foreground border-border"
      }`}
    >
      {brand}
    </span>
  );
}

function TypeBadge({ type }: { type: "GPON" | "EPON" }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shadow-sm ${
        type === "GPON"
          ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/25"
          : "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/25"
      }`}
    >
      {type}
    </span>
  );
}

function UsageBar({ value, icon: Icon }: { value: number; icon: React.ElementType }) {
  const color = value > 80 ? "bg-red-500" : value > 60 ? "bg-amber-500" : "bg-green-500";
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
        className={`text-[11px] font-mono shrink-0 w-8 text-right ${
          value > 80 ? "text-red-400" : value > 60 ? "text-amber-400" : "text-muted-foreground"
        }`}
      >
        {value}%
      </span>
    </div>
  );
}

export function UplinkBadge({ status }: { status: "Active" | "Standby" | "Down" }) {
  if (status === "Active")
    return <span className="flex items-center gap-1 text-[11px] text-green-400"><Wifi className="h-3 w-3" />Active</span>;
  if (status === "Standby")
    return <span className="flex items-center gap-1 text-[11px] text-amber-400"><Activity className="h-3 w-3" />Standby</span>;
  return <span className="flex items-center gap-1 text-[11px] text-red-400"><WifiOff className="h-3 w-3" />Down</span>;
}

function EffectiveStatusBadge({ olt }: { olt: ManagedOlt }) {
  if (!olt.isEnabled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-500/10 text-slate-400 border-slate-500/25">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Disabled
      </span>
    );
  }
  return <StatusBadge status={olt.status} />;
}

function TestStateBadge({ state }: { state: TestState }) {
  if (state === "idle") return null;
  if (state === "testing")
    return <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium"><Loader2 className="h-2.5 w-2.5 animate-spin" />Testing…</span>;
  if (state === "pass")
    return <span className="inline-flex items-center gap-1 text-[10px] text-green-400 font-medium"><CheckCircle2 className="h-2.5 w-2.5" />OK</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-medium"><XCircle className="h-2.5 w-2.5" />Failed</span>;
}

// ── OLT Actions dropdown ───────────────────────────────────────────────────

interface OltActionsProps {
  olt: ManagedOlt;
  canManage: boolean;
  canTest: boolean;
  testState: TestState;
  onNavigate: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  onTest: () => void;
}

function OltActionsDropdown({
  olt, canManage, canTest, testState,
  onNavigate, onEdit, onDelete, onToggleEnabled, onTest,
}: OltActionsProps) {
  const hasAnyAction = !olt.isCustom || canTest || canManage;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg border border-border/50 hover:bg-primary/10 hover:border-primary/40 transition-all"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl border border-border/50">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {olt.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* View Details — always available for API-seeded OLTs */}
        {!olt.isCustom && (
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => onNavigate(olt.id)}
          >
            <Eye className="h-4 w-4" /> View Details
          </DropdownMenuItem>
        )}

        {/* Test Connection — NOC Engineer+ */}
        {(canTest || canManage) && (
          <DropdownMenuItem
            className={`gap-2 ${testState === "testing" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            disabled={testState === "testing"}
            onClick={testState !== "testing" ? onTest : undefined}
          >
            {testState === "testing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : testState === "pass" ? (
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            ) : testState === "fail" ? (
              <XCircle className="h-4 w-4 text-red-400" />
            ) : (
              <Signal className="h-4 w-4" />
            )}
            {testState === "testing"
              ? "Testing…"
              : testState === "pass"
              ? "Connected ✓"
              : testState === "fail"
              ? "Failed ✗"
              : "Test Connection"}
          </DropdownMenuItem>
        )}

        {/* Management actions — Admin+ only */}
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Edit OLT
            </DropdownMenuItem>
            <DropdownMenuItem
              className={`gap-2 cursor-pointer ${
                !olt.isEnabled
                  ? "text-green-500 focus:text-green-500 focus:bg-green-500/10"
                  : ""
              }`}
              onClick={onToggleEnabled}
            >
              {olt.isEnabled ? (
                <PowerOff className="h-4 w-4" />
              ) : (
                <Power className="h-4 w-4" />
              )}
              {olt.isEnabled ? "Disable OLT" : "Enable OLT"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" /> Delete OLT
            </DropdownMenuItem>
          </>
        )}

        {/* Viewer — nothing useful, show read-only hint */}
        {!hasAnyAction && (
          <DropdownMenuItem disabled className="gap-2 opacity-40 cursor-not-allowed text-xs">
            <Eye className="h-3.5 w-3.5" /> View Only
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── OLT Form Modal ─────────────────────────────────────────────────────────

interface OltFormModalProps {
  open: boolean;
  mode: "add" | "edit";
  initial?: OltFormData;
  editId?: string;
  allOlts: ManagedOlt[];
  onClose: () => void;
  onSave: (data: OltFormData, verified: boolean) => void;
}

function OltFormModal({
  open, mode, initial, editId, allOlts, onClose, onSave,
}: OltFormModalProps) {
  const { role } = useRole();
  const isSuperAdmin = role === "super_admin";

  const [form, setForm] = useState<OltFormData>(initial ?? DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [testState, setTestState] = useState<TestState>("idle");
  const [testResult, setTestResult] = useState<{
    vendor: string; model: string; systemName: string; latencyMs: number;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ?? DEFAULT_FORM);
      setErrors({});
      setTestState("idle");
      setTestResult(null);
      setTestError(null);
    }
  }, [open, initial]);

  const setField = (field: keyof OltFormData, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field as keyof FormErrors]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (typeof value === "string" && ["ip", "community", "snmpPort", "snmpVersion"].includes(field as string)) {
      setTestState("idle");
      setTestResult(null);
      setTestError(null);
    }
  };

  const handleTest = async () => {
    const ipRaw = form.ip.trim();
    if (!ipRaw || !isValidIp(ipRaw)) {
      setErrors((e) => ({ ...e, ip: "Enter a valid IPv4 address before testing." }));
      return;
    }
    if (!form.community.trim()) {
      setErrors((e) => ({ ...e, community: "Community string is required." }));
      return;
    }
    const portNum = parseInt(form.snmpPort, 10);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      setErrors((e) => ({ ...e, snmpPort: "SNMP Port must be 1–65535." }));
      return;
    }
    setTestState("testing");
    setTestResult(null);
    setTestError(null);
    try {
      const resp = await fetch("/api/olts/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: ipRaw,
          community: form.community.trim(),
          port: portNum,
          snmpVersion: form.snmpVersion,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      const json = await resp.json() as {
        data?: { success: boolean; vendor?: string; model?: string; sysName?: string; latencyMs?: number; message?: string };
      };
      const data = json.data;
      if (data?.success) {
        setTestState("pass");
        setTestResult({
          vendor: data.vendor ?? "Unknown",
          model: data.model ?? "Unknown",
          systemName: data.sysName ?? "",
          latencyMs: data.latencyMs ?? 0,
        });
        console.debug("[NOCpulse] Validation Success", {
          ip: ipRaw,
          latencyMs: data.latencyMs,
          vendor: data.vendor,
          model: data.model,
          sysName: data.sysName,
        });
      } else {
        setTestState("fail");
        setTestError(data?.message ?? "Connection failed. Check IP, community and port.");
        console.debug("[NOCpulse] Validation Failed", {
          ip: ipRaw,
          reason: data?.message ?? "Connection failed",
        });
      }
    } catch {
      setTestState("fail");
      setTestError("Request timed out. Check IP and network connectivity.");
      console.debug("[NOCpulse] Validation Failed", { ip: ipRaw, reason: "timeout" });
    }
  };

  const handleSubmit = (forceSave = false) => {
    const errs = validateForm(form, allOlts, editId);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    // Force Save always stores verified=false regardless of test state.
    // Regular Save requires testState === "pass" for both Admin and Super Admin.
    const verified = !forceSave && testState === "pass";
    if (!verified && !isSuperAdmin && !forceSave) return;
    onSave(form, verified);
  };

  const labelCls = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";
  const inputCls = "h-9 bg-background/50 text-sm";
  // Both Admin and Super Admin must pass Test Connection for regular Save.
  const canSaveNow = testState === "pass";
  // Force Save is always visible for Super Admin (lets them bypass test).
  const showForceSave = isSuperAdmin;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-primary" />
            {mode === "add" ? "Add OLT" : "Edit OLT"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
          {/* Name + Vendor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>OLT Name *</label>
              <Input
                className={inputCls}
                placeholder="OLT-North-01"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
              {errors.name && <p className="text-[11px] text-red-400 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className={labelCls}>Vendor *</label>
              <Select value={form.brand} onValueChange={(v) => setField("brand", v)}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDORS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* IP + PON Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>IP Address *</label>
              <Input
                className={`${inputCls} font-mono`}
                placeholder="192.168.1.1"
                value={form.ip}
                onChange={(e) => setField("ip", e.target.value)}
              />
              {errors.ip && <p className="text-[11px] text-red-400 mt-1">{errors.ip}</p>}
            </div>
            <div>
              <label className={labelCls}>PON Type *</label>
              <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GPON">GPON</SelectItem>
                  <SelectItem value="EPON">EPON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SNMP Version + Community */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>SNMP Version *</label>
              <Select value={form.snmpVersion} onValueChange={(v) => setField("snmpVersion", v)}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="v1">SNMPv1</SelectItem>
                  <SelectItem value="v2c">SNMPv2c</SelectItem>
                  <SelectItem value="v3">SNMPv3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Community *</label>
              <Input
                className={`${inputCls} font-mono`}
                placeholder="public"
                value={form.community}
                onChange={(e) => setField("community", e.target.value)}
              />
              {errors.community && <p className="text-[11px] text-red-400 mt-1">{errors.community}</p>}
            </div>
          </div>

          {/* Ports — 3 columns */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>SNMP Port *</label>
              <Input
                className={`${inputCls} font-mono`}
                placeholder="161"
                value={form.snmpPort}
                onChange={(e) => setField("snmpPort", e.target.value)}
              />
              {errors.snmpPort && <p className="text-[11px] text-red-400 mt-1">{errors.snmpPort}</p>}
            </div>
            <div>
              <label className={labelCls}>SSH Port</label>
              <Input
                className={`${inputCls} font-mono`}
                placeholder="22"
                value={form.sshPort}
                onChange={(e) => setField("sshPort", e.target.value)}
              />
              {errors.sshPort && <p className="text-[11px] text-red-400 mt-1">{errors.sshPort}</p>}
            </div>
            <div>
              <label className={labelCls}>Telnet Port</label>
              <Input
                className={`${inputCls} font-mono`}
                placeholder="23"
                value={form.telnetPort}
                onChange={(e) => setField("telnetPort", e.target.value)}
              />
              {errors.telnetPort && <p className="text-[11px] text-red-400 mt-1">{errors.telnetPort}</p>}
            </div>
          </div>

          {/* Username + Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Username</label>
              <Input
                className={inputCls}
                placeholder="admin"
                value={form.username}
                onChange={(e) => setField("username", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <Input
                className={inputCls}
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
              />
            </div>
          </div>

          {/* Test Connection panel */}
          <div className="rounded-lg border border-border/50 bg-background/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none">Test Connection</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {isSuperAdmin
                    ? "Recommended. Super Admin may force-save without testing."
                    : "Required before saving. Read-only SNMP check."}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 h-8 gap-1.5"
                disabled={testState === "testing"}
                onClick={handleTest}
              >
                {testState === "testing" ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Testing…</>
                ) : (
                  <><Signal className="h-3.5 w-3.5" />Test</>
                )}
              </Button>
            </div>

            {testState === "pass" && testResult && (
              <div className="flex items-start gap-2 p-2 rounded bg-green-500/10 border border-green-500/20 text-green-400">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="text-[11px] leading-snug min-w-0">
                  <span className="font-semibold">Connected · {testResult.latencyMs} ms</span>
                  {testResult.systemName && (
                    <span className="text-green-300/70"> · {testResult.systemName}</span>
                  )}
                  {(testResult.vendor !== "Unknown" || testResult.model !== "Unknown") && (
                    <div className="text-green-300/60 mt-0.5">
                      {testResult.vendor} {testResult.model}
                    </div>
                  )}
                </div>
              </div>
            )}

            {testState === "fail" && (
              <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-[11px] leading-snug">
                  {testError ?? "Connection failed. Check IP, community and port."}
                </p>
              </div>
            )}
          </div>

          {/* Safe Polling Mode */}
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium leading-none">Safe Polling Mode</p>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                Reduce polling frequency for legacy or resource-constrained devices
              </p>
            </div>
            <Switch
              checked={form.safePollingMode}
              onCheckedChange={(v) => setForm((f) => ({ ...f, safePollingMode: v }))}
            />
          </div>

          {/* Location */}
          <div>
            <label className={labelCls}>Location</label>
            <Input
              className={inputCls}
              placeholder="Data Center Alpha — Rack A2"
              value={form.location}
              onChange={(e) => setField("location", e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <Textarea
              className="bg-background/50 text-sm resize-none min-h-[64px]"
              placeholder="Optional notes about this OLT…"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 flex-wrap">
          <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none h-9">
            Cancel
          </Button>
          {showForceSave && (
            <Button
              variant="outline"
              onClick={() => handleSubmit(true)}
              className="flex-1 sm:flex-none h-9 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              title="Save without SNMP verification — OLT will be marked Unverified"
            >
              Force Save (Unverified)
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              {/* span keeps hover events when button is disabled */}
              <span className="flex-1 sm:flex-none inline-flex">
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={!canSaveNow}
                  className="h-9 w-full"
                >
                  {mode === "add" ? "Save OLT" : "Save Changes"}
                </Button>
              </span>
            </TooltipTrigger>
            {!canSaveNow && (
              <TooltipContent side="top">
                Run a successful Test Connection before saving.
              </TooltipContent>
            )}
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function OltManagement() {
  const { olts: apiOlts, onus } = useApiData();
  const [, navigate] = useLocation();
  const { can } = usePermissions();

  const [managedOlts, setManagedOlts] = useState<ManagedOlt[] | null>(null);
  const [view, setView] = useState<"card" | "table">("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [brandFilter, setBrandFilter] = useState("All Brands");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [modal, setModal] = useState<{ mode: "add" | "edit"; oltId?: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "disable" | "enable";
    olt: ManagedOlt;
  } | null>(null);
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});

  // Seed from API data on first mount
  useEffect(() => {
    const stored = loadOlts();
    if (stored && stored.length > 0) {
      setManagedOlts(stored);
    } else if (apiOlts.length > 0) {
      const seeded = seedFromApi(apiOlts);
      setManagedOlts(seeded);
      storeOlts(seeded);
    }
  }, [apiOlts]);

  // Persist to localStorage on every change
  useEffect(() => {
    if (managedOlts !== null) storeOlts(managedOlts);
  }, [managedOlts]);

  const olts = managedOlts ?? [];

  // ONU stats per OLT (from live API data)
  const oltStats = useMemo(() => {
    const stats: Record<string, {
      online: number; offline: number; total: number; usedPons: Set<string>;
    }> = {};
    onus.forEach((o) => {
      if (!stats[o.oltId])
        stats[o.oltId] = { online: 0, offline: 0, total: 0, usedPons: new Set() };
      stats[o.oltId].total++;
      stats[o.oltId].usedPons.add(o.ponPort);
      if (o.status === "Online") stats[o.oltId].online++;
      else stats[o.oltId].offline++;
    });
    return stats;
  }, [onus]);

  const brands = useMemo(
    () => Array.from(new Set(olts.map((o) => o.brand))),
    [olts]
  );

  const filteredOlts = useMemo(() => {
    return olts.filter((olt) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        olt.name.toLowerCase().includes(term) ||
        olt.ip.includes(term) ||
        olt.location.toLowerCase().includes(term) ||
        olt.brand.toLowerCase().includes(term);
      const effectiveStatus = !olt.isEnabled ? "Disabled" : olt.status;
      const matchesStatus =
        statusFilter === "All Status" || statusFilter === effectiveStatus;
      const matchesBrand = brandFilter === "All Brands" || olt.brand === brandFilter;
      const matchesType = typeFilter === "All Types" || olt.type === typeFilter;
      return matchesSearch && matchesStatus && matchesBrand && matchesType;
    });
  }, [olts, searchTerm, statusFilter, brandFilter, typeFilter]);

  // ── Action handlers ──────────────────────────────────────────────────────

  const handleSave = (form: OltFormData, verified: boolean) => {
    if (modal?.mode === "add") {
      const newOlt = createFromForm(form, verified);
      console.debug("[NOCpulse] Status Changed Online", {
        id: newOlt.id,
        ip: newOlt.ip,
        verified,
        status: newOlt.status,
        verificationStatus: newOlt.verificationStatus,
      });
      setManagedOlts((prev) => (prev ? [...prev, newOlt] : [newOlt]));
      syncOltToInventory(newOlt);
      toast.success(`${newOlt.name} added`, {
        description: verified
          ? `${newOlt.brand} ${newOlt.type} · ${newOlt.ip} · Online · Verified`
          : `${newOlt.brand} ${newOlt.type} · ${newOlt.ip} · Offline · Unverified`,
      });
    } else if (modal?.mode === "edit" && modal.oltId) {
      const editId = modal.oltId;
      setManagedOlts((prev) => {
        if (!prev) return prev;
        return prev.map((o) => {
          if (o.id !== editId) return o;
          const updated = applyFormToOlt(o, form, verified);
          console.debug("[NOCpulse] Status Changed" + (verified ? " Online" : " Offline"), {
            id: updated.id,
            ip: updated.ip,
            verified,
            status: updated.status,
            verificationStatus: updated.verificationStatus,
          });
          return updated;
        });
      });
      toast.success("OLT updated successfully", {
        description: verified ? "Status: Online · Verified" : "Status: Offline · Unverified",
      });
    }
    setModal(null);
  };

  const handleDelete = useCallback((olt: ManagedOlt) => {
    setManagedOlts((prev) => (prev ? prev.filter((o) => o.id !== olt.id) : prev));
    toast.success(`${olt.name} deleted`);
  }, []);

  const handleToggleEnabled = useCallback((olt: ManagedOlt) => {
    const next = !olt.isEnabled;
    setManagedOlts((prev) =>
      prev ? prev.map((o) => (o.id === olt.id ? { ...o, isEnabled: next } : o)) : prev
    );
    toast.success(`${olt.name} ${next ? "enabled" : "disabled"}`);
  }, []);

  const handleTestConnection = useCallback(async (olt: ManagedOlt) => {
    setTestStates((prev) => ({ ...prev, [olt.id]: "testing" }));
    toast.info(`Testing SNMP connection to ${olt.name}…`);
    try {
      const resp = await fetch("/api/olts/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: olt.ip,
          community: olt.community,
          port: olt.snmpPort ?? 161,
          snmpVersion: olt.snmpVersion,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const json = await resp.json() as {
        data?: { success: boolean; vendor?: string; model?: string; latencyMs?: number; message?: string };
      };
      const data = json.data;
      if (data?.success) {
        setTestStates((prev) => ({ ...prev, [olt.id]: "pass" }));
        toast.success(`${olt.name} — Reachable`, {
          description: [data.vendor, data.model, data.latencyMs != null ? `${data.latencyMs} ms` : undefined]
            .filter(Boolean).join(" · ") || `${olt.ip} responded`,
        });
      } else {
        setTestStates((prev) => ({ ...prev, [olt.id]: "fail" }));
        toast.error(`${olt.name} — Unreachable`, {
          description: data?.message ?? "OLT did not respond.",
        });
      }
    } catch {
      setTestStates((prev) => ({ ...prev, [olt.id]: "fail" }));
      toast.error(`${olt.name} — Unreachable`, {
        description: "Request timed out or network error.",
      });
    }
    setTimeout(
      () => setTestStates((prev) => ({ ...prev, [olt.id]: "idle" })),
      8000
    );
  }, []);

  const editingOlt =
    modal?.mode === "edit" && modal.oltId
      ? olts.find((o) => o.id === modal.oltId)
      : undefined;

  const canManage = can("olt.manage");
  const canTest = can("olt.test");

  return (
    <div className="space-y-6">
      {/* Page header */}
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
        {canManage && (
          <Button className="gap-2" onClick={() => setModal({ mode: "add" })}>
            <Plus className="h-4 w-4" /> Add OLT
          </Button>
        )}
      </div>

      <PermissionBanner context="OLT Management — device configuration and monitoring" />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-card/60 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-border/60">
        <div className="relative flex-1 min-w-[140px] sm:flex-none sm:w-full sm:max-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search OLTs…"
            className="pl-8 bg-background/50 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[130px] bg-background/50 min-w-[100px] flex-1 sm:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["All Status", "Online", "Offline", "Degraded", "Disabled"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-full sm:w-[130px] bg-background/50 min-w-[100px] flex-1 sm:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Brands">All Brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[120px] bg-background/50 min-w-[100px] flex-1 sm:flex-none">
            <SelectValue />
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

      {/* ── Card view ── */}
      {view === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOlts.length === 0 ? (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Server className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No OLTs match your filters.</p>
            </div>
          ) : (
            filteredOlts.map((olt) => {
              const s = oltStats[olt.id] ?? {
                online: 0, offline: 0, total: 0, usedPons: new Set<string>(),
              };
              const usedPon = s.usedPons.size;
              const emptyPon = Math.max(0, olt.ponPortCount - usedPon);
              const testState = testStates[olt.id] ?? "idle";

              return (
                <div
                  key={olt.id}
                  onClick={() => navigate(`/olts/${olt.id}`)}
                  className={`rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-md cursor-pointer hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 group p-4 space-y-3 ${
                    !olt.isEnabled ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1 pr-2">
                      <h3 className="font-bold text-sm truncate">{olt.name}</h3>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <EffectiveStatusBadge olt={olt} />
                        <TestStateBadge state={testState} />
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <OltActionsDropdown
                        olt={olt}
                        canManage={canManage}
                        canTest={canTest}
                        testState={testState}
                        onNavigate={(id) => navigate(`/olts/${id}`)}
                        onEdit={() => setModal({ mode: "edit", oltId: olt.id })}
                        onDelete={() => setConfirmAction({ type: "delete", olt })}
                        onToggleEnabled={() =>
                          setConfirmAction({ type: olt.isEnabled ? "disable" : "enable", olt })
                        }
                        onTest={() => handleTestConnection(olt)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <BrandBadge brand={olt.brand} />
                    <TypeBadge type={olt.type} />
                    {olt.isCustom && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 text-primary font-bold uppercase tracking-wider">
                        Custom
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[100px]">
                      {olt.location || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{olt.ip}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-mono">
                        SNMP {olt.snmpVersion.toUpperCase()}
                      </span>
                      {olt.safePollingMode && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">
                          SPM
                        </span>
                      )}
                    </div>
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
                            className={`text-[11px] font-mono font-bold ${
                              olt.temperature > 55
                                ? "text-red-400"
                                : olt.temperature > 45
                                ? "text-amber-400"
                                : "text-green-400"
                            }`}
                          >
                            {olt.temperature}°C
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="h-px w-full bg-border/60" />

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">Online</span>
                      <span className="font-semibold text-green-400 font-mono">{s.online}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">Offline</span>
                      <span className={`font-semibold font-mono ${s.offline > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                        {s.offline}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">Used PON</span>
                      <span className="font-semibold font-mono">
                        {usedPon}/{olt.ponPortCount || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">Free PON</span>
                      <span
                        className={`font-semibold font-mono ${
                          emptyPon === 0 && olt.ponPortCount > 0 ? "text-red-400" : "text-muted-foreground"
                        }`}
                      >
                        {olt.ponPortCount > 0 ? emptyPon : "—"}
                      </span>
                    </div>
                  </div>

                  {olt.uplinkPort && (
                    <>
                      <div className="h-px w-full bg-border/60" />
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <UplinkBadge status={olt.uplinkStatus} />
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {olt.uplinkPort}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground text-right">
                          Added {fmtDate(olt.addedDate)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ── Table view ── */
        <div className="rounded-xl border border-border/60 overflow-hidden backdrop-blur-sm bg-card/80 shadow-lg overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground pl-4">
                  Name
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Vendor
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  IP Address
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  SNMP
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Location
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                  Added Date
                </TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOlts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No OLTs match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOlts.map((olt) => {
                  const testState = testStates[olt.id] ?? "idle";
                  return (
                    <TableRow
                      key={olt.id}
                      onClick={() => navigate(`/olts/${olt.id}`)}
                      className={`hover:bg-primary/5 transition-colors duration-150 border-b border-border/40 cursor-pointer ${
                        !olt.isEnabled ? "opacity-60" : ""
                      }`}
                    >
                      {/* Name */}
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              !olt.isEnabled
                                ? "bg-slate-400"
                                : olt.status === "Online"
                                ? "bg-green-400 animate-pulse"
                                : olt.status === "Degraded"
                                ? "bg-amber-400"
                                : "bg-red-400"
                            }`}
                          />
                          <span className="font-semibold text-sm">{olt.name}</span>
                          {olt.isCustom && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 text-primary font-bold uppercase tracking-wider">
                              Custom
                            </span>
                          )}
                          <TestStateBadge state={testState} />
                        </div>
                      </TableCell>

                      {/* Vendor */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <BrandBadge brand={olt.brand} />
                          <TypeBadge type={olt.type} />
                        </div>
                      </TableCell>

                      {/* IP */}
                      <TableCell className="font-mono text-xs text-foreground">
                        {olt.ip}
                      </TableCell>

                      {/* SNMP */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
                            {olt.snmpVersion}
                          </span>
                          {olt.safePollingMode && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">
                              SPM
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <EffectiveStatusBadge olt={olt} />
                      </TableCell>

                      {/* Location */}
                      <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">
                        {olt.location || "—"}
                      </TableCell>

                      {/* Added Date */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(olt.addedDate)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell
                        className="pr-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <OltActionsDropdown
                          olt={olt}
                          canManage={canManage}
                          canTest={canTest}
                          testState={testState}
                          onNavigate={(id) => navigate(`/olts/${id}`)}
                          onEdit={() => setModal({ mode: "edit", oltId: olt.id })}
                          onDelete={() =>
                            setConfirmAction({ type: "delete", olt })
                          }
                          onToggleEnabled={() =>
                            setConfirmAction({
                              type: olt.isEnabled ? "disable" : "enable",
                              olt,
                            })
                          }
                          onTest={() => handleTestConnection(olt)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Add / Edit modal ── */}
      <OltFormModal
        open={modal !== null}
        mode={modal?.mode ?? "add"}
        initial={editingOlt ? oltToForm(editingOlt) : undefined}
        editId={editingOlt?.id}
        allOlts={olts}
        onClose={() => setModal(null)}
        onSave={handleSave}
      />

      {/* ── Confirm: delete ── */}
      <ConfirmModal
        open={confirmAction?.type === "delete"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) handleDelete(confirmAction.olt);
          setConfirmAction(null);
        }}
        title="Delete OLT"
        description="This permanently removes the OLT from the management list. Existing ONU data is unaffected."
        device={confirmAction?.olt.name ?? ""}
        confirmLabel="Delete"
        variant="danger"
        icon="router"
      />

      {/* ── Confirm: disable ── */}
      <ConfirmModal
        open={confirmAction?.type === "disable"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) handleToggleEnabled(confirmAction.olt);
          setConfirmAction(null);
        }}
        title="Disable OLT"
        description="This OLT will be excluded from active monitoring. It can be re-enabled at any time."
        device={confirmAction?.olt.name ?? ""}
        confirmLabel="Disable"
        variant="warning"
        icon="disable"
      />

      {/* ── Confirm: enable ── */}
      <ConfirmModal
        open={confirmAction?.type === "enable"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) handleToggleEnabled(confirmAction.olt);
          setConfirmAction(null);
        }}
        title="Enable OLT"
        description="This OLT will be restored to active monitoring."
        device={confirmAction?.olt.name ?? ""}
        confirmLabel="Enable"
        variant="warning"
        icon="enable"
      />
    </div>
  );
}
