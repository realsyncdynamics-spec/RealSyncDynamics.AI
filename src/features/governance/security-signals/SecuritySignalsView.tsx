import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert, CheckCircle2, Loader2, RefreshCw,
  Search, X, FileJson, ClipboardCheck, Link2, Server,
} from 'lucide-react';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { WorkspaceShell } from '../../workspace/WorkspaceShell';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  fetchSecuritySignals, fetchRiskLinks, updateSignalStatus,
  type SecuritySignalRow, type RiskLinkRow, type SignalSeverity, type SignalStatus,
} from './securitySignalsApi';

const SEVERITY_ORDER: Record<SignalSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

const SEVERITY_UI: Record<SignalSeverity, { label: string; cls: string }> = {
  critical: { label: 'Kritisch', cls: 'text-rose-400 border-rose-900 bg-rose-950/30' },
  high:     { label: 'Hoch',     cls: 'text-orange-400 border-orange-900 bg-orange-950/30' },
  medium:   { label: 'Mittel',   cls: 'text-amber-400 border-amber-900 bg-amber-950/20' },
  low:      { label: 'Niedrig',  cls: 'text-teal-400 border-teal-900 bg-teal-950/20' },
  info:     { label: 'Info',     cls: 'text-titanium-400 border-titanium-700' },
};

const STATUS_UI: Record<SignalStatus, { label: string; cls: string }> = {
  open:           { label: 'Offen',          cls: 'text-amber-400 border-amber-900' },
  acknowledged:   { label: 'Bestätigt',      cls: 'text-cyan-400 border-cyan-900' },
  in_review:      { label: 'In Prüfung',     cls: 'text-cyan-300 border-cyan-800' },
  accepted:       { label: 'Akzeptiert',     cls: 'text-emerald-400 border-emerald-900' },
  resolved:       { label: 'Erledigt',       cls: 'text-emerald-400 border-emerald-900' },
  false_positive: { label: 'False Positive', cls: 'text-titanium-400 border-titanium-700' },
};

interface GovernanceMappingShape {
  riskLevel?: string;
  frameworks?: string[];
  controls?: Array<{ framework: string; controlRef: string; reason: string }>;
  recommendedTasks?: Array<{ type: string; title: string; priority: string }>;
  evidenceItems?: Array<{ type: string; title: string; description: string }>;
}

function formatShort(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function SecuritySignalsView() {
  return (
    <AuthGate>
      {() => (
        <WorkspaceShell title="Security Signals">
          <Inner />
        </WorkspaceShell>
      )}
    </AuthGate>
  );
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [signals, setSignals] = useState<SecuritySignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SecuritySignalRow | null>(null);

  const [severityFilter, setSeverityFilter] = useState<'all' | SignalSeverity>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SignalStatus>('all');
  const [providerFilter, setProviderFilter] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true); setError(null);
    try {
      setSignals(await fetchSecuritySignals(activeTenantId));
    } catch (e) {
      setError((e as Error)?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => { load(); }, [load]);

  const providers = useMemo(
    () => Array.from(new Set(signals.map((s) => s.provider))).sort(),
    [signals],
  );

  const filtered = useMemo(() => {
    let list = [...signals];
    if (severityFilter !== 'all') list = list.filter((s) => s.severity === severityFilter);
    if (statusFilter !== 'all') list = list.filter((s) => s.status === statusFilter);
    if (providerFilter !== 'all') list = list.filter((s) => s.provider === providerFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q) ||
        (s.asset_ref ?? '').toLowerCase().includes(q) ||
        s.external_id.toLowerCase().includes(q));
    }
    return list.sort((a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (b.created_at).localeCompare(a.created_at));
  }, [signals, severityFilter, statusFilter, providerFilter, search]);

  const counts = useMemo(() => ({
    total: signals.length,
    critical: signals.filter((s) => s.severity === 'critical').length,
    high: signals.filter((s) => s.severity === 'high').length,
    open: signals.filter((s) => s.status === 'open').length,
  }), [signals]);

  const onStatusChange = (id: string, status: SignalStatus) => {
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    setDetail((d) => (d && d.id === id ? { ...d, status } : d));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-titanium-50 tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            Security Signals
          </h2>
          <p className="text-sm text-titanium-400 mt-1">
            Externe Findings (blacklens, Cloudflare, GitHub, SIEM) als Governance-Objekte:
            Finding → Risk → Control → Task → Evidence.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-titanium-400 hover:text-titanium-100 border border-titanium-800 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {/* Kacheln */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-titanium-900">
        {[
          { label: 'Gesamt',   value: counts.total,    color: 'text-titanium-50' },
          { label: 'Kritisch', value: counts.critical, color: 'text-rose-400' },
          { label: 'Hoch',     value: counts.high,     color: 'text-orange-400' },
          { label: 'Offen',    value: counts.open,     color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-obsidian-900 p-4">
            <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">{label}</div>
            <div className={`font-display font-bold text-2xl ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="text-sm text-rose-300 bg-rose-950/30 border border-rose-900 px-3 py-2">{error}</div>
      )}

      {/* Filter */}
      <div className="border border-titanium-900 bg-obsidian-900 p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 border border-titanium-800 px-2 py-1.5 flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 text-titanium-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Titel, Asset, ID …"
            className="bg-transparent text-[12px] font-mono text-titanium-200 placeholder-titanium-700 outline-none w-full"
          />
        </div>
        <FilterSelect
          value={severityFilter}
          onChange={(v) => setSeverityFilter(v as 'all' | SignalSeverity)}
          options={[['all', 'Alle Severities'], ...Object.entries(SEVERITY_UI).map(([k, v]) => [k, v.label] as [string, string])]}
        />
        <FilterSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as 'all' | SignalStatus)}
          options={[['all', 'Alle Status'], ...Object.entries(STATUS_UI).map(([k, v]) => [k, v.label] as [string, string])]}
        />
        <FilterSelect
          value={providerFilter}
          onChange={(v) => setProviderFilter(v)}
          options={[['all', 'Alle Provider'], ...providers.map((p) => [p, p] as [string, string])]}
        />
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasAny={signals.length > 0} />
      ) : (
        <div className="border border-titanium-900 divide-y divide-titanium-900">
          {filtered.map((s) => {
            const sev = SEVERITY_UI[s.severity];
            const st = STATUS_UI[s.status];
            return (
              <button
                key={s.id}
                onClick={() => setDetail(s)}
                className="w-full text-left flex items-start gap-3 px-4 py-3 bg-obsidian-900 hover:bg-obsidian-800 transition-colors"
              >
                <span className={`shrink-0 mt-0.5 inline-flex items-center font-mono text-[9px] uppercase tracking-wide border px-1.5 py-0.5 ${sev.cls}`}>
                  {sev.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">{s.provider}</span>
                    <span className={`inline-flex items-center font-mono text-[9px] border px-1 py-0.5 ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-sm font-medium text-titanium-100 truncate">{s.title}</p>
                  {s.asset_ref && <p className="font-mono text-[10px] text-titanium-600 truncate">{s.asset_ref}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-mono text-[9px] text-titanium-600 block">{formatShort(s.last_seen_at ?? s.created_at)}</span>
                  <span className="font-mono text-[9px] text-titanium-700">{s.external_id}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {detail && (
        <DetailDrawer
          signal={detail}
          onClose={() => setDetail(null)}
          onStatusChange={onStatusChange}
        />
      )}
    </div>
  );
}

function FilterSelect({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-obsidian-950 border border-titanium-800 text-[12px] font-mono text-titanium-200 px-2 py-1.5 outline-none focus:border-rose-800"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border border-titanium-900">
      <div className="h-12 w-12 bg-obsidian-800 flex items-center justify-center mb-4">
        <ShieldAlert className="h-5 w-5 text-titanium-600" />
      </div>
      <p className="text-titanium-300 font-semibold">
        {hasAny ? 'Keine Signale für diesen Filter' : 'Noch keine Security Signals'}
      </p>
      <p className="text-sm text-titanium-600 mt-1 max-w-md">
        Externe Tools senden Findings an die Ingest-API
        (<span className="font-mono text-[11px]">POST /functions/v1/security-signal-ingest</span>,
        Header <span className="font-mono text-[11px]">x-rsd-api-key</span>). Sie erscheinen
        hier normalisiert und mit Governance-Mapping.
      </p>
    </div>
  );
}

function DetailDrawer({
  signal, onClose, onStatusChange,
}: {
  signal: SecuritySignalRow;
  onClose: () => void;
  onStatusChange: (id: string, status: SignalStatus) => void;
}) {
  const [links, setLinks] = useState<RiskLinkRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const mapping = (signal.normalized_payload?.governance ?? {}) as GovernanceMappingShape;

  useEffect(() => {
    let cancelled = false;
    fetchRiskLinks(signal.id)
      .then((l) => { if (!cancelled) setLinks(l); })
      .catch(() => { /* RLS/empty — Mapping wird zusätzlich aus normalized_payload gezeigt */ });
    return () => { cancelled = true; };
  }, [signal.id]);

  const setStatus = async (status: SignalStatus) => {
    setBusy(status);
    try {
      await updateSignalStatus(signal.id, status);
      onStatusChange(signal.id, status);
    } catch { /* ignore — UI bleibt nutzbar */ } finally {
      setBusy(null);
    }
  };

  const downloadSnapshot = () => {
    const blob = new Blob([JSON.stringify({
      id: signal.id, provider: signal.provider, external_id: signal.external_id,
      severity: signal.severity, title: signal.title, asset_ref: signal.asset_ref,
      normalized_payload: signal.normalized_payload, raw_payload: signal.raw_payload,
      exported_at: new Date().toISOString(),
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence-${signal.provider}-${signal.external_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sev = SEVERITY_UI[signal.severity];
  const controls = mapping.controls ?? links.map((l) => ({
    framework: l.framework ?? '', controlRef: l.control_ref ?? '', reason: l.mapping_reason ?? '',
  }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-obsidian-950/70" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full overflow-y-auto bg-obsidian-900 border-l border-titanium-800 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-obsidian-900 border-b border-titanium-800 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center font-mono text-[9px] uppercase tracking-wide border px-1.5 py-0.5 ${sev.cls}`}>{sev.label}</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">{signal.provider}</span>
            </div>
            <h3 className="font-display font-bold text-titanium-50 leading-snug">{signal.title}</h3>
          </div>
          <button onClick={onClose} className="shrink-0 p-1 text-titanium-500 hover:text-titanium-100 border border-titanium-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {signal.description && (
            <p className="text-sm text-titanium-300 leading-relaxed">{signal.description}</p>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-px bg-titanium-900 border border-titanium-900">
            {[
              ['Event-Type', signal.event_type ?? '—'],
              ['Status', STATUS_UI[signal.status].label],
              ['Asset', signal.asset_ref ?? '—'],
              ['External ID', signal.external_id],
              ['Erstmals', formatShort(signal.first_seen_at)],
              ['Zuletzt', formatShort(signal.last_seen_at)],
            ].map(([k, v]) => (
              <div key={k} className="bg-obsidian-900 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-600">{k}</div>
                <div className="text-[12px] text-titanium-200 font-mono truncate">{v}</div>
              </div>
            ))}
          </div>

          {/* Governance Mapping */}
          <section>
            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-titanium-500 mb-2">
              <Link2 className="h-3 w-3" /> Governance-Mapping
            </div>
            {(mapping.frameworks?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {mapping.frameworks!.map((f) => (
                  <span key={f} className="font-mono text-[10px] text-cyan-300 border border-cyan-900 px-1.5 py-0.5">{f}</span>
                ))}
              </div>
            )}
            {controls.length > 0 ? (
              <div className="border border-titanium-900 divide-y divide-titanium-900">
                {controls.map((c, i) => (
                  <div key={`${c.framework}-${c.controlRef}-${i}`} className="px-3 py-2 bg-obsidian-900">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-titanium-100">{c.framework}</span>
                      <span className="font-mono text-[10px] text-titanium-500">{c.controlRef}</span>
                    </div>
                    {c.reason && <p className="text-[11px] text-titanium-500 mt-0.5">{c.reason}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-titanium-600 font-mono">Kein Mapping vorhanden.</p>
            )}
          </section>

          {/* Empfohlene Tasks */}
          {(mapping.recommendedTasks?.length ?? 0) > 0 && (
            <section>
              <div className="font-mono text-[9px] uppercase tracking-widest text-titanium-500 mb-2">Empfohlene Maßnahmen</div>
              <ul className="space-y-1">
                {mapping.recommendedTasks!.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-titanium-300">
                    <ClipboardCheck className="h-3 w-3 text-titanium-600 shrink-0" />
                    <span className="flex-1">{t.title}</span>
                    <span className="font-mono text-[9px] text-titanium-600 uppercase">{t.priority}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Raw Payload */}
          <section>
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-titanium-500 hover:text-titanium-300"
            >
              <FileJson className="h-3 w-3" /> Raw Payload {showRaw ? '▾' : '▸'}
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-72 overflow-auto bg-obsidian-950 border border-titanium-900 p-3 text-[10px] font-mono text-titanium-400 whitespace-pre-wrap break-all">
                {JSON.stringify(signal.raw_payload, null, 2)}
              </pre>
            )}
          </section>
        </div>

        {/* CTAs */}
        <div className="sticky bottom-0 bg-obsidian-900 border-t border-titanium-800 px-5 py-3 flex flex-wrap gap-2">
          <button
            onClick={() => setStatus('in_review')}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold bg-cyan-500/90 text-obsidian-950 hover:bg-cyan-400 transition-colors disabled:opacity-50"
          >
            {busy === 'in_review' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
            Create Risk Review
          </button>
          <button
            onClick={() => setStatus('accepted')}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-emerald-300 border border-emerald-900 hover:bg-emerald-950/40 transition-colors disabled:opacity-50"
          >
            {busy === 'accepted' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Mark as accepted
          </button>
          <button
            onClick={downloadSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-titanium-300 border border-titanium-800 hover:text-titanium-100 transition-colors"
          >
            <Server className="h-3.5 w-3.5" />
            Create Evidence Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}
