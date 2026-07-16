import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck2, Download, Filter, Loader2, Shield, ShieldCheck,
  ShieldX, Hash, Image, FileText, RefreshCw, ExternalLink,
} from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { useActivePlan } from '../../hooks/useModuleAccess';
import { hasFeature, type PlanKey } from '../../lib/billing/planAccess';
import { WorkspaceShell } from '../workspace/WorkspaceShell';
import { getSupabase } from '../../lib/supabase';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

type EvidenceType =
  | 'screenshot' | 'har' | 'json' | 'log' | 'pdf'
  | 'hash' | 'policy_snapshot' | 'approval' | 'pull_request';

interface EvidenceRecord {
  id: string;
  tenant_id: string;
  event_id: string | null;
  asset_id: string | null;
  evidence_type: EvidenceType;
  title: string;
  storage_path: string | null;
  content_hash: string | null;
  previous_hash: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const TYPE_LABELS: Record<EvidenceType, string> = {
  screenshot:      'Screenshot',
  har:             'HAR',
  json:            'JSON',
  log:             'Log',
  pdf:             'PDF',
  hash:            'Hash',
  policy_snapshot: 'Policy-Snapshot',
  approval:        'Freigabe',
  pull_request:    'Pull Request',
};

const TYPE_ICONS: Record<EvidenceType, typeof Hash> = {
  screenshot:      Image,
  har:             FileText,
  json:            FileText,
  log:             FileText,
  pdf:             FileText,
  hash:            Hash,
  policy_snapshot: Shield,
  approval:        ShieldCheck,
  pull_request:    ExternalLink,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function shortHash(hash: string | null): string {
  if (!hash) return '—';
  return hash.slice(0, 8) + '…' + hash.slice(-4);
}

function _EvidenceVaultView() {
  return (
    <AuthGate>
      {() => (
        <WorkspaceShell title="Evidence Vault">
          <Inner />
        </WorkspaceShell>
      )}
    </AuthGate>
  );
}

export const EvidenceVaultView = withPerformanceMonitoring(
  _EvidenceVaultView,
  'EvidenceVaultView',
  { threshold: 2000, maxRenders: 8 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const { plan } = useActivePlan();
  // Trail ist read-only ab Free sichtbar; der Export ist die Kaufbegründung
  // des ersten zahlenden Tiers (siehe docs/PRODUCT_PRIORITIZATION.md).
  const canExport = hasFeature(plan as PlanKey, 'evidence_export');
  const [records, setRecords]     = useState<EvidenceRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [filterType, setFilterType] = useState<EvidenceType | 'all'>('all');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true); setError(null);
    try {
      const sb = getSupabase();
      let q = sb
        .from('governance_evidence')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (filterType !== 'all') q = q.eq('evidence_type', filterType);
      const { data, error: err } = await q;
      if (err) throw err;
      setRecords((data as EvidenceRecord[]) ?? []);
    } catch (e) {
      setError((e as Error)?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, filterType]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    if (!activeTenantId) return;
    if (!canExport) { setExportMsg('Fehler: Export ist ab dem Starter-Tarif verfügbar.'); return; }
    setExporting(true); setExportMsg(null);
    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evidence-vault-export`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'x-rsd-tenant-key': activeTenantId,
          },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) throw new Error(`Export HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evidence-bundle-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg('Export erfolgreich.');
    } catch (e) {
      setExportMsg(`Fehler: ${(e as Error)?.message ?? String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  const byType = (records: EvidenceRecord[]) => {
    const counts: Partial<Record<EvidenceType, number>> = {};
    for (const r of records) {
      counts[r.evidence_type] = (counts[r.evidence_type] ?? 0) + 1;
    }
    return counts;
  };
  const typeCounts = byType(records);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-titanium-50 tracking-tight flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-cyan-400" />
            Evidence Vault
          </h2>
          <p className="text-sm text-titanium-400 mt-1">
            Lückenloser Nachweis-Trail · Hash-Chain · Audit-Export
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-titanium-400 hover:text-titanium-100 border border-titanium-800 hover:border-titanium-600 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Laden
          </button>
          {canExport ? (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-cyan-400 text-obsidian-950 hover:bg-cyan-300 transition-colors font-semibold disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? 'Exportiert…' : 'Bundle exportieren'}
            </button>
          ) : (
            <Link
              to="/app/billing"
              title="Audit-Export ist ab dem Starter-Tarif verfügbar"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-cyan-800 text-cyan-300 hover:bg-cyan-950/40 transition-colors font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              Export ab Starter
            </Link>
          )}
        </div>
      </div>

      {exportMsg && (
        <div className={`text-xs font-mono px-3 py-2 border ${exportMsg.startsWith('Fehler') ? 'border-rose-800 text-rose-300 bg-rose-950/30' : 'border-emerald-800 text-emerald-300 bg-emerald-950/30'}`}>
          {exportMsg}
        </div>
      )}

      {!canExport && (
        <div className="flex flex-wrap items-center gap-2 text-xs px-3 py-2 border border-cyan-900 bg-cyan-950/20 text-cyan-200">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span>
            Der Prüfpfad ist hier einsehbar. Der revisionssichere{' '}
            <strong className="text-cyan-100">Audit-Export</strong> (gerichtsfestes Bundle mit
            Hash-Chain) ist ab dem Starter-Tarif verfügbar.
          </span>
          <Link to="/app/billing" className="underline text-cyan-300 hover:text-cyan-200">
            Tarif ansehen →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-titanium-900">
        <div className="bg-obsidian-900 p-4">
          <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">Gesamt</div>
          <div className="font-display font-bold text-2xl text-titanium-50">{records.length}</div>
        </div>
        <div className="bg-obsidian-900 p-4">
          <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">Mit Hash</div>
          <div className="font-display font-bold text-2xl text-cyan-400">
            {records.filter((r) => r.content_hash).length}
          </div>
        </div>
        <div className="bg-obsidian-900 p-4">
          <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">Typen</div>
          <div className="font-display font-bold text-2xl text-titanium-50">
            {Object.keys(typeCounts).length}
          </div>
        </div>
        <div className="bg-obsidian-900 p-4">
          <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">Chain-Einträge</div>
          <div className="font-display font-bold text-2xl text-emerald-400">
            {records.filter((r) => r.previous_hash).length}
          </div>
        </div>
      </div>

      {/* Typ-Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-3.5 w-3.5 text-titanium-600" />
        <button
          onClick={() => setFilterType('all')}
          className={`px-2 py-0.5 text-xs font-mono transition-colors ${filterType === 'all' ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-800' : 'text-titanium-500 border border-titanium-800 hover:text-titanium-200'}`}
        >
          Alle ({records.length})
        </button>
        {(Object.entries(typeCounts) as [EvidenceType, number][]).map(([type, count]) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-2 py-0.5 text-xs font-mono transition-colors ${filterType === type ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-800' : 'text-titanium-500 border border-titanium-800 hover:text-titanium-200'}`}
          >
            {TYPE_LABELS[type]} ({count})
          </button>
        ))}
      </div>

      {/* Link zum Auditor-Modus */}
      <div className="flex items-center gap-2 text-xs text-titanium-600 border border-titanium-900 bg-obsidian-900 px-3 py-2">
        <ShieldCheck className="h-3.5 w-3.5 text-titanium-500 shrink-0" />
        <span>Für Auditoren:</span>
        <Link to="/app/evidence/audit" className="text-cyan-400 hover:text-cyan-300 underline">
          Auditor Console öffnen
        </Link>
        <span className="text-titanium-700">— Hash-Chain-Verify, RACPO, DSR-Export (AAL2)</span>
      </div>

      {/* Fehler */}
      {error && (
        <div className="text-sm text-rose-300 bg-rose-950/30 border border-rose-900 px-3 py-2">
          {error}
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="border border-titanium-900 divide-y divide-titanium-900">
          {records.map((r) => (
            <EvidenceRow key={r.id} record={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceRow({ record: r }: { record: EvidenceRecord }) {
  const Icon = TYPE_ICONS[r.evidence_type] ?? FileText;
  const hasChain = !!r.previous_hash;

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-obsidian-900 hover:bg-obsidian-800 transition-colors">
      <div className="mt-0.5 shrink-0">
        <Icon className="h-4 w-4 text-titanium-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 border border-titanium-800 px-1 py-0.5">
            {TYPE_LABELS[r.evidence_type]}
          </span>
          {hasChain && (
            <span className="font-mono text-[9px] text-emerald-400 flex items-center gap-0.5">
              <ShieldCheck className="h-2.5 w-2.5" /> Chain
            </span>
          )}
        </div>
        <p className="text-sm text-titanium-100 font-medium truncate">{r.title}</p>
        {r.content_hash && (
          <p className="font-mono text-[10px] text-titanium-600 mt-0.5 flex items-center gap-1">
            <Hash className="h-2.5 w-2.5" />
            {shortHash(r.content_hash)}
            {r.previous_hash && (
              <span className="text-titanium-700 ml-1">← {shortHash(r.previous_hash)}</span>
            )}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-[10px] text-titanium-600">
          {formatDate(r.created_at)}
        </p>
        {r.storage_path && (
          <span className="font-mono text-[9px] text-cyan-500 mt-0.5 block">↗ Datei</span>
        )}
        {!r.content_hash && (
          <span className="flex items-center gap-0.5 font-mono text-[9px] text-titanium-700 mt-0.5">
            <ShieldX className="h-2.5 w-2.5" /> Kein Hash
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border border-titanium-900">
      <div className="h-12 w-12 bg-obsidian-800 flex items-center justify-center mb-4">
        <FileCheck2 className="h-5 w-5 text-titanium-600" />
      </div>
      <p className="text-titanium-300 font-semibold">Noch keine Evidence</p>
      <p className="text-sm text-titanium-600 mt-1 max-w-xs">
        Evidence-Einträge werden automatisch erzeugt, sobald Scans abgeschlossen,
        Policies genehmigt oder Dokumente hochgeladen werden.
      </p>
      <Link
        to="/app/scans"
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 border border-cyan-900 px-3 py-1.5 hover:bg-cyan-950/40 transition-colors"
      >
        Ersten Scan starten →
      </Link>
    </div>
  );
}
