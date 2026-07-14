// WebsiteGovernanceView — Governance OS · /app/websites
// Zeigt registrierte Domains + letzte Scan-Ergebnisse; triggert Audits.
import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe, Plus, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, XCircle, Search, Shield, Activity,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  listWebsitesForTenant, listScanRuns, triggerTenantAudit,
  type TenantWebsite,
} from '../scans/scansApi';
import type { ScanRun } from '../../../types/governance/scan-run';
import type { FindingSeverity } from '../../../types/governance/finding';

// ─── Typen ──────────────────────────────────────────────────────────────────
interface WebsiteRow {
  id: string;
  domain: string;
  status: string;
  planTier: string;
  lastScan: ScanRun | null;
  createdAt: string;
}

// ─── Mock-Fallback ───────────────────────────────────────────────────────────
const MOCK_ROWS: WebsiteRow[] = [
  {
    id: 'm1', domain: 'app.atelier-nord.de', status: 'active', planTier: 'audit',
    lastScan: {
      id: 's1', tenant_id: '', website_id: 'm1', detector: 'gdpr-full',
      status: 'completed', finding_count: 7, severity_max: 'critical',
      started_at: '2026-06-16T09:00:00Z', completed_at: '2026-06-16T09:04:11Z',
      duration_ms: 251000, error_code: null, error_message: null,
      raw_payload: null, correlation_id: null,
      created_at: '2026-06-16T09:00:00Z', updated_at: '2026-06-16T09:04:11Z',
    },
    createdAt: '2026-04-01',
  },
  {
    id: 'm2', domain: 'www.atelier-nord.de', status: 'active', planTier: 'audit',
    lastScan: {
      id: 's2', tenant_id: '', website_id: 'm2', detector: 'gdpr-full',
      status: 'completed', finding_count: 2, severity_max: 'medium',
      started_at: '2026-06-15T14:00:00Z', completed_at: '2026-06-15T14:03:22Z',
      duration_ms: 202000, error_code: null, error_message: null,
      raw_payload: null, correlation_id: null,
      created_at: '2026-06-15T14:00:00Z', updated_at: '2026-06-15T14:03:22Z',
    },
    createdAt: '2026-04-01',
  },
  {
    id: 'm3', domain: 'shop.atelier-nord.de', status: 'active', planTier: 'rebuild',
    lastScan: {
      id: 's3', tenant_id: '', website_id: 'm3', detector: 'gdpr-full',
      status: 'completed', finding_count: 0, severity_max: null,
      started_at: '2026-06-14T10:00:00Z', completed_at: '2026-06-14T10:02:44Z',
      duration_ms: 164000, error_code: null, error_message: null,
      raw_payload: null, correlation_id: null,
      created_at: '2026-06-14T10:00:00Z', updated_at: '2026-06-14T10:02:44Z',
    },
    createdAt: '2026-05-10',
  },
];

// ─── Severity ────────────────────────────────────────────────────────────────
const SEV_CFG: Record<FindingSeverity, { label: string; cls: string; dot: string }> = {
  critical: { label: 'Kritisch', cls: 'text-red-400 bg-red-950/40 border-red-900',    dot: 'bg-red-500' },
  high:     { label: 'Hoch',     cls: 'text-orange-400 bg-orange-950/40 border-orange-900', dot: 'bg-orange-500' },
  medium:   { label: 'Mittel',   cls: 'text-amber-400 bg-amber-950/40 border-amber-900',   dot: 'bg-amber-500' },
  low:      { label: 'Niedrig',  cls: 'text-teal-400 bg-teal-950/40 border-teal-900',      dot: 'bg-teal-500' },
  info:     { label: 'Info',     cls: 'text-blue-400 bg-blue-950/40 border-blue-900',       dot: 'bg-blue-500' },
};

function SeverityBadge({ sev }: { sev: FindingSeverity | null }) {
  if (!sev) {
    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-mono text-teal-400 bg-teal-950/20 border-teal-900">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Bestanden
      </span>
    );
  }
  const cfg = SEV_CFG[sev];
  return (
    <span className={`flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-mono ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ScanStatusIcon({ status }: { status: ScanRun['status'] }) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-teal-400" />;
  if (status === 'running')   return <Activity className="h-4 w-4 text-blue-400 animate-pulse" />;
  if (status === 'failed')    return <XCircle className="h-4 w-4 text-red-400" />;
  return <Clock className="h-4 w-4 text-titanium-500" />;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '–';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffMin < 1440) return `vor ${Math.floor(diffMin / 60)} Std.`;
  return `vor ${Math.floor(diffMin / 1440)} Tag${Math.floor(diffMin / 1440) !== 1 ? 'en' : ''}`;
}

// ─── WebsiteCard ─────────────────────────────────────────────────────────────
function WebsiteCard({ row, onScan, scanning }: {
  row: WebsiteRow;
  onScan: (row: WebsiteRow) => void;
  scanning: boolean;
}) {
  const scan = row.lastScan;
  return (
    <div className="bg-obsidian-900 border border-titanium-900 hover:border-titanium-700 transition-colors">
      {/* Top */}
      <div className="p-4 border-b border-titanium-900">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-obsidian-800 border border-titanium-800 flex items-center justify-center shrink-0">
              <Globe className="h-3.5 w-3.5 text-titanium-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-mono font-semibold text-titanium-50 truncate">{row.domain}</div>
              <div className="text-[10px] font-mono text-titanium-600 uppercase tracking-wider mt-0.5">
                {row.planTier === 'audit' ? 'Audit' : row.planTier === 'rebuild' ? 'Rebuild' : 'Managed'}
              </div>
            </div>
          </div>
          <SeverityBadge sev={scan?.severity_max ?? null} />
        </div>
      </div>

      {/* Scan Info */}
      <div className="px-4 py-3 grid grid-cols-3 gap-3 border-b border-titanium-900">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-titanium-700 mb-0.5">Findings</div>
          <div className={`text-lg font-mono font-bold ${scan && scan.finding_count > 0 ? 'text-red-400' : 'text-teal-400'}`}>
            {scan?.finding_count ?? '–'}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-titanium-700 mb-0.5">Letzter Scan</div>
          <div className="text-xs font-mono text-titanium-300">{relativeTime(scan?.completed_at ?? null)}</div>
        </div>
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-titanium-700 mb-0.5">Status</div>
          <div className="flex items-center gap-1">
            {scan ? <ScanStatusIcon status={scan.status} /> : <Clock className="h-4 w-4 text-titanium-700" />}
            <span className="text-[10px] font-mono text-titanium-400 capitalize">
              {scan?.status ?? 'nie gescannt'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <span className="font-mono text-[10px] text-titanium-700">
          Hinzugefügt {new Date(row.createdAt).toLocaleDateString('de-DE')}
        </span>
        <button
          onClick={() => onScan(row)}
          disabled={scanning}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono border border-titanium-800 text-titanium-400 hover:border-teal-700 hover:text-teal-400 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-2.5 w-2.5 ${scanning ? 'animate-spin' : ''}`} />
          Scannen
        </button>
      </div>
    </div>
  );
}

// ─── AddDomainModal ───────────────────────────────────────────────────────────
function AddDomainModal({ onAdd, onClose }: { onAdd: (domain: string) => void; onClose: () => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80">
      <div className="bg-obsidian-900 border border-titanium-800 w-full max-w-sm p-6 space-y-4">
        <h3 className="font-display font-bold text-sm text-titanium-50">Domain hinzufügen</h3>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { onAdd(value.trim()); } }}
          placeholder="z.B. www.example.de"
          className="w-full bg-obsidian-950 border border-titanium-800 px-3 py-2 text-sm font-mono text-titanium-100 placeholder-titanium-700 outline-none focus:border-teal-600"
        />
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-mono text-titanium-500 border border-titanium-800 hover:text-titanium-300">
            Abbrechen
          </button>
          <button
            onClick={() => value.trim() && onAdd(value.trim())}
            className="px-3 py-1.5 text-xs font-mono bg-teal-600 text-white hover:bg-teal-500"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Haupt-View ──────────────────────────────────────────────────────────────
export function WebsiteGovernanceView() {
  const { activeTenantId } = useTenant();
  const [rows, setRows]       = useState<WebsiteRow[]>(MOCK_ROWS);
  const [search, setSearch]   = useState('');
  const [scanning, setScanning] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    Promise.all([
      listWebsitesForTenant(activeTenantId),
      listScanRuns(activeTenantId, { limit: 200 }),
    ]).then(([sites, scans]) => {
      if (sites.length === 0) return;
      const latestBySite = new Map<string, ScanRun>();
      for (const s of scans) {
        if (s.website_id && !latestBySite.has(s.website_id)) {
          latestBySite.set(s.website_id, s);
        }
      }
      setRows(sites.map((w: TenantWebsite): WebsiteRow => ({
        id: w.id,
        domain: w.domain,
        status: w.status,
        planTier: w.plan_tier,
        lastScan: latestBySite.get(w.id) ?? null,
        createdAt: w.created_at,
      })));
    }).catch(() => {/* keep mock */});
  }, [activeTenantId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.domain.toLowerCase().includes(q));
  }, [rows, search]);

  const counts = useMemo(() => ({
    total: rows.length,
    critical: rows.filter((r) => r.lastScan?.severity_max === 'critical').length,
    clean:    rows.filter((r) => r.lastScan?.finding_count === 0).length,
  }), [rows]);

  async function handleScan(row: WebsiteRow) {
    if (!activeTenantId) { setError('Bitte einloggen.'); return; }
    setScanning(row.id);
    setError(null);
    try {
      await triggerTenantAudit(activeTenantId, row.domain, { website_id: row.id });
      // Reload scans after trigger
      const scans = await listScanRuns(activeTenantId, { limit: 200 });
      setRows((prev) => prev.map((r) => {
        if (r.id !== row.id) return r;
        const latest = scans.find((s) => s.website_id === row.id) ?? null;
        return { ...r, lastScan: latest };
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan fehlgeschlagen.');
    } finally {
      setScanning(null);
    }
  }

  async function handleAdd(domain: string) {
    setAddOpen(false);
    if (!activeTenantId) {
      setRows((prev) => [
        { id: `m${Date.now()}`, domain, status: 'active', planTier: 'audit', lastScan: null, createdAt: new Date().toISOString() },
        ...prev,
      ]);
      return;
    }
    try {
      const { addWebsiteForTenant } = await import('../scans/scansApi');
      const w = await addWebsiteForTenant(activeTenantId, domain);
      setRows((prev) => [
        { id: w.id, domain: w.domain, status: w.status, planTier: w.plan_tier, lastScan: null, createdAt: w.created_at },
        ...prev,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Domain konnte nicht hinzugefügt werden.');
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {/* Header */}
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-700 to-blue-800 flex items-center justify-center shrink-0">
            <Globe className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Websites</div>
            <div className="text-[11px] text-titanium-400 font-mono">
              Governance OS · DSGVO-Scanner · {counts.total} Domains
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-titanium-800 text-titanium-400 hover:border-teal-700 hover:text-teal-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Domain hinzufügen
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Gesamt Domains', value: counts.total,    color: 'text-titanium-100' },
            { label: 'Kritische Findings', value: counts.critical, color: 'text-red-400' },
            { label: 'Bestanden',       value: counts.clean,   color: 'text-teal-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-obsidian-900 border border-titanium-900 p-4">
              <div className="text-[9px] font-mono uppercase tracking-widest text-titanium-700 mb-1">{label}</div>
              <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 bg-red-950/40 border border-red-900 px-4 py-2 text-xs font-mono text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-400">✕</button>
          </div>
        )}

        {/* Search + Filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 border border-titanium-800 bg-obsidian-900 px-2 py-1.5 flex-1 max-w-xs">
            <Search className="h-3 w-3 text-titanium-600 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Domain suchen…"
              className="bg-transparent text-[12px] font-mono text-titanium-200 placeholder-titanium-700 outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-1.5 border border-titanium-900 px-3 py-1.5 bg-obsidian-900 text-[11px] font-mono text-titanium-500">
            <Shield className="h-3 w-3" />
            DSGVO · TDDDG · Cookie
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-titanium-600 font-mono text-sm">
            <Globe className="h-8 w-8 mb-3 opacity-30" />
            Keine Domains gefunden. Domain hinzufügen, um mit Scans zu beginnen.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((row) => (
              <WebsiteCard
                key={row.id}
                row={row}
                onScan={handleScan}
                scanning={scanning === row.id}
              />
            ))}
          </div>
        )}
      </main>

      {addOpen && <AddDomainModal onAdd={handleAdd} onClose={() => setAddOpen(false)} />}
    </div>
  );
}
