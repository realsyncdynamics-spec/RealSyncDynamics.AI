import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Globe, Cpu,
  Loader2, Plus, RefreshCw, Trash2, XCircle, Play,
} from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { useTenant } from '../../core/access/TenantProvider';
import { WorkspaceShell } from '../workspace/WorkspaceShell';
import { getSupabase } from '../../lib/supabase';

type SourceType = 'website' | 'ai_system' | 'api' | 'vendor' | 'repository' | 'workflow' | 'document';
type SourceStatus = 'pending' | 'active' | 'paused' | 'error';
type ScanFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface MonitoringSource {
  id: string;
  tenant_id: string;
  type: SourceType;
  name: string;
  url: string | null;
  status: SourceStatus;
  last_scan_at: string | null;
  next_scan_at: string | null;
  scan_frequency: ScanFrequency;
  current_score: number | null;
  previous_score: number | null;
  last_error: string | null;
  scan_count: number;
  created_at: string;
}

const STATUS_UI: Record<SourceStatus, { label: string; cls: string; Icon: typeof Activity }> = {
  active:  { label: 'Aktiv',       cls: 'text-emerald-400 border-emerald-900', Icon: CheckCircle2 },
  pending: { label: 'Ausstehend',  cls: 'text-amber-400 border-amber-900',     Icon: Clock },
  paused:  { label: 'Pausiert',    cls: 'text-titanium-400 border-titanium-700', Icon: Clock },
  error:   { label: 'Fehler',      cls: 'text-rose-400 border-rose-900',        Icon: XCircle },
};

const TYPE_ICONS: Record<SourceType, typeof Globe> = {
  website:    Globe,
  ai_system:  Cpu,
  api:        Activity,
  vendor:     Globe,
  repository: Globe,
  workflow:   Activity,
  document:   Globe,
};

const TYPE_LABELS: Record<SourceType, string> = {
  website:    'Website',
  ai_system:  'KI-System',
  api:        'API',
  vendor:     'Vendor',
  repository: 'Repository',
  workflow:   'Workflow',
  document:   'Dokument',
};

const FREQ_LABELS: Record<ScanFrequency, string> = {
  hourly:  'Stündlich',
  daily:   'Täglich',
  weekly:  'Wöchentlich',
  monthly: 'Monatlich',
};

function scoreColor(score: number | null): string {
  if (score === null) return 'text-titanium-600';
  if (score <= 30) return 'text-rose-400';
  if (score <= 60) return 'text-amber-400';
  return 'text-emerald-400';
}

function formatShort(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function MonitoringSourcesView() {
  return (
    <AuthGate>
      {() => (
        <WorkspaceShell title="Monitoring">
          <Inner />
        </WorkspaceShell>
      )}
    </AuthGate>
  );
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [sources, setSources]   = useState<MonitoringSource[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [scanning, setScanning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAdd, setShowAdd]   = useState(false);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true); setError(null);
    try {
      const sb = getSupabase();
      const { data, error: err } = await sb
        .from('monitoring_sources')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setSources((data as MonitoringSource[]) ?? []);
    } catch (e) {
      setError((e as Error)?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  const triggerScan = async (source: MonitoringSource) => {
    setScanning(source.id);
    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/governance-monitoring-scheduler`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ source_id: source.id }),
        },
      );
      await load();
    } finally {
      setScanning(null);
    }
  };

  const deleteSource = async (id: string) => {
    setDeleting(id);
    try {
      const sb = getSupabase();
      await sb.from('monitoring_sources').delete().eq('id', id);
      setSources((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const activeCount  = sources.filter((s) => s.status === 'active').length;
  const errorCount   = sources.filter((s) => s.status === 'error').length;
  const pendingCount = sources.filter((s) => s.status === 'pending').length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-titanium-50 tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400" />
            Monitoring-Quellen
          </h2>
          <p className="text-sm text-titanium-400 mt-1">
            Kontinuierlich überwachte Websites, KI-Systeme und APIs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-titanium-400 hover:text-titanium-100 border border-titanium-800 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-cyan-400 text-obsidian-950 hover:bg-cyan-300 font-semibold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Quelle hinzufügen
          </button>
        </div>
      </div>

      {/* Kacheln */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-titanium-900">
        {[
          { label: 'Gesamt',     value: sources.length,  color: 'text-titanium-50' },
          { label: 'Aktiv',      value: activeCount,     color: 'text-emerald-400' },
          { label: 'Ausstehend', value: pendingCount,    color: 'text-amber-400' },
          { label: 'Fehler',     value: errorCount,      color: 'text-rose-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-obsidian-900 p-4">
            <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">{label}</div>
            <div className={`font-display font-bold text-2xl ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="text-sm text-rose-300 bg-rose-950/30 border border-rose-900 px-3 py-2">
          {error}
        </div>
      )}

      {/* Add-Form */}
      {showAdd && (
        <AddSourceForm
          tenantId={activeTenantId!}
          onAdded={() => { setShowAdd(false); load(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
        </div>
      ) : sources.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <div className="border border-titanium-900 divide-y divide-titanium-900">
          {sources.map((src) => {
            const { label, cls, Icon } = STATUS_UI[src.status];
            const TypeIcon = TYPE_ICONS[src.type];
            const scoreDelta = src.current_score !== null && src.previous_score !== null
              ? src.current_score - src.previous_score
              : null;
            return (
              <div key={src.id} className="flex items-start gap-3 px-4 py-4 bg-obsidian-900 hover:bg-obsidian-800 transition-colors">
                <TypeIcon className="h-4 w-4 text-titanium-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">
                      {TYPE_LABELS[src.type]}
                    </span>
                    <span className={`inline-flex items-center gap-0.5 font-mono text-[9px] border px-1 py-0.5 ${cls}`}>
                      <Icon className="h-2.5 w-2.5" /> {label}
                    </span>
                    <span className="font-mono text-[9px] text-titanium-700">
                      {FREQ_LABELS[src.scan_frequency]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-titanium-100 truncate">{src.name}</p>
                  {src.url && <p className="font-mono text-[10px] text-titanium-600 truncate">{src.url}</p>}
                  {src.last_error && (
                    <p className="text-[11px] text-rose-400 mt-0.5 flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> {src.last_error}
                    </p>
                  )}
                  <div className="flex gap-4 mt-1">
                    <span className="font-mono text-[9px] text-titanium-600">
                      Letzter Scan: {formatShort(src.last_scan_at)}
                    </span>
                    <span className="font-mono text-[9px] text-titanium-600">
                      Nächster: {formatShort(src.next_scan_at)}
                    </span>
                    <span className="font-mono text-[9px] text-titanium-700">
                      {src.scan_count} Scans
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  {src.current_score !== null && (
                    <div className="text-right">
                      <span className={`font-display font-bold text-xl tabular-nums ${scoreColor(src.current_score)}`}>
                        {src.current_score}
                      </span>
                      <span className="text-[10px] text-titanium-600 ml-0.5">/100</span>
                      {scoreDelta !== null && scoreDelta !== 0 && (
                        <span className={`font-mono text-[9px] ml-1 ${scoreDelta < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {scoreDelta > 0 ? '+' : ''}{scoreDelta}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <button
                      onClick={() => triggerScan(src)}
                      disabled={scanning === src.id}
                      title="Scan jetzt starten"
                      className="p-1 text-titanium-500 hover:text-cyan-300 border border-titanium-800 hover:border-cyan-800 transition-colors disabled:opacity-40"
                    >
                      {scanning === src.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Play className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => deleteSource(src.id)}
                      disabled={deleting === src.id}
                      title="Quelle entfernen"
                      className="p-1 text-titanium-600 hover:text-rose-400 border border-titanium-900 hover:border-rose-900 transition-colors disabled:opacity-40"
                    >
                      {deleting === src.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddSourceForm({
  tenantId, onAdded, onCancel,
}: { tenantId: string; onAdded: () => void; onCancel: () => void }) {
  const [name, setName]           = useState('');
  const [url, setUrl]             = useState('');
  const [type, setType]           = useState<SourceType>('website');
  const [frequency, setFrequency] = useState<ScanFrequency>('daily');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setErr('Name ist erforderlich.'); return; }
    setSaving(true); setErr(null);
    try {
      const sb = getSupabase();
      const { error } = await sb.from('monitoring_sources').insert({
        tenant_id:      tenantId,
        type,
        name:           name.trim(),
        url:            url.trim() || null,
        status:         'active',
        scan_frequency: frequency,
        next_scan_at:   new Date().toISOString(),
      });
      if (error) throw error;
      onAdded();
    } catch (e) {
      setErr((e as Error)?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-cyan-900 bg-obsidian-900 p-4 space-y-3">
      <p className="font-mono text-[9px] uppercase tracking-widest text-cyan-400">Neue Quelle</p>
      {err && <p className="text-xs text-rose-300">{err}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-mono text-[9px] text-titanium-600 uppercase tracking-widest block mb-1">Typ</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as SourceType)}
            className="w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 px-2 py-1.5 outline-none focus:border-cyan-700"
          >
            {(Object.entries(TYPE_LABELS) as [SourceType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono text-[9px] text-titanium-600 uppercase tracking-widest block mb-1">Scan-Frequenz</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as ScanFrequency)}
            className="w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 px-2 py-1.5 outline-none focus:border-cyan-700"
          >
            {(Object.entries(FREQ_LABELS) as [ScanFrequency, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono text-[9px] text-titanium-600 uppercase tracking-widest block mb-1">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Unternehmens-Website"
            className="w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 placeholder-titanium-700 px-2 py-1.5 outline-none focus:border-cyan-700"
          />
        </div>
        <div>
          <label className="font-mono text-[9px] text-titanium-600 uppercase tracking-widest block mb-1">URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full bg-obsidian-950 border border-titanium-800 text-sm text-titanium-100 placeholder-titanium-700 px-2 py-1.5 outline-none focus:border-cyan-700"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-semibold bg-cyan-400 text-obsidian-950 hover:bg-cyan-300 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Speichern
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-xs font-mono text-titanium-400 border border-titanium-800 hover:text-titanium-200 transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border border-titanium-900">
      <div className="h-12 w-12 bg-obsidian-800 flex items-center justify-center mb-4">
        <Activity className="h-5 w-5 text-titanium-600" />
      </div>
      <p className="text-titanium-300 font-semibold">Noch keine Monitoring-Quellen</p>
      <p className="text-sm text-titanium-600 mt-1 max-w-xs">
        Fügen Sie Websites, KI-Systeme oder APIs hinzu, damit das Governance OS sie
        kontinuierlich überwacht.
      </p>
      <button
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 border border-cyan-900 px-3 py-1.5 hover:bg-cyan-950/40 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Erste Quelle hinzufügen
      </button>
    </div>
  );
}
