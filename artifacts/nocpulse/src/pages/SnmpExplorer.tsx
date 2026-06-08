import { useState } from 'react';
import { Terminal, Play, Loader2, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRole } from '@/contexts/RoleContext';
import { RoleGuard } from '@/components/RoleGuard';

// ── Types mirroring the backend response ─────────────────────────────────────

interface WalkRow {
  oid: string;
  typeName: string;
  hex: string | null;
  text: string | null;
  num: number | null;
  isMac: boolean;
}

interface WalkSubtree {
  prefix: string;
  rowCount: number;
  hasMac: boolean;
  typeNames: string;
  samples: string[];
}

interface WalkResult {
  device: {
    vendor: string;
    model: string;
    ponType: string;
    sysDescr: string | null;
    sysName: string | null;
    sysObjId: string | null;
  };
  walk: {
    rootOid: string;
    totalOids: number;
    walkMs: number;
    batches: number;
    subtrees: WalkSubtree[];
    rows: WalkRow[];
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayValue(row: WalkRow): string {
  if (row.isMac) return `MAC: ${row.hex}`;
  if (row.text !== null) return row.text;
  if (row.hex !== null) return `0x${row.hex.replace(/:/g, '')}`;
  if (row.num !== null) return String(row.num);
  return '—';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SubtreeRow({ s }: { s: WalkSubtree }) {
  const [open, setOpen] = useState(false);
  return (
    <tr
      className={`border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer ${s.hasMac ? 'bg-amber-500/5' : ''}`}
      onClick={() => setOpen((v) => !v)}
    >
      <td className="px-3 py-2 w-6">
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </td>
      <td className="px-2 py-2 font-mono text-[11px] text-foreground break-all">
        {s.prefix}
        {open && (
          <div className="mt-1.5 space-y-0.5">
            {s.samples.map((v, i) => (
              <div key={i} className="text-[10px] text-muted-foreground pl-2 border-l border-border/50">{v}</div>
            ))}
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-center text-[11px] tabular-nums">{s.rowCount}</td>
      <td className="px-2 py-2 text-[10px] text-muted-foreground">{s.typeNames}</td>
      <td className="px-2 py-2 text-center">
        {s.hasMac && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
            MAC
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function SnmpExplorerInner() {
  const [ip,        setIp]        = useState('');
  const [community, setCommunity] = useState('public');
  const [port,      setPort]      = useState('161');
  const [rootOid,   setRootOid]   = useState('1.3.6.1.4.1.34592');
  const [maxOids,   setMaxOids]   = useState('500');

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<WalkResult | null>(null);

  const [tab, setTab] = useState<'subtrees' | 'rows'>('subtrees');

  async function handleRun() {
    const trimIp = ip.trim();
    const trimCom = community.trim();
    if (!trimIp || !trimCom) { setError('IP and community string are required.'); return; }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch('/api/olts/debug-snmp-walk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip:       trimIp,
          community: trimCom,
          port:      Number(port) || 161,
          rootOid:  rootOid.trim() || '1.3.6.1.4.1.34592',
          maxOids:  Number(maxOids) || 500,
        }),
      });

      const j = await resp.json() as { data?: WalkResult; error?: string; meta?: { note?: string } };

      if (!resp.ok) {
        setError(j.error ?? `Server error ${resp.status}`);
      } else if (j.data) {
        setResult(j.data);
      } else {
        setError('Unexpected response from server.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Terminal className="h-4.5 w-4.5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-bold leading-tight">SNMP Explorer</h1>
          <p className="text-[11px] text-muted-foreground">Read-only SNMP walk · Super Admin only</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold border bg-amber-500/10 text-amber-400 border-amber-500/20 uppercase tracking-wider">
          <Terminal className="h-2.5 w-2.5" /> Temp Debug Tool
        </span>
      </div>

      {/* ── Connection form ── */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">Connection</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">OLT IP Address</label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="192.168.1.1"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              min={1} max={65535}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SNMP Community String</label>
          <input
            type="text"
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
            placeholder="public"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* ── Walk parameters ── */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">Walk Parameters</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Root OID</label>
            <input
              type="text"
              value={rootOid}
              onChange={(e) => setRootOid(e.target.value)}
              placeholder="1.3.6.1.4.1.34592"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Max OIDs</label>
            <input
              type="number"
              value={maxOids}
              onChange={(e) => setMaxOids(e.target.value)}
              min={10} max={2000}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <Button onClick={handleRun} disabled={loading} className="w-full sm:w-auto">
          {loading
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Walking…</>
            : <><Play className="h-4 w-4 mr-2" /> Run Walk</>}
        </Button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="space-y-4">

          {/* Device info banner */}
          <div className="rounded-xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-sm font-semibold">Device Connected</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Vendor',   value: result.device.vendor   },
                { label: 'Model',    value: result.device.model    },
                { label: 'PON Type', value: result.device.ponType  },
                { label: 'sysName',  value: result.device.sysName ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-muted/30 border border-border/50 p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
                  <p className="text-[11px] font-semibold font-mono">{value}</p>
                </div>
              ))}
            </div>
            {result.device.sysDescr && (
              <p className="mt-3 text-[10px] font-mono text-muted-foreground bg-muted/20 rounded px-2 py-1 break-all">{result.device.sysDescr}</p>
            )}
            <div className="flex gap-4 mt-3 pt-3 border-t border-border/40 text-[10px] text-muted-foreground">
              <span><span className="font-semibold text-foreground">{result.walk.totalOids}</span> OIDs returned</span>
              <span><span className="font-semibold text-foreground">{result.walk.subtrees.length}</span> subtrees</span>
              <span><span className="font-semibold text-foreground">{result.walk.batches}</span> GETBULK batches</span>
              <span><span className="font-semibold text-foreground">{result.walk.walkMs}</span> ms</span>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 rounded-lg border border-border bg-muted/20 p-1 w-fit">
            {(['subtrees', 'rows'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors capitalize ${
                  tab === t
                    ? 'bg-background border border-border shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'subtrees' ? `Subtrees (${result.walk.subtrees.length})` : `Raw Rows (${result.walk.rows.length})`}
              </button>
            ))}
          </div>

          {/* Subtrees table */}
          {tab === 'subtrees' && (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">OID Subtrees — grouped by depth-11 prefix · click to expand samples</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/20">
                      <th className="px-3 py-2 w-6" />
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground">OID Prefix</th>
                      <th className="px-2 py-2 text-center font-semibold text-muted-foreground w-16">Rows</th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Types</th>
                      <th className="px-2 py-2 text-center font-semibold text-muted-foreground w-14">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.walk.subtrees.map((s) => (
                      <SubtreeRow key={s.prefix} s={s} />
                    ))}
                    {result.walk.subtrees.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">No OIDs returned for this subtree.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Raw rows table */}
          {tab === 'rows' && (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Raw OIDs · {result.walk.rows.length} rows</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Amber = MAC/LLID (6-byte OctetString)</span>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border/50 bg-muted/20">
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">OID</th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground w-24">Type</th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.walk.rows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${row.isMac ? 'bg-amber-500/5' : ''}`}
                      >
                        <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground break-all">{row.oid}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px]">{row.typeName}</td>
                        <td className={`px-2 py-1.5 font-mono text-[10px] break-all ${row.isMac ? 'text-amber-400 font-semibold' : ''}`}>
                          {displayValue(row)}
                        </td>
                      </tr>
                    ))}
                    {result.walk.rows.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-muted-foreground">No rows returned.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SnmpExplorer() {
  const { isSuperAdmin } = useRole();
  if (!isSuperAdmin) {
    return (
      <RoleGuard allow={['super_admin']}>
        <SnmpExplorerInner />
      </RoleGuard>
    );
  }
  return <SnmpExplorerInner />;
}
