import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { type OltDevice, type OnuDevice } from "@/data/mockData";
import { useApiData } from "@/contexts/ApiDataContext";
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
  Search, MoreHorizontal, Plus, Pencil, Trash2, Power, PowerOff,
  Signal, CheckCircle2, XCircle, Loader2, Eye,
  Server, Cpu, Router, ArrowRightLeft, Database, HardDrive,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export type DeviceType = "OLT" | "ONU" | "Router" | "Switch" | "Server";

export interface InventoryDevice {
  id: string;
  name: string;
  deviceType: DeviceType;
  vendor: string;
  model: string;
  ip: string;
  macOrSerial: string;
  status: "Online" | "Offline" | "Degraded";
  location: string;
  lastSeen: string;
  addedDate: string;
  isEnabled: boolean;
  description: string;
  isCustom: boolean;
  sourceId?: string;
}

interface InventoryFormData {
  name: string;
  deviceType: DeviceType;
  vendor: string;
  model: string;
  ip: string;
  macOrSerial: string;
  location: string;
  description: string;
}

type FormErrors = Partial<Record<keyof InventoryFormData, string>>;
type TestState = "idle" | "testing" | "pass" | "fail";

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "nocpulse-inventory";

const DEVICE_TYPES: DeviceType[] = ["OLT", "ONU", "Router", "Switch", "Server"];

const VENDORS = [
  "Huawei", "ZTE", "BDCOM", "VSOL", "CDATA", "HSGQ",
  "Syrotech", "Corelink", "Zibix", "Nokia", "Fiberhome", "Calix", "Generic",
] as const;

const OLT_MODELS: Record<string, string> = {
  "Huawei:GPON": "MA5800-X15", "Huawei:EPON": "MA5600T",
  "ZTE:GPON": "ZXA10 C300",   "ZTE:EPON": "ZXA10 C600",
  "Nokia:GPON": "ISAM 7360",  "Nokia:EPON": "ISAM 7363",
  "Fiberhome:GPON": "AN5516-06", "Fiberhome:EPON": "AN5516-04",
  "Calix:GPON": "E7-2",       "Calix:EPON": "E3-48C",
};

const ONU_MODELS: Record<string, string> = {
  GPON: "HG8245H", EPON: "EP2400", XPON: "EG8145V5",
};

const SEED_DATE = "2024-01-01T00:00:00Z";

const MOCK_EXTRAS: InventoryDevice[] = [
  // — Routers —
  { id: "inv-r-01", name: "Core-Router-01",   deviceType: "Router", vendor: "Huawei",   model: "NE8000-M8",        ip: "10.0.0.1", macOrSerial: "00:1E:10:A1:B2:01", status: "Online",   location: "Data Center Alpha", lastSeen: "Just now", addedDate: SEED_DATE, isEnabled: true,  description: "Core backbone router — dual uplinks", isCustom: false },
  { id: "inv-r-02", name: "Edge-Router-01",   deviceType: "Router", vendor: "ZTE",      model: "ZXR10 M6000",      ip: "10.0.0.2", macOrSerial: "00:1E:10:A1:B2:02", status: "Online",   location: "North Hub",         lastSeen: "Just now", addedDate: SEED_DATE, isEnabled: true,  description: "North edge router", isCustom: false },
  { id: "inv-r-03", name: "Branch-Router-01", deviceType: "Router", vendor: "Generic",  model: "FW-5060",          ip: "10.0.0.5", macOrSerial: "00:1E:10:A1:B2:05", status: "Degraded", location: "South Node",         lastSeen: "8m ago",   addedDate: SEED_DATE, isEnabled: true,  description: "", isCustom: false },
  { id: "inv-r-04", name: "Edge-Router-02",   deviceType: "Router", vendor: "Corelink", model: "CL-8000E",         ip: "10.0.0.6", macOrSerial: "00:1E:10:A1:B2:06", status: "Online",   location: "Metro Exchange",    lastSeen: "Just now", addedDate: SEED_DATE, isEnabled: true,  description: "", isCustom: false },
  // — Switches —
  { id: "inv-sw-01", name: "Core-Switch-01",    deviceType: "Switch", vendor: "Huawei",   model: "CloudEngine S5735", ip: "10.0.1.1", macOrSerial: "00:22:CF:01:02:01", status: "Online",  location: "Data Center Alpha", lastSeen: "Just now", addedDate: SEED_DATE, isEnabled: true,  description: "48-port aggregation switch", isCustom: false },
  { id: "inv-sw-02", name: "Dist-Switch-01",    deviceType: "Switch", vendor: "BDCOM",    model: "S2900-48T",         ip: "10.0.1.2", macOrSerial: "00:22:CF:01:02:02", status: "Online",  location: "North Hub",         lastSeen: "Just now", addedDate: SEED_DATE, isEnabled: true,  description: "Distribution switch", isCustom: false },
  { id: "inv-sw-03", name: "Access-Switch-02",  deviceType: "Switch", vendor: "ZTE",      model: "ZXR10 5960",        ip: "10.0.1.4", macOrSerial: "00:22:CF:01:02:04", status: "Offline", location: "East Hub",          lastSeen: "2h ago",   addedDate: SEED_DATE, isEnabled: false, description: "", isCustom: false },
  { id: "inv-sw-04", name: "Access-Switch-03",  deviceType: "Switch", vendor: "Corelink", model: "CL-48GE",           ip: "10.0.1.5", macOrSerial: "00:22:CF:01:02:05", status: "Online",  location: "West Node",         lastSeen: "Just now", addedDate: SEED_DATE, isEnabled: true,  description: "", isCustom: false },
  { id: "inv-sw-05", name: "Dist-Switch-02",    deviceType: "Switch", vendor: "Huawei",   model: "CloudEngine S6730", ip: "10.0.1.6", macOrSerial: "00:22:CF:01:02:06", status: "Online",  location: "South Node",        lastSeen: "Just now", addedDate: SEED_DATE, isEnabled: true,  description: "", isCustom: false },
  { id: "inv-sw-06", name: "Access-Switch-04",  deviceType: "Switch", vendor: "VSOL",     model: "V2804RGW",          ip: "10.0.1.7", macOrSerial: "00:22:CF:01:02:07", status: "Online",  location: "Suburban Hub 1",    lastSeen: "Just now", addedDate: SEED_DATE, isEnabled: true,  description: "", isCustom: false },
  // — Servers —
  { id: "inv-sv-01", name: "NMS-Server-01",     deviceType: "Server", vendor: "Generic",  model: "Dell PowerEdge R750", ip: "10.0.200.10", macOrSerial: "SN:DLL7249823", status: "Online", location: "Data Center Alpha", lastSeen: "Just now", addedDate: SEED_DATE, isEnabled: true, description: "Primary NMS/monitoring server",  isCustom: false },
  { id: "inv-sv-02", name: "Backup-Server-01",  deviceType: "Server", vendor: "Generic",  model: "HP ProLiant DL380",  ip: "10.0.200.11", macOrSerial: "SN:HPE9128473", status: "Online", location: "Data Center Alpha", lastSeen: "3m ago",   addedDate: SEED_DATE, isEnabled: true, description: "Backup and archive server",      isCustom: false },
];

const DEFAULT_FORM: InventoryFormData = {
  name: "",
  deviceType: "OLT",
  vendor: "Huawei",
  model: "",
  ip: "",
  macOrSerial: "",
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
  return `inv-custom-${Date.now()}`;
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

function seedFromApi(apiOlts: OltDevice[], apiOnus: OnuDevice[]): InventoryDevice[] {
  const oltMap = new Map(apiOlts.map((o) => [o.id, o]));

  const oltDevices: InventoryDevice[] = apiOlts.map((olt) => ({
    id: `inv-olt-${olt.id}`,
    name: olt.name,
    deviceType: "OLT" as const,
    vendor: olt.brand,
    model: OLT_MODELS[`${olt.brand}:${olt.type}`] ?? `${olt.brand} OLT`,
    ip: olt.ip,
    macOrSerial: `SN:${olt.id.replace(/-/g, "").toUpperCase()}`,
    status: olt.status,
    location: olt.location,
    lastSeen: olt.lastSeen,
    addedDate: olt.lastSync,
    isEnabled: true,
    description: `${olt.type} · ${olt.ponPortCount} PON ports`,
    isCustom: false,
    sourceId: olt.id,
  }));

  const onuDevices: InventoryDevice[] = apiOnus.slice(0, 8).map((onu, idx) => {
    const parentOlt = oltMap.get(onu.oltId);
    return {
      id: `inv-onu-${onu.id}`,
      name: onu.customerName || `ONU ${onu.onuNo}`,
      deviceType: "ONU" as const,
      vendor: parentOlt?.brand ?? "Huawei",
      model: ONU_MODELS[onu.onuType] ?? "HG8245H",
      ip: `10.0.10.${100 + idx}`,
      macOrSerial: onu.macAddress,
      status: onu.status,
      location: onu.description,
      lastSeen: onu.lastSync,
      addedDate: onu.lastSync,
      isEnabled: true,
      description: `Port: ${onu.oltPort} · VLAN ${onu.vlanId}`,
      isCustom: false,
      sourceId: onu.id,
    };
  });

  return [...oltDevices, ...onuDevices, ...MOCK_EXTRAS];
}

function loadInventory(): InventoryDevice[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InventoryDevice[]) : null;
  } catch {
    return null;
  }
}

function storeInventory(devices: InventoryDevice[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}

function validateForm(
  form: InventoryFormData,
  devices: InventoryDevice[],
  editId?: string
): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "Device name is required";
  if (!form.model.trim()) errors.model = "Model is required";
  if (!form.ip.trim()) {
    errors.ip = "IP address is required";
  } else if (!isValidIp(form.ip)) {
    errors.ip = "Enter a valid IPv4 address (e.g. 10.0.1.1)";
  } else if (devices.some((d) => d.ip === form.ip.trim() && d.id !== editId)) {
    errors.ip = "A device with this IP already exists";
  }
  return errors;
}

function createFromForm(form: InventoryFormData): InventoryDevice {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: form.name.trim(),
    deviceType: form.deviceType,
    vendor: form.vendor,
    model: form.model.trim(),
    ip: form.ip.trim(),
    macOrSerial: form.macOrSerial.trim(),
    status: "Offline",
    location: form.location.trim(),
    lastSeen: "Never",
    addedDate: now,
    isEnabled: true,
    description: form.description.trim(),
    isCustom: true,
  };
}

function applyFormToDevice(
  existing: InventoryDevice,
  form: InventoryFormData
): InventoryDevice {
  return {
    ...existing,
    name: form.name.trim(),
    deviceType: form.deviceType,
    vendor: form.vendor,
    model: form.model.trim(),
    ip: form.ip.trim(),
    macOrSerial: form.macOrSerial.trim(),
    location: form.location.trim(),
    description: form.description.trim(),
  };
}

function deviceToForm(d: InventoryDevice): InventoryFormData {
  return {
    name: d.name,
    deviceType: d.deviceType,
    vendor: d.vendor,
    model: d.model,
    ip: d.ip,
    macOrSerial: d.macOrSerial,
    location: d.location,
    description: d.description,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────

const DEVICE_TYPE_STYLE: Record<DeviceType, { color: string; bg: string; border: string }> = {
  OLT:    { color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20"    },
  ONU:    { color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/20"    },
  Router: { color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20"  },
  Switch: { color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/20"   },
  Server: { color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20"  },
};

const DEVICE_TYPE_ICONS: Record<DeviceType, React.ElementType> = {
  OLT:    Server,
  ONU:    Cpu,
  Router: Router,
  Switch: ArrowRightLeft,
  Server: Database,
};

const VENDOR_COLORS: Record<string, string> = {
  Huawei:    "bg-red-500/10 text-red-400 border-red-500/20",
  ZTE:       "bg-blue-500/10 text-blue-400 border-blue-500/20",
  BDCOM:     "bg-teal-500/10 text-teal-400 border-teal-500/20",
  VSOL:      "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  CDATA:     "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  HSGQ:      "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Syrotech:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Corelink:  "bg-sky-500/10 text-sky-400 border-sky-500/20",
  Zibix:     "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Nokia:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Fiberhome: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Calix:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Generic:   "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

function DeviceTypeBadge({ type }: { type: DeviceType }) {
  const s = DEVICE_TYPE_STYLE[type];
  const Icon = DEVICE_TYPE_ICONS[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${s.color} ${s.bg} ${s.border}`}>
      <Icon className="h-2.5 w-2.5" />
      {type}
    </span>
  );
}

function VendorBadge({ vendor }: { vendor: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${VENDOR_COLORS[vendor] ?? "bg-muted text-muted-foreground border-border"}`}>
      {vendor}
    </span>
  );
}

function InvStatusBadge({ device }: { device: InventoryDevice }) {
  if (!device.isEnabled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-500/10 text-slate-400 border-slate-500/25">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Disabled
      </span>
    );
  }
  const map = {
    Online:   "bg-green-500/10 text-green-400 border-green-500/25",
    Offline:  "bg-red-500/10 text-red-400 border-red-500/25",
    Degraded: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  } as const;
  const dotMap = {
    Online: "bg-green-400 animate-pulse", Offline: "bg-red-400", Degraded: "bg-amber-400",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${map[device.status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotMap[device.status]}`} />
      {device.status}
    </span>
  );
}

function TestStateBadge({ state }: { state: TestState }) {
  if (state === "idle") return null;
  if (state === "testing")
    return <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium whitespace-nowrap"><Loader2 className="h-2.5 w-2.5 animate-spin" />Testing…</span>;
  if (state === "pass")
    return <span className="inline-flex items-center gap-1 text-[10px] text-green-400 font-medium"><CheckCircle2 className="h-2.5 w-2.5" />OK</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-medium"><XCircle className="h-2.5 w-2.5" />Failed</span>;
}

// ── Actions dropdown ───────────────────────────────────────────────────────

interface ActionsProps {
  device: InventoryDevice;
  canManage: boolean;
  canTest: boolean;
  testState: TestState;
  onViewDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  onTest: () => void;
}

function InventoryActionsDropdown({
  device, canManage, canTest, testState,
  onViewDetails, onEdit, onDelete, onToggleEnabled, onTest,
}: ActionsProps) {
  const canNavigate = !device.isCustom && (device.deviceType === "OLT" || device.deviceType === "ONU");
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
        <DropdownMenuLabel className="text-xs text-muted-foreground truncate max-w-[180px]">
          {device.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {canNavigate && (
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={onViewDetails}>
            <Eye className="h-4 w-4" /> View Details
          </DropdownMenuItem>
        )}

        {(canTest || canManage) && (
          <DropdownMenuItem
            className={`gap-2 ${testState === "testing" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            disabled={testState === "testing"}
            onClick={testState !== "testing" ? onTest : undefined}
          >
            {testState === "testing" ? <Loader2 className="h-4 w-4 animate-spin" />
              : testState === "pass" ? <CheckCircle2 className="h-4 w-4 text-green-400" />
              : testState === "fail" ? <XCircle className="h-4 w-4 text-red-400" />
              : <Signal className="h-4 w-4" />}
            {testState === "testing" ? "Testing…"
              : testState === "pass" ? "Connected ✓"
              : testState === "fail" ? "Failed ✗"
              : "Test Connection"}
          </DropdownMenuItem>
        )}

        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Edit Device
            </DropdownMenuItem>
            <DropdownMenuItem
              className={`gap-2 cursor-pointer ${!device.isEnabled ? "text-green-500 focus:text-green-500 focus:bg-green-500/10" : ""}`}
              onClick={onToggleEnabled}
            >
              {device.isEnabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
              {device.isEnabled ? "Disable Device" : "Enable Device"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" /> Delete Device
            </DropdownMenuItem>
          </>
        )}

        {!canNavigate && !canTest && !canManage && (
          <DropdownMenuItem disabled className="gap-2 opacity-40 cursor-not-allowed text-xs">
            <Eye className="h-3.5 w-3.5" /> View Only
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Inventory Form Modal ───────────────────────────────────────────────────

interface FormModalProps {
  open: boolean;
  mode: "add" | "edit";
  initial?: InventoryFormData;
  editId?: string;
  allDevices: InventoryDevice[];
  onClose: () => void;
  onSave: (data: InventoryFormData) => void;
}

function InventoryFormModal({ open, mode, initial, editId, allDevices, onClose, onSave }: FormModalProps) {
  const [form, setForm] = useState<InventoryFormData>(initial ?? DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(initial ?? DEFAULT_FORM);
      setErrors({});
    }
  }, [open, initial]);

  const setField = (field: keyof InventoryFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = () => {
    const errs = validateForm(form, allDevices, editId);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave(form);
  };

  const labelCls = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";
  const inputCls = "h-9 bg-background/50 text-sm";
  const TypeIcon = DEVICE_TYPE_ICONS[form.deviceType];
  const typeStyle = DEVICE_TYPE_STYLE[form.deviceType];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className={`p-1 rounded ${typeStyle.bg}`}>
              <TypeIcon className={`h-4 w-4 ${typeStyle.color}`} />
            </span>
            {mode === "add" ? "Add Device" : "Edit Device"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1 max-h-[62vh] overflow-y-auto pr-0.5">
          {/* Name + Device Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Device Name *</label>
              <Input className={inputCls} placeholder="Core-Router-01" value={form.name} onChange={(e) => setField("name", e.target.value)} />
              {errors.name && <p className="text-[11px] text-red-400 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className={labelCls}>Device Type *</label>
              <Select value={form.deviceType} onValueChange={(v) => setField("deviceType", v)}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vendor + Model */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Vendor *</label>
              <Select value={form.vendor} onValueChange={(v) => setField("vendor", v)}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDORS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Model *</label>
              <Input className={inputCls} placeholder="MA5800-X15" value={form.model} onChange={(e) => setField("model", e.target.value)} />
              {errors.model && <p className="text-[11px] text-red-400 mt-1">{errors.model}</p>}
            </div>
          </div>

          {/* IP + MAC/Serial */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>IP Address *</label>
              <Input className={`${inputCls} font-mono`} placeholder="10.0.1.10" value={form.ip} onChange={(e) => setField("ip", e.target.value)} />
              {errors.ip && <p className="text-[11px] text-red-400 mt-1">{errors.ip}</p>}
            </div>
            <div>
              <label className={labelCls}>MAC / Serial</label>
              <Input className={`${inputCls} font-mono`} placeholder="00:11:22:33:44:55" value={form.macOrSerial} onChange={(e) => setField("macOrSerial", e.target.value)} />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className={labelCls}>Location</label>
            <Input className={inputCls} placeholder="Data Center Alpha" value={form.location} onChange={(e) => setField("location", e.target.value)} />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <Textarea className="bg-background/50 text-sm resize-none min-h-[68px]" placeholder="Optional notes about this device…" value={form.description} onChange={(e) => setField("description", e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none h-9">Cancel</Button>
          <Button onClick={handleSubmit} className="flex-1 sm:flex-none h-9">
            {mode === "add" ? "Add Device" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function DeviceInventory() {
  const { olts: apiOlts, onus: apiOnus } = useApiData();
  const [, navigate] = useLocation();
  const { can } = usePermissions();

  const [devices, setDevices] = useState<InventoryDevice[] | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [vendorFilter, setVendorFilter] = useState("All Vendors");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [locationFilter, setLocationFilter] = useState("All Locations");

  const [modal, setModal] = useState<{ mode: "add" | "edit"; deviceId?: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "disable" | "enable";
    device: InventoryDevice;
  } | null>(null);
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});

  // Seed on first load
  useEffect(() => {
    const stored = loadInventory();
    if (stored && stored.length > 0) {
      setDevices(stored);
    } else if (apiOlts.length > 0) {
      const seeded = seedFromApi(apiOlts, apiOnus);
      setDevices(seeded);
      storeInventory(seeded);
    }
  }, [apiOlts, apiOnus]);

  // Persist on change
  useEffect(() => {
    if (devices !== null) storeInventory(devices);
  }, [devices]);

  const list = devices ?? [];

  const vendors = useMemo(() => Array.from(new Set(list.map((d) => d.vendor))).sort(), [list]);
  const locations = useMemo(() => Array.from(new Set(list.map((d) => d.location).filter(Boolean))).sort(), [list]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return list.filter((d) => {
      const matchSearch =
        !term ||
        d.name.toLowerCase().includes(term) ||
        d.ip.includes(term) ||
        d.vendor.toLowerCase().includes(term) ||
        d.model.toLowerCase().includes(term) ||
        d.macOrSerial.toLowerCase().includes(term) ||
        d.location.toLowerCase().includes(term);
      const effectiveStatus = !d.isEnabled ? "Disabled" : d.status;
      return (
        matchSearch &&
        (typeFilter === "All Types" || d.deviceType === typeFilter) &&
        (vendorFilter === "All Vendors" || d.vendor === vendorFilter) &&
        (statusFilter === "All Status" || statusFilter === effectiveStatus) &&
        (locationFilter === "All Locations" || d.location === locationFilter)
      );
    });
  }, [list, search, typeFilter, vendorFilter, statusFilter, locationFilter]);

  // ── Summary counts ───────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const c: Record<DeviceType, number> = { OLT: 0, ONU: 0, Router: 0, Switch: 0, Server: 0 };
    list.forEach((d) => { c[d.deviceType]++; });
    return c;
  }, [list]);

  const onlinePct = useMemo(() => {
    if (!list.length) return 0;
    const on = list.filter((d) => d.isEnabled && d.status === "Online").length;
    return Math.round((on / list.length) * 100);
  }, [list]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSave = (form: InventoryFormData) => {
    if (modal?.mode === "add") {
      const d = createFromForm(form);
      setDevices((prev) => (prev ? [...prev, d] : [d]));
      toast.success(`${d.name} added to inventory`, { description: `${d.vendor} ${d.deviceType} · ${d.ip}` });
    } else if (modal?.mode === "edit" && modal.deviceId) {
      const id = modal.deviceId;
      setDevices((prev) => prev ? prev.map((d) => d.id === id ? applyFormToDevice(d, form) : d) : prev);
      toast.success("Device updated");
    }
    setModal(null);
  };

  const handleDelete = useCallback((device: InventoryDevice) => {
    setDevices((prev) => prev ? prev.filter((d) => d.id !== device.id) : prev);
    toast.success(`${device.name} removed from inventory`);
  }, []);

  const handleToggleEnabled = useCallback((device: InventoryDevice) => {
    const next = !device.isEnabled;
    setDevices((prev) => prev ? prev.map((d) => d.id === device.id ? { ...d, isEnabled: next } : d) : prev);
    toast.success(`${device.name} ${next ? "enabled" : "disabled"}`);
  }, []);

  const handleTest = useCallback(async (device: InventoryDevice) => {
    setTestStates((prev) => ({ ...prev, [device.id]: "testing" }));
    toast.info(`Testing connection to ${device.name}…`);
    await new Promise((r) => setTimeout(r, 1300 + Math.random() * 800));
    const pass = Math.random() > 0.3;
    setTestStates((prev) => ({ ...prev, [device.id]: pass ? "pass" : "fail" }));
    if (pass) {
      toast.success(`${device.name} — Reachable`, { description: `${device.deviceType} at ${device.ip} responded` });
    } else {
      toast.error(`${device.name} — Unreachable`, { description: `No response from ${device.ip} (${device.vendor} ${device.model})` });
    }
    setTimeout(() => setTestStates((prev) => ({ ...prev, [device.id]: "idle" })), 8000);
  }, []);

  const editingDevice =
    modal?.mode === "edit" && modal.deviceId
      ? list.find((d) => d.id === modal.deviceId)
      : undefined;

  const canManage = can("inventory.manage");
  const canTest = can("inventory.test");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Device Inventory</h1>
          <div className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
            Multi-vendor network assets
            <Badge variant="secondary">{filtered.length} of {list.length} devices</Badge>
          </div>
        </div>
        {canManage && (
          <Button className="gap-2" onClick={() => setModal({ mode: "add" })}>
            <Plus className="h-4 w-4" /> Add Device
          </Button>
        )}
      </div>

      <PermissionBanner context="Device Inventory — network asset management" />

      {/* Summary strip */}
      {list.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {DEVICE_TYPES.map((type) => {
            const s = DEVICE_TYPE_STYLE[type];
            const Icon = DEVICE_TYPE_ICONS[type];
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? "All Types" : type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer text-left ${
                  typeFilter === type
                    ? `${s.bg} ${s.border} ring-1 ring-inset ${s.border}`
                    : "border-border/50 bg-card/60 hover:border-border"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${typeFilter === type ? s.color : "text-muted-foreground"}`} />
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${typeFilter === type ? s.color : "text-muted-foreground"}`}>{type}</p>
                  <p className="text-base font-bold leading-tight">{counts[type]}</p>
                </div>
              </button>
            );
          })}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-card/60">
            <HardDrive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Online</p>
              <p className={`text-base font-bold leading-tight ${onlinePct >= 90 ? "text-green-400" : onlinePct >= 70 ? "text-amber-400" : "text-red-400"}`}>{onlinePct}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-card/60 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-border/60">
        <div className="relative flex-1 min-w-[140px] sm:flex-none sm:w-full sm:max-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search devices…"
            className="pl-8 bg-background/50 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[120px] bg-background/50 min-w-[100px] flex-1 sm:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Types">All Types</SelectItem>
            {DEVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="w-full sm:w-[130px] bg-background/50 min-w-[100px] flex-1 sm:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Vendors">All Vendors</SelectItem>
            {vendors.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>

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

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-full sm:w-[160px] bg-background/50 min-w-[120px] flex-1 sm:flex-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Locations">All Locations</SelectItem>
            {locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden backdrop-blur-sm bg-card/80 shadow-lg overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
              {[
                "Device Name", "Type", "Vendor", "Model",
                "IP Address", "MAC / Serial", "Status",
                "Location", "Last Seen",
              ].map((h) => (
                <TableHead key={h} className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground pl-4 first:pl-4">
                  {h}
                </TableHead>
              ))}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-16 text-muted-foreground">
                  <HardDrive className="h-7 w-7 mx-auto mb-2 opacity-25" />
                  <p className="text-sm">No devices match your filters.</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((device) => {
                const testState = testStates[device.id] ?? "idle";
                return (
                  <TableRow
                    key={device.id}
                    className={`hover:bg-primary/5 transition-colors duration-150 border-b border-border/40 ${!device.isEnabled ? "opacity-60" : ""}`}
                  >
                    {/* Device Name */}
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${
                          !device.isEnabled ? "bg-slate-400"
                          : device.status === "Online" ? "bg-green-400 animate-pulse"
                          : device.status === "Degraded" ? "bg-amber-400"
                          : "bg-red-400"
                        }`} />
                        <span className="font-semibold text-sm">{device.name}</span>
                        {device.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 text-primary font-bold uppercase tracking-wider">
                            Custom
                          </span>
                        )}
                        <TestStateBadge state={testState} />
                      </div>
                      {device.description && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 pl-4 truncate max-w-[200px]">
                          {device.description}
                        </p>
                      )}
                    </TableCell>

                    {/* Type */}
                    <TableCell className="pl-4">
                      <DeviceTypeBadge type={device.deviceType} />
                    </TableCell>

                    {/* Vendor */}
                    <TableCell className="pl-4">
                      <VendorBadge vendor={device.vendor} />
                    </TableCell>

                    {/* Model */}
                    <TableCell className="pl-4">
                      <span className="text-sm font-mono text-foreground/80">{device.model}</span>
                    </TableCell>

                    {/* IP */}
                    <TableCell className="pl-4 font-mono text-xs text-foreground">
                      {device.ip}
                    </TableCell>

                    {/* MAC / Serial */}
                    <TableCell className="pl-4">
                      <span className="font-mono text-[11px] text-muted-foreground">{device.macOrSerial || "—"}</span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="pl-4">
                      <InvStatusBadge device={device} />
                    </TableCell>

                    {/* Location */}
                    <TableCell className="pl-4 text-sm text-muted-foreground max-w-[120px] truncate">
                      {device.location || "—"}
                    </TableCell>

                    {/* Last Seen */}
                    <TableCell className="pl-4 text-xs text-muted-foreground whitespace-nowrap">
                      {device.lastSeen}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="pr-3" onClick={(e) => e.stopPropagation()}>
                      <InventoryActionsDropdown
                        device={device}
                        canManage={canManage}
                        canTest={canTest}
                        testState={testState}
                        onViewDetails={() => {
                          if (device.deviceType === "OLT" && device.sourceId) navigate(`/olts/${device.sourceId}`);
                          else if (device.deviceType === "ONU" && device.sourceId) navigate(`/onus/${device.sourceId}`);
                        }}
                        onEdit={() => setModal({ mode: "edit", deviceId: device.id })}
                        onDelete={() => setConfirmAction({ type: "delete", device })}
                        onToggleEnabled={() =>
                          setConfirmAction({ type: device.isEnabled ? "disable" : "enable", device })
                        }
                        onTest={() => handleTest(device)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit modal */}
      <InventoryFormModal
        open={modal !== null}
        mode={modal?.mode ?? "add"}
        initial={editingDevice ? deviceToForm(editingDevice) : undefined}
        editId={editingDevice?.id}
        allDevices={list}
        onClose={() => setModal(null)}
        onSave={handleSave}
      />

      {/* Confirm: delete */}
      <ConfirmModal
        open={confirmAction?.type === "delete"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => { if (confirmAction) handleDelete(confirmAction.device); setConfirmAction(null); }}
        title="Remove Device"
        description="This permanently removes the device from the inventory. Network configuration is unaffected."
        device={confirmAction?.device.name ?? ""}
        confirmLabel="Remove"
        variant="danger"
        icon="router"
      />

      {/* Confirm: disable */}
      <ConfirmModal
        open={confirmAction?.type === "disable"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => { if (confirmAction) handleToggleEnabled(confirmAction.device); setConfirmAction(null); }}
        title="Disable Device"
        description="This device will be marked as disabled and excluded from active monitoring."
        device={confirmAction?.device.name ?? ""}
        confirmLabel="Disable"
        variant="warning"
        icon="disable"
      />

      {/* Confirm: enable */}
      <ConfirmModal
        open={confirmAction?.type === "enable"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => { if (confirmAction) handleToggleEnabled(confirmAction.device); setConfirmAction(null); }}
        title="Enable Device"
        description="This device will be restored to active monitoring."
        device={confirmAction?.device.name ?? ""}
        confirmLabel="Enable"
        variant="warning"
        icon="enable"
      />
    </div>
  );
}
