import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Bot, AlertTriangle, Loader2, Activity, Network,
  Mail, Globe, Archive, FileCheck2, TrendingUp, RefreshCcw, Wand2,
} from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { RemediationPanel } from './RemediationPanel';
import {
  fetchAssetById, fetchEventsForAsset, fetchMappingsForAsset, fetchFrameworkControls,
  fetchAssetRiskHistory, recalculateRiskScore,
  type DbGovernanceAsset, type DbGovernanceEvent,
  type DbFrameworkControl, type DbAssetControlMapping,
  type DbAssetRiskHistory,
} from './governanceApi';
import { archiveAsset, autoMapAsset } from './resourcesApi';
import type { GovernanceRiskLevel, GovernanceControlStatus } from './types';

/**
 * /governance/assets/:assetId — single-asset drill-down. Shows
 * the asset itself plus everything attached: events that
 * reference it, framework-control mappings, and a quick archive
 * action.
 */
export function AssetDetailView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

const STATUS_LABEL: Record<GovernanceControlStatus, string> = {
  implemented:    'Implementiert',
  in_progress:    'In Arbeit',
  gap:            'Lücke',
  not_started:    'Offen',
  not_applicable: 'N/A',
};

const STATUS_CLS: Record<GovernanceControlStatus, string> = {
  implemented:     'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  in_progress:     'bg-sky-500/15 text-sky-200 border-sky-500/40',
  gap:             'bg-rose-500/15 text-rose-200 border-rose-500/40',
  not_started:     'bg-titanium-800/30 text-titanium-300 border-titanium-700',
  not_applicable:  'bg-titanium-900/40 text-titanium-500 border-titanium-800',
};

function Inner() {
  const { assetId } = useParams<{ assetId: string }>();
  const [asset, setAsset] = useState<DbGovernanceAsset | null | undefined>(undefined);
  const [events, setEvents] = useState<DbGovernanceEvent[]>([]);
  const [mappings, setMappings] = useState<DbAssetControlMapping[]>([]);
  const [controls, setControls] = useState<DbFrameworkControl[]>([]);
  const [riskHistory, setRiskHistory] = useState<DbAssetRiskHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [autoMapping, setAutoMapping] = useState(false);
  const [autoMapMsg, setAutoMapMsg] = useState<string | null>(null);

  const reload = async () => {
    if (!assetId) return;
    setError(null);
    try {
      const a = await fetchAssetById(assetId);
      setAsset(a);
      if (!a) return;
      const [e, m, c, rh] = await Promise.all([
        fetchEventsForAsset(assetId),
        fetchMappingsForAsset(assetId),
        fetchFrameworkControls(),
        fetchAssetRiskHistory(assetId),
      ]);
      setEvents(e); setMappings(m); setControls(c); setRiskHistory(rh);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    }
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [assetId]);

  const recalc = async () => {
    if (!assetId) return;
    setRecalculating(true);
    const r = await recalculateRiskScore(assetId);
    setRecalculating(false);
    if (!r.ok) { setError(r.error?.message ?? 'Recalc fehlgeschlagen'); return; }
    await reload();
  };

  const runAutoMap = async () => {
    if (!assetId) return;
    setAutoMapping(true); setError(null); setAutoMapMsg(null);
    const r = await autoMapAsset(assetId);
    setAutoMapping(false);
    if (!r.ok) { setError(r.error?.message ?? 'Auto-Mapping fehlgeschlagen'); return; }
    setAutoMapMsg(
      (r.applied ?? 0) > 0
        ? `${r.applied} Control${r.applied === 1 ? '' : 's'} automatisch zugeordnet.`
        : 'Keine Änderungen — bereits aktuell (manuelle Zuordnungen bleiben unangetastet).',
    );
    await reload();
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/app/websites" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm shrink-0">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50 truncate">
              {asset && asset.name ? asset.name : 'Asset Detail'}
            </div>
            <div className="text-[11px] text-titanium-400 font-mono truncate">{assetId}</div>
          </div>
        </div>
        {asset && asset.status !== 'archived' && (
          <button
            onClick={async () => {
              if (!asset || !assetId) return;
              if (!confirm(`Asset "${asset.name}" archivieren?`)) return;
              setArchiving(true);
              await archiveAsset(assetId);
              setArchiving(false);
              await reload();
            }}
            disabled={archiving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-red-500 text-titanium-300 hover:text-red-300 text-sm font-semibold rounded-none disabled:opacity-50"
          >
            <Archive className="h-4 w-4" /> Archivieren
          </button>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {asset === undefined ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Asset…
          </div>
        ) : asset === null ? (
          <NotFound />
        ) : (
          <Body
            asset={asset}
            events={events}
            mappings={mappings}
            controls={controls}
            riskHistory={riskHistory}
            onRecalculate={recalc}
            recalculating={recalculating}
            onAutoMap={runAutoMap}
            autoMapping={autoMapping}
            autoMapMsg={autoMapMsg}
          />
        )}
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="text-center py-16">
      <AlertTriangle className="h-8 w-8 mx-auto text-titanium-600 mb-3" />
      <h2 className="font-display text-lg font-bold text-titanium-50 mb-1">Asset nicht gefunden</h2>
      <p className="text-sm text-titanium-400 mb-4">
        Das Asset existiert nicht oder gehört zu einem anderen Tenant.
      </p>
      <Link to="/app/websites" className="text-amber-300 hover:text-amber-200 text-sm font-semibold">
        → Zurück zum Dashboard
      </Link>
    </div>
  );
}

function Body({
  asset, events, mappings, controls, riskHistory, onRecalculate, recalculating,
  onAutoMap, autoMapping, autoMapMsg,
}: {
  asset: DbGovernanceAsset;
  events: DbGovernanceEvent[];
  mappings: DbAssetControlMapping[];
  controls: DbFrameworkControl[];
  riskHistory: DbAssetRiskHistory[];
  onRecalculate: () => void;
  recalculating: boolean;
  onAutoMap: () => void;
  autoMapping: boolean;
  autoMapMsg: string | null;
}) {
  const criticalEvents = events.filter((e) => e.risk_level === 'critical').length;
  const highEvents = events.filter((e) => e.risk_level === 'high').length;
  const blocked = events.filter((e) => e.policy_action === 'block').length;

  const controlsById = new Map(controls.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="border border-titanium-900 bg-obsidian-900/60 p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-1">
              {asset.asset_type} · {asset.status}
            </div>
            <h1 className="font-display font-bold text-titanium-50 text-2xl tracking-tight leading-tight">
              {asset.name}
            </h1>
            {asset.description && (
              <p className="text-sm text-titanium-300 mt-2 leading-relaxed">{asset.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className={`font-mono text-3xl font-bold tabular-nums ${scoreClass(asset.risk_score)}`}>
              {asset.risk_score}
              <span className="text-base text-titanium-500">/100</span>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mt-0.5">Risk-Score</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
          <Meta label="AI-Act" value={asset.ai_act_class} />
          {asset.vendor      && <Meta label="Vendor"      value={asset.vendor} />}
          {asset.owner_email && <Meta label="Owner"       value={asset.owner_email} icon={<Mail className="h-3 w-3" />} />}
          {asset.system_url  && <Meta label="URL"         value={asset.system_url} icon={<Globe className="h-3 w-3" />} />}
        </div>

        {asset.data_types && asset.data_types.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {asset.data_types.map((dt) => (
              <span key={dt} className="text-[10px] font-mono uppercase tracking-wider bg-titanium-900/60 text-titanium-300 border border-titanium-800 px-1.5 py-0.5">
                {dt}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Metric strip */}
      <section className="grid grid-cols-3 gap-3">
        <Metric icon={<Activity />}      label="Events"   value={events.length} />
        <Metric icon={<AlertTriangle />} label="High/Crit" value={criticalEvents + highEvents} tone="danger" />
        <Metric icon={<Network />}       label="Blockiert" value={blocked} tone="warn" />
      </section>

      {/* Control mappings */}
      <Section icon={<FileCheck2 className="h-4 w-4" />} title={`Framework Mappings (${mappings.length})`} actions={
        <div className="flex items-center gap-2">
          <button
            onClick={onAutoMap}
            disabled={autoMapping}
            title="Control-Status aus der Asset-Klassifikation (AI-Act, Datentypen) ableiten. Manuelle Zuordnungen bleiben unangetastet."
            className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/10 rounded-none disabled:opacity-50"
          >
            <Wand2 className={`h-3 w-3 ${autoMapping ? 'animate-pulse' : ''}`} />
            {autoMapping ? 'Mappe…' : 'Auto-Mapping'}
          </button>
          <Link to="/app/mappings" className="text-[11px] text-amber-300 hover:text-amber-200 font-semibold">
            Matrix bearbeiten →
          </Link>
        </div>
      }>
        {autoMapMsg && (
          <div className="mb-3 text-[12px] text-indigo-200 bg-indigo-500/5 border border-indigo-500/30 px-3 py-2">
            {autoMapMsg}
          </div>
        )}
        {mappings.length === 0 ? (
          <div className="text-sm text-titanium-500">
            Noch keine Framework-Controls zugeordnet.{' '}
            <Link to="/app/mappings" className="text-amber-300 hover:text-amber-200">→ Matrix öffnen</Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {mappings.map((m) => {
              const c = controlsById.get(m.control_id);
              return (
                <li key={m.id} className="border border-titanium-900 bg-obsidian-950/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
                        {c?.framework} · {c?.control_code}
                      </div>
                      <div className="text-titanium-50 text-sm font-semibold mt-0.5">{c?.title ?? m.control_id}</div>
                      {m.notes && (
                        <p className="text-[12px] text-titanium-300 mt-1 leading-relaxed">{m.notes}</p>
                      )}
                    </div>
                    <span className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${STATUS_CLS[m.status]}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Risk Score History */}
      <Section
        icon={<TrendingUp className="h-4 w-4" />}
        title={`Risk Score History (${riskHistory.length})`}
        actions={
          <button
            onClick={onRecalculate}
            disabled={recalculating}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-amber-300 border border-amber-500/40 hover:bg-amber-500/10 rounded-none disabled:opacity-50"
          >
            <RefreshCcw className={`h-3 w-3 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalc…' : 'Score neu berechnen'}
          </button>
        }
      >
        {riskHistory.length === 0 ? (
          <div className="text-sm text-titanium-500">
            Noch keine Score-Berechnung erfasst. Sende ein Event oder klicke „Score neu berechnen".
          </div>
        ) : (
          <RiskSparkline history={riskHistory} />
        )}
      </Section>

      {/* Events */}
      <Section icon={<Activity className="h-4 w-4" />} title={`Recent Events (${events.length})`}>
        {events.length === 0 ? (
          <div className="text-sm text-titanium-500">Keine Events zu diesem Asset.</div>
        ) : (
          <ul className="space-y-2">
            {events.slice(0, 50).map((ev) => (
              <li key={ev.id}>
                <Link
                  to={`/governance/events/${ev.id}`}
                  className="block border border-titanium-900 bg-obsidian-950/60 p-3 hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-titanium-50 text-sm leading-snug">{ev.title}</div>
                      <div className="text-[11px] font-mono text-titanium-400 mt-1">
                        {ev.event_type} · {ev.event_source} · {new Date(ev.created_at).toLocaleString('de-DE')}
                      </div>
                    </div>
                    <RiskBadge level={ev.risk_level} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <RemediationPanel tenantId={asset.tenant_id} assetId={asset.id} />
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */

function Section({
  icon, title, children, actions,
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <section className="border border-titanium-900 bg-obsidian-900/60">
      <header className="px-4 py-3 border-b border-titanium-900 flex items-center gap-2 text-titanium-200">
        {icon}
        <h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">{title}</h2>
        {actions && <div className="ml-auto">{actions}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Meta({
  label, value, icon,
}: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="border border-titanium-900 bg-obsidian-950/40 px-2.5 py-1.5">
      <div className="text-[9px] font-mono uppercase tracking-wider text-titanium-500 flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-[12px] text-titanium-200 font-mono mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Metric({
  icon, label, value, tone,
}: {
  icon: React.ReactNode; label: string; value: number; tone?: 'danger' | 'warn';
}) {
  const valueColor =
    tone === 'danger' ? 'text-red-300' :
    tone === 'warn'   ? 'text-amber-300' :
    'text-titanium-50';
  return (
    <div className="border border-titanium-900 bg-obsidian-900/60 p-3">
      <div className="h-5 w-5 text-titanium-400">{icon}</div>
      <div className={`mt-2 text-2xl font-display font-bold tabular-nums ${valueColor}`}>{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">{label}</div>
    </div>
  );
}

function RiskBadge({ level }: { level: GovernanceRiskLevel }) {
  const cls =
    level === 'critical' ? 'text-red-300 border-red-500/60 bg-red-500/10' :
    level === 'high'     ? 'text-amber-300 border-amber-500/60 bg-amber-500/10' :
    level === 'medium'   ? 'text-yellow-200 border-yellow-500/50 bg-yellow-500/10' :
    level === 'low'      ? 'text-sky-300 border-sky-500/50 bg-sky-500/10' :
                           'text-titanium-300 border-titanium-700 bg-titanium-800/30';
  return (
    <span className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${cls}`}>
      {level}
    </span>
  );
}

function scoreClass(score: number) {
  if (score >= 80) return 'text-red-300';
  if (score >= 60) return 'text-amber-300';
  if (score >= 40) return 'text-yellow-300';
  return 'text-emerald-300';
}

function RiskSparkline({ history }: { history: DbAssetRiskHistory[] }) {
  // Sort chronologically for the sparkline (oldest left → newest right).
  const chrono = [...history].sort((a, b) => a.calculated_at.localeCompare(b.calculated_at));
  const w = 300;
  const h = 60;
  const max = Math.max(100, ...chrono.map((r) => r.risk_score));
  const min = Math.min(0,   ...chrono.map((r) => r.risk_score));
  const dx = chrono.length > 1 ? w / (chrono.length - 1) : 0;
  const points = chrono.map((r, i) => {
    const y = h - ((r.risk_score - min) / (max - min || 1)) * h;
    return `${i * dx},${y}`;
  }).join(' ');

  return (
    <div className="space-y-3">
      {chrono.length > 1 && (
        <div className="border border-titanium-900 bg-obsidian-950/60 p-3">
          <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h} className="overflow-visible">
            <polyline fill="none" stroke="#f59e0b" strokeWidth="2" points={points} />
            {chrono.map((r, i) => {
              const cy = h - ((r.risk_score - min) / (max - min || 1)) * h;
              return <circle key={r.id} cx={i * dx} cy={cy} r="2.5" fill="#f59e0b" />;
            })}
          </svg>
          <div className="mt-1 flex justify-between text-[10px] font-mono text-titanium-500">
            <span>{new Date(chrono[0].calculated_at).toLocaleDateString('de-DE')}</span>
            <span>{new Date(chrono[chrono.length - 1].calculated_at).toLocaleDateString('de-DE')}</span>
          </div>
        </div>
      )}

      <ul className="space-y-1.5">
        {history.slice(0, 10).map((r) => {
          const delta = r.score_delta ?? 0;
          const deltaCls = delta > 0 ? 'text-red-300' : delta < 0 ? 'text-emerald-300' : 'text-titanium-400';
          const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '·';
          return (
            <li key={r.id} className="border border-titanium-900 bg-obsidian-950/60 p-2.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-titanium-400 text-[12px] font-mono">
                  {new Date(r.calculated_at).toLocaleString('de-DE')}
                </span>
                <span className={`font-mono tabular-nums font-bold ${scoreClass(r.risk_score)}`}>
                  Score {r.risk_score}/100
                </span>
                <span className={`font-mono text-[12px] font-bold ${deltaCls}`}>
                  {arrow} {delta > 0 ? '+' : ''}{delta}
                </span>
              </div>
              {r.reason && (
                <div className="mt-1 text-[12px] text-titanium-300 leading-relaxed">{r.reason}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
