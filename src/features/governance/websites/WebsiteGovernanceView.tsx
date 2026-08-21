// WebsiteGovernanceView — Governance OS · /app/websites
// Zeigt registrierte Domains + letzte Scan-Ergebnisse; triggert Audits.
// Kein Demo-Fallback: ohne Login leer, nach Login nur Mandanten-Daten.
import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe, Plus, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, XCircle, Search, Shield, Activity, LogIn,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  listWebsitesForTenant, listScanRuns, triggerTenantAudit, addWebsiteForTenant,
  type TenantWebsite,
} from '../scans/scansApi';
import type { ScanRun } from '../../../types/governance/scan-run';
import type { FindingSeverity } from '../../../types/governance/finding';
import { withPerformanceMonitoring } from '../withPerformanceMonitoring';
import { getSupabase } from '../../../lib/supabase';

interface WebsiteRow {
  id: string;
  domain: string;
  status: string;
  planTier: string;
  lastScan: ScanRun | null;
  createdAt: string;
}

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

function rowFromSite(w: TenantWebsite, scan: ScanRun | null): WebsiteRow {
  return {
    id: w.id,
    domain: w.domain,
    status: w.status,
    planTier: w.plan_tier,
    lastScan: scan,
    createdAt: w.created_at,
  };
}

async function domainHintFromSession(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    const m = (data.session?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const raw = String(m.website ?? m.domain ?? m.company_website ?? m.companyDomain ?? '').trim();
    if (!raw) return null;
    return raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase() || null;
  } catch {
    return null;
  }
}

function WebsiteCard({ row, onScan, scanning }: {
  row: WebsiteRow;
  onScan: (row: WebsiteRow) => void;
  scanning: boolean;
}) {
  const scan = row.lastScan;
  return (
    <div className="bg-obsidian-900 border border-titanium-900 hover:border-titanium-700 transition-colors">
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

function AddDomainModal({
  onAdd, onClose, initial,
}: {
  onAdd: (domain: string) => void;
  onClose: () => void;
  initial?: string;
}) {
  const [value, setValue] = useState(initial ?? '');
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
          placeholder="z.B. www.mein-unternehmen.de"
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

function _WebsiteGovernanceView() {
  const { activeTenantId, tenants, loading: tenantLoading } = useTenant();
  const company = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;

  const [rows, setRows] = useState<WebsiteRow[]>([]);
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSites, setLoadingSites] = useState(false);
  const [domainHint, setDomainHint] = useState<string | null>(null);

  useEffect(() => {
    if (tenantLoading) return;
    if (!activeTenantId) {
      setRows([]);
      setLoadingSites(false);
      return;
    }

    let cancelled = false;
    setLoadingSites(true);
    setError(null);

    Promise.all([
      listWebsitesForTenant(activeTenantId),
      listScanRuns(activeTenantId, { limit: 200 }),
      domainHintFromSession(),
    ]).then(async ([sites, scans, hint]) => {
      if (cancelled) return;
      setDomainHint(hint);

      const latestBySite = new Map<string, ScanRun>();
      for (const s of scans) {
        if (s.website_id && !latestBySite.has(s.website_id)) {
          latestBySite.set(s.website_id, s);
        }
      }

      let nextSites = sites;
      if (sites.length === 0 && hint) {
        try {
          const created = await addWebsiteForTenant(activeTenantId, hint);
          nextSites = [created];
        } catch {
          /* RLS oder Duplikat — Hint bleibt als Vorschlag im Empty-State */
        }
      }

      if (cancelled) return;
      setRows(nextSites.map((w) => rowFromSite(w, latestBySite.get(w.id) ?? null)));
    }).catch((e) => {
      if (cancelled) return;
      setRows([]);
      setError(e instanceof Error ? e.message : 'Domains konnten nicht geladen werden.');
    }).finally(() => {
      if (!cancelled) setLoadingSites(false);
    });

    return () => { cancelled = true; };
  }, [activeTenantId, tenantLoading]);

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
      setError('Bitte einloggen, um eine Domain zu hinterlegen.');
      return;
    }
    try {
      const w = await addWebsiteForTenant(activeTenantId, domain);
      setRows((prev) => [rowFromSite(w, null), ...prev.filter((r) => r.domain !== w.domain)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Domain konnte nicht hinzugefügt werden.');
    }
  }

  const signedOut = !tenantLoading && !activeTenantId;
  const empty = !loadingSites && !signedOut && rows.length === 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-700 to-blue-800 flex items-center justify-center shrink-0">
            <Globe className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Websites</div>
            <div className="text-[11px] text-titanium-400 font-mono truncate">
              {company
                ? `${company} · ${counts.total} Domain${counts.total === 1 ? '' : 's'}`
                : 'Governance OS · DSGVO-Scanner'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddOpen(true)}
            disabled={signedOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-titanium-800 text-titanium-400 hover:border-teal-700 hover:text-teal-400 transition-colors disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Domain hinzufügen
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Gesamt Domains', value: counts.total,    color: 'text-titanium-100' },
            { label: 'Kritische Findings', value: counts.critical, color: 'text-red-400' },
            { label: 'Bestanden',       value: counts.clean,   color: 'text-teal-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-obsidian-900 border border-titanium-900 p-4">
              <div className="text-[9px] font-mono uppercase tracking-widest text-titanium-700 mb-1">{label}</div>
              <div className={`text-2xl font-mono font-bold ${color}`}>{loadingSites ? '–' : value}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-950/40 border border-red-900 px-4 py-2 text-xs font-mono text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-400">✕</button>
          </div>
        )}

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

        {signedOut ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <LogIn className="h-8 w-8 mb-3 text-titanium-700" />
            <p className="font-mono text-sm text-titanium-300">Anmelden, um Ihre Domains zu sehen.</p>
            <p className="mt-2 max-w-md text-xs text-titanium-600">
              Nach dem Login erscheinen hier das Unternehmen Ihres Mandanten und die registrierten Domains — keine Beispieldaten.
            </p>
            <a
              href="/welcome"
              className="mt-5 px-4 py-2 text-xs font-mono border border-teal-700 text-teal-400 hover:bg-teal-950/40"
            >
              Anmelden
            </a>
          </div>
        ) : loadingSites || tenantLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-titanium-600 font-mono text-sm">
            Domains werden geladen…
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="h-8 w-8 mb-3 text-titanium-700" />
            {company && (
              <p className="font-display text-lg text-titanium-50 mb-1">{company}</p>
            )}
            <p className="font-mono text-sm text-titanium-400">Noch keine Domain hinterlegt.</p>
            {domainHint && (
              <p className="mt-2 font-mono text-xs text-teal-400">Vorschlag aus dem Konto: {domainHint}</p>
            )}
            <button
              onClick={() => setAddOpen(true)}
              className="mt-5 flex items-center gap-1.5 px-4 py-2 text-xs font-mono bg-teal-600 text-white hover:bg-teal-500"
            >
              <Plus className="h-3.5 w-3.5" />
              {domainHint ? `${domainHint} übernehmen` : 'Erste Domain hinzufügen'}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-titanium-600 font-mono text-sm">
            <Globe className="h-8 w-8 mb-3 opacity-30" />
            Keine Domains gefunden.
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

      {addOpen && (
        <AddDomainModal
          onAdd={handleAdd}
          onClose={() => setAddOpen(false)}
          initial={domainHint ?? undefined}
        />
      )}
    </div>
  );
}

export const WebsiteGovernanceView = withPerformanceMonitoring(
  _WebsiteGovernanceView,
  'WebsiteGovernanceView',
  { threshold: 500, maxRenders: 10 }
);
