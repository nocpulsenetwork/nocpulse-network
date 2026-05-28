import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { type OltDevice } from "@/data/mockData";
import { useApiData } from "@/contexts/ApiDataContext";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionBanner } from "@/components/PermissionBanner";
import { usePermissions } from "@/lib/permissions";
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
import { toast } from "sonner";
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
  description: string;
  addedDate: string;
  isEnabled: boolean;
  isCustom: boolean;
}

interface OltFormData {
  name: string;
  brand: string;
  ip: string;
  type: "GPON" | "EPON";
  snmpVersion: "v1" | "v2c" | "v3";
  community: string;
  location: string;
  description: string;
}

type FormErrors = Partial<Record<keyof OltFormData, string>>;
type TestState = "idle" | "testing" | "pass" | "fail";

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "nocpulse-managed-olts";
const VENDORS = ["Huawei", "ZTE", "Nokia", "Fiberhome", "Calix", "Other"] as const;

const DEFAULT_FORM: OltFormData = {
  name: "",
  brand: "Huawei",
  ip: "",
  type: "GPON",
  snmpVersion: "v2c",
  community: "public",
  location: "",
  description: "",
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
    description: "",
    addedDate: olt.lastSync,
    isEnabled: true,
    isCustom: false,
  }));
}

function loadOlts(): ManagedOlt[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ManagedOlt[]) : null;
  } catch {
    return null;
  }
}

function storeOlts(olts: ManagedOlt[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(olts));
}

function validateForm(
  form: OltFormData,
  olts: ManagedOlt[],
  editId?: string
): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "OLT name is required";
  if (!form.ip.trim()) {
    errors.ip = "IP address is required";
  } else if (!isValidIp(form.ip)) {
    errors.ip = "Enter a valid IPv4 address (e.g. 10.0.1.1)";
  } else if (olts.some((o) => o.ip === form.ip.trim() && o.id !== editId)) {
    errors.ip = "An OLT with this IP already exists";
  }
  if (!form.community.trim()) errors.community = "Community string is required";
  return errors;
}

function createFromForm(form: OltFormData): ManagedOlt {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: form.name.trim(),
    ip: form.ip.trim(),
    brand: form.brand,
    type: form.type,
    mode: form.type,
    location: form.location.trim(),
    status: "Offline",
    uptime: "0d 0h",
    lastSeen: "Never",
    portCount: 0,
    activeOnus: 0,
    cpu: 0,
    memory: 0,
    temperature: 0,
    lastSync: now,
    uplinkStatus: "Down",
    uplinkPort: "",
    ponPortCount: 0,
    snmpVersion: form.snmpVersion,
    community: form.community.trim() || "public",
    description: form.description.trim(),
    addedDate: now,
    isEnabled: true,
    isCustom: true,
  };
}

function applyFormToOlt(existing: ManagedOlt, form: OltFormData): ManagedOlt {
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
    description: form.description.trim(),
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
    location: olt.location,
    description: olt.description,
  };
}

// ── Small sub-components ───────────────────────────────────────────────────

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
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
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
  onSave: (data: OltFormData) => void;
}

function OltFormModal({
  open, mode, initial, editId, allOlts, onClose, onSave,
}: OltFormModalProps) {
  const [form, setForm] = useState<OltFormData>(initial ?? DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(initial ?? DEFAULT_FORM);
      setErrors({});
    }
  }, [open, initial]);

  const setField = (field: keyof OltFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = () => {
    const errs = validateForm(form, allOlts, editId);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSave(form);
  };

  const labelCls = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";
  const inputCls = "h-9 bg-background/50 text-sm";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-primary" />
            {mode === "add" ? "Add OLT" : "Edit OLT"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[62vh] overflow-y-auto pr-0.5">
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
              {errors.name && (
                <p className="text-[11px] text-red-400 mt-1">{errors.name}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Vendor *</label>
              <Select
                value={form.brand}
                onValueChange={(v) => setField("brand", v)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDORS.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
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
                placeholder="10.0.1.10"
                value={form.ip}
                onChange={(e) => setField("ip", e.target.value)}
              />
              {errors.ip && (
                <p className="text-[11px] text-red-400 mt-1">{errors.ip}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>PON Type *</label>
              <Select
                value={form.type}
                onValueChange={(v) => setField("type", v)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
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
              <Select
                value={form.snmpVersion}
                onValueChange={(v) => setField("snmpVersion", v)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
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
              {errors.community && (
                <p className="text-[11px] text-red-400 mt-1">{errors.community}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className={labelCls}>Location</label>
            <Input
              className={inputCls}
              placeholder="Data Center Alpha"
              value={form.location}
              onChange={(e) => setField("location", e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <Textarea
              className="bg-background/50 text-sm resize-none min-h-[72px]"
              placeholder="Optional notes about this OLT…"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none h-9">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex-1 sm:flex-none h-9">
            {mode === "add" ? "Add OLT" : "Save Changes"}
          </Button>
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

  const handleSave = (form: OltFormData) => {
    if (modal?.mode === "add") {
      const newOlt = createFromForm(form);
      setManagedOlts((prev) => (prev ? [...prev, newOlt] : [newOlt]));
      toast.success(`${newOlt.name} added`, {
        description: `${newOlt.brand} ${newOlt.type} · ${newOlt.ip}`,
      });
    } else if (modal?.mode === "edit" && modal.oltId) {
      const editId = modal.oltId;
      setManagedOlts((prev) =>
        prev ? prev.map((o) => (o.id === editId ? applyFormToOlt(o, form) : o)) : prev
      );
      toast.success("OLT updated successfully");
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
    await new Promise((resolve) =>
      setTimeout(resolve, 1400 + Math.random() * 700)
    );
    const pass = Math.random() > 0.3;
    setTestStates((prev) => ({ ...prev, [olt.id]: pass ? "pass" : "fail" }));
    if (pass) {
      toast.success(`${olt.name} — Reachable`, {
        description: `SNMP ${olt.snmpVersion.toUpperCase()} responded at ${olt.ip}`,
      });
    } else {
      toast.error(`${olt.name} — Unreachable`, {
        description: `No response from ${olt.ip} · ${olt.snmpVersion.toUpperCase()} · community: ${olt.community}`,
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
                  className={`rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-lg hover:border-primary/40 hover:shadow-primary/10 transition-all duration-200 group p-4 space-y-3 ${
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
                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-mono">
                      SNMP {olt.snmpVersion.toUpperCase()}
                    </span>
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
                      className={`hover:bg-primary/5 transition-colors duration-150 border-b border-border/40 ${
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
                        <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
                          {olt.snmpVersion}
                        </span>
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
