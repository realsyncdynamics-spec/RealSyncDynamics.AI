/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Risk Center — Governance OS
 * Ampelsystem: Kritisch / Hoch / Mittel / Niedrig
 * DSGVO · EU AI Act · TDDDG · Technische Sicherheit
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTenant } from '../../../core/access/TenantProvider';
import { fetchTenantIncidents, transitionIncident } from '../incidentsApi';
import type { IncidentStatus } from '../types';
import { withPerformanceMonitoring } from '../withPerformanceMonitoring';
import {
  asOfLabel,
  countByCategory,
  incidentToRisk,
  RISK_CATEGORIES,
  type Category,
  type Impact,
  type Probability,
  type Risk,
  type Severity,
  type Status,
} from './riskCenterData';
import {
  ShieldAlert, Search, ChevronDown, ChevronUp, X,
  ExternalLink, AlertTriangle, CheckCircle2, Clock, Circle, Loader2, ShieldCheck, FileCheck2,
} from 'lucide-react';

// Status-Übergänge für echte Incidents (governance-incidents transition)
const INCIDENT_TRANSITIONS: { label: string; status: IncidentStatus }[] = [
  { label: 'In Untersuchung', status: 'investigating' },
  { label: 'Eingedämmt', status: 'contained' },
  { label: 'Behoben', status: 'resolved' },
  { label: 'Behörde gemeldet', status: 'reported_to_authority' },
];

// ─── Farbdefinitionen ──────────────────────────────────────────────────────
const SEVERITY_CFG: Record<Severity, {
  card: string; badge: string; bar: string; dot: string; btn: string;
}> = {
  Kritisch: {
    card: 'bg-red-950/40 border-red-900',
    badge: 'text-red-400 bg-red-950/60 border-red-800',
    bar: 'bg-red-500',
    dot: 'bg-red-500',
    btn: 'text-red-400 border-red-900 hover:border-red-700',
  },
  Hoch: {
    card: 'bg-orange-950/30 border-orange-900',
    badge: 'text-orange-400 bg-orange-950/60 border-orange-800',
    bar: 'bg-orange-500',
    dot: 'bg-orange-500',
    btn: 'text-orange-400 border-orange-900 hover:border-orange-700',
  },
  Mittel: {
    card: 'bg-amber-950/20 border-amber-900',
    badge: 'text-amber-400 bg-amber-950/60 border-amber-800',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
    btn: 'text-amber-400 border-amber-900 hover:border-amber-700',
  },
  Niedrig: {
    card: 'bg-teal-950/20 border-teal-900',
    badge: 'text-teal-400 bg-teal-950/60 border-teal-800',
    bar: 'bg-teal-500',
    dot: 'bg-teal-500',
    btn: 'text-teal-400 border-teal-900 hover:border-teal-700',
  },
};

const STATUS_CFG: Record<Status, { cls: string; icon: React.ReactNode }> = {
  Offen:           { cls: 'text-red-300 bg-red-950/40 border-red-900',    icon: <Circle className="h-3 w-3" /> },
  'In Bearbeitung':{ cls: 'text-amber-300 bg-amber-950/40 border-amber-900', icon: <Clock className="h-3 w-3" /> },
  Behoben:         { cls: 'text-teal-300 bg-teal-950/40 border-teal-900', icon: <CheckCircle2 className="h-3 w-3" /> },
  Akzeptiert:      { cls: 'text-titanium-400 bg-titanium-900/40 border-titanium-800', icon: <CheckCircle2 className="h-3 w-3" /> },
};

const SEVERITY_ORDER: Record<Severity, number> = { Kritisch: 0, Hoch: 1, Mittel: 2, Niedrig: 3 };

const CATEGORIES: Category[] = RISK_CATEGORIES;

// ─── Heatmap-Daten: [wahrscheinlichkeit][auswirkung] → Risk-IDs ────────────
// Reihenfolge: y = ['Hoch','Mittel','Niedrig'], x = ['Niedrig','Mittel','Hoch']
function buildHeatmap(risks: Risk[]) {
  const map: Record<string, Risk[]> = {};
  const ps: Probability[] = ['Hoch', 'Mittel', 'Niedrig'];
  const imps: Impact[] = ['Niedrig', 'Mittel', 'Hoch'];
  ps.forEach((p) => imps.forEach((i) => { map[`${p}-${i}`] = []; }));
  risks.forEach((r) => { map[`${r.probability}-${r.impact}`]?.push(r); });
  return map;
}

// ─── Sub-Komponenten ────────────────────────────────────────────────────────

function MetricCard({ label, value, colorCls }: { label: string; value: number; colorCls: string }) {
  return (
    <div className="border border-titanium-900 bg-obsidian-900 px-4 py-3 flex flex-col gap-1 min-w-0">
      <div className={`font-mono text-2xl font-bold leading-none ${colorCls}`}>{value}</div>
      <div className="text-[11px] text-titanium-500 font-mono uppercase tracking-widest">{label}</div>
    </div>
  );
}

function SeverityDot({ severity, size = 'sm' }: { severity: Severity; size?: 'sm' | 'md' }) {
  const cfg = SEVERITY_CFG[severity];
  const sz = size === 'md' ? 'w-3 h-3' : 'w-2 h-2';
  return <span className={`inline-block ${sz} rounded-none shrink-0 ${cfg.dot}`} />;
}

// Heatmap-Zelle
function HeatmapCell({ risks }: { risks: Risk[] }) {
  const hasCritical = risks.some((r) => r.severity === 'Kritisch');
  const hasHigh     = risks.some((r) => r.severity === 'Hoch');
  const bgCls = risks.length === 0
    ? 'bg-obsidian-950'
    : hasCritical
      ? 'bg-red-950/60'
      : hasHigh
        ? 'bg-orange-950/40'
        : 'bg-amber-950/20';
  return (
    <div className={`border border-titanium-900 ${bgCls} flex flex-wrap gap-1 items-center justify-center p-2 min-h-[52px]`}>
      {risks.map((r) => (
        <span key={r.id} className={`w-2.5 h-2.5 rounded-none shrink-0 ${SEVERITY_CFG[r.severity].dot}`} title={r.title} />
      ))}
      {risks.length === 0 && <span className="text-titanium-800 font-mono text-[10px]">–</span>}
    </div>
  );
}

// Risiko-Heatmap
function RiskHeatmap({ risks }: { risks: Risk[] }) {
  const heatmap = useMemo(() => buildHeatmap(risks), [risks]);
  const probabilities: Probability[] = ['Hoch', 'Mittel', 'Niedrig'];
  const impacts: Impact[] = ['Niedrig', 'Mittel', 'Hoch'];

  return (
    <div className="border border-titanium-900 bg-obsidian-900 p-4 flex flex-col gap-3">
      <div className="text-[11px] font-mono uppercase tracking-widest text-titanium-500">
        Risiko-Matrix · Wahrscheinlichkeit × Auswirkung
      </div>
      <div className="flex gap-2">
        {/* Y-Achsen-Label */}
        <div className="flex flex-col justify-between py-6 pr-1">
          {probabilities.map((p) => (
            <div key={p} className="text-[10px] font-mono text-titanium-600 writing-mode-vertical text-right w-12 leading-tight">
              {p}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="flex-1">
          {/* X-Achse Header */}
          <div className="grid grid-cols-3 gap-1 mb-1">
            {impacts.map((imp) => (
              <div key={imp} className="text-[10px] font-mono text-titanium-600 text-center">{imp}</div>
            ))}
          </div>
          {/* Zellen */}
          {probabilities.map((p) => (
            <div key={p} className="grid grid-cols-3 gap-1 mb-1">
              {impacts.map((imp) => (
                <HeatmapCell key={`${p}-${imp}`} risks={heatmap[`${p}-${imp}`] ?? []} />
              ))}
            </div>
          ))}
          {/* X-Achse Footer */}
          <div className="text-[10px] font-mono text-titanium-600 text-center mt-1">
            Auswirkung →
          </div>
        </div>
      </div>
      {/* Legende */}
      <div className="flex flex-wrap gap-3 pt-1 border-t border-titanium-900">
        {(['Kritisch', 'Hoch', 'Mittel', 'Niedrig'] as Severity[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <SeverityDot severity={s} />
            <span className={`text-[10px] font-mono ${SEVERITY_CFG[s].badge.split(' ')[0]}`}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Balkendiagramm Kategorie
function CategoryBarChart({ risks }: { risks: Risk[] }) {
  const counts = countByCategory(risks);
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div className="border border-titanium-900 bg-obsidian-900 p-4 flex flex-col gap-3">
      <div className="text-[11px] font-mono uppercase tracking-widest text-titanium-500">
        Risiken nach Kategorie
      </div>
      <div className="flex flex-col gap-2.5">
        {CATEGORIES.map((cat) => {
          const count = counts[cat];
          const pct   = Math.round((count / max) * 100);
          return (
            <div key={cat} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-titanium-300 truncate max-w-[160px]">{cat}</span>
                <span className="text-[11px] font-mono text-titanium-500 ml-2 shrink-0">{count}</span>
              </div>
              <div className="h-2 bg-obsidian-950 border border-titanium-900">
                <div
                  className="h-full bg-gradient-to-r from-teal-600 to-teal-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Status-Badge
function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-mono uppercase tracking-wider ${cfg.cls}`}>
      {cfg.icon}
      {status}
    </span>
  );
}

// Aktions-Callbacks für Risiko-Karten und Detail-Modal
interface RiskActions {
  onMassnahme: (r: Risk) => void;
  onNachweis: (r: Risk) => void;
  onStatus: (r: Risk, status: IncidentStatus) => void;
  onClose: (r: Risk) => void;
  busyId: string | null;
}

// Einzelne Risk-Card
function RiskCard({ risk, onOpen, actions }: { risk: Risk; onOpen: (r: Risk) => void; actions: RiskActions }) {
  const cfg = SEVERITY_CFG[risk.severity];
  const [expanded, setExpanded] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const busy = actions.busyId === risk.id;

  return (
    <div className={`border ${cfg.card} flex cursor-default`}>
      {/* Severity-Streifen */}
      <div className={`w-1 shrink-0 ${cfg.bar}`} />

      <div className="flex-1 p-4 min-w-0">
        {/* Kopfzeile */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <span className={`px-2 py-0.5 border text-[11px] font-mono font-bold uppercase tracking-widest shrink-0 ${cfg.badge}`}>
              {risk.severity}
            </span>
            <StatusBadge status={risk.status} />
          </div>
          <button
            onClick={() => onOpen(risk)}
            className="shrink-0 text-[10px] font-mono text-titanium-500 hover:text-titanium-200 border border-titanium-800 hover:border-titanium-600 px-2 py-1"
          >
            Details
          </button>
        </div>

        {/* Titel */}
        <button
          onClick={() => onOpen(risk)}
          className="text-left text-sm font-semibold text-titanium-100 hover:text-white mb-1.5 leading-snug"
        >
          {risk.title}
        </button>

        {/* Kategorie + Framework */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-2">
          <span className="text-[10px] font-mono text-titanium-500 uppercase tracking-wider">{risk.category}</span>
          <span className="text-[10px] font-mono text-titanium-600">·</span>
          <span className="text-[10px] font-mono text-titanium-600">{risk.framework}</span>
        </div>

        {/* Betroffene Systeme */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {risk.systems.map((s) => (
            <span key={s} className="px-2 py-0.5 bg-obsidian-950 border border-titanium-800 text-[10px] font-mono text-titanium-400">
              {s}
            </span>
          ))}
        </div>

        {/* Beschreibung */}
        <p className="text-[12px] text-titanium-400 leading-relaxed mb-3 line-clamp-2">
          {risk.description}
        </p>

        {/* Empfohlene Maßnahmen (ausklappbar) */}
        <div className="mb-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[10px] font-mono text-titanium-500 hover:text-titanium-300 uppercase tracking-wider"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Maßnahmen ({risk.actions.length})
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1 pl-2 border-l border-titanium-800">
              {risk.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] font-mono text-titanium-400">
                  <span className="text-titanium-700 shrink-0 mt-px">{i + 1}.</span>
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Evidence */}
        {risk.evidence.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[10px] font-mono text-titanium-600 uppercase tracking-wider">Nachweis:</span>
            {risk.evidence.map((ev) => (
              <Link
                key={ev}
                to="/app/evidence"
                className="text-teal-400 hover:underline font-mono text-xs flex items-center gap-1"
              >
                {ev}
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            ))}
          </div>
        )}

        {/* Meta + Aktionen */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-titanium-900/60">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-[10px] font-mono text-titanium-600">
              Erkannt: <span className="text-titanium-400">{risk.detectedAt}</span>
            </span>
            <span className="text-[10px] font-mono text-titanium-600">
              Verantw.: <span className="text-titanium-400">{risk.owner}</span>
            </span>
            {risk.dueDate && (
              <span className="text-[10px] font-mono text-titanium-600">
                Fällig: <span className="text-titanium-400">{risk.dueDate}</span>
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => actions.onMassnahme(risk)}
              className="border border-titanium-800 hover:border-titanium-600 px-3 py-1.5 text-xs font-mono text-titanium-400 hover:text-titanium-200"
            >
              Maßnahme
            </button>
            <button
              onClick={() => actions.onNachweis(risk)}
              className="border border-titanium-800 hover:border-titanium-600 px-3 py-1.5 text-xs font-mono text-titanium-400 hover:text-titanium-200"
            >
              Nachweis
            </button>
            <div className="relative">
              <button
                onClick={() => setStatusOpen((v) => !v)}
                disabled={busy}
                className="flex items-center gap-1 border border-titanium-800 hover:border-titanium-600 px-3 py-1.5 text-xs font-mono text-titanium-400 hover:text-titanium-200 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Status
                <ChevronDown className="h-3 w-3" />
              </button>
              {statusOpen && (
                <div className="absolute right-0 bottom-full mb-1 z-20 w-44 bg-obsidian-900 border border-titanium-800 shadow-lg">
                  {INCIDENT_TRANSITIONS.map((t) => (
                    <button
                      key={t.status}
                      onClick={() => { setStatusOpen(false); actions.onStatus(risk, t.status); }}
                      className="block w-full text-left px-3 py-1.5 text-[11px] font-mono text-titanium-300 hover:bg-obsidian-800"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Risk Detail Modal
function RiskDetailModal({ risk, onClose, actions }: { risk: Risk; onClose: () => void; actions: RiskActions }) {
  const cfg = SEVERITY_CFG[risk.severity];
  const [checkedActions, setCheckedActions] = useState<Set<number>>(new Set());
  const busy = actions.busyId === risk.id;

  const toggleAction = (i: number) => {
    setCheckedActions((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-obsidian-950/90 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-obsidian-900 border border-titanium-800 flex flex-col">
        {/* Header */}
        <div className={`border-l-4 ${cfg.bar.replace('bg-', 'border-')} px-5 py-4 border-b border-titanium-800 flex items-start justify-between gap-3`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 border text-[11px] font-mono font-bold uppercase tracking-widest ${cfg.badge}`}>
                {risk.severity}
              </span>
              <StatusBadge status={risk.status} />
              <span className="text-[10px] font-mono text-titanium-600">{risk.id}</span>
            </div>
            <h2 className="text-base font-bold text-titanium-50 leading-snug">{risk.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Beschreibung */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-titanium-600 mb-1.5">Beschreibung</div>
            <p className="text-[13px] text-titanium-300 leading-relaxed">{risk.description}</p>
          </div>

          {/* Metadaten */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 border border-titanium-900 bg-obsidian-950 p-3">
            {[
              ['Kategorie',   risk.category],
              ['Framework',   risk.framework],
              ['Erkannt am',  risk.detectedAt],
              ['Verantw.',    risk.owner],
              ['Fällig bis',  risk.dueDate ?? '–'],
              ['Wahrsch.',    risk.probability],
              ['Auswirkung',  risk.impact],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[10px] font-mono text-titanium-600 uppercase tracking-wider">{k}</div>
                <div className="text-[12px] font-mono text-titanium-300">{v}</div>
              </div>
            ))}
          </div>

          {/* Betroffene Systeme */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-titanium-600 mb-2">Betroffene Systeme</div>
            <div className="flex flex-wrap gap-1.5">
              {risk.systems.map((s) => (
                <span key={s} className="px-2 py-0.5 bg-obsidian-950 border border-titanium-800 text-[11px] font-mono text-titanium-400">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Maßnahmen Checkliste */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-titanium-600 mb-2">
              Empfohlene Maßnahmen
            </div>
            <div className="space-y-2">
              {risk.actions.map((action, i) => (
                <label
                  key={i}
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={checkedActions.has(i)}
                    onChange={() => toggleAction(i)}
                    className="mt-0.5 shrink-0 accent-teal-500"
                  />
                  <span className={`text-[12px] font-mono leading-relaxed ${
                    checkedActions.has(i) ? 'line-through text-titanium-700' : 'text-titanium-300'
                  }`}>
                    {action}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Evidence */}
          {risk.evidence.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-titanium-600 mb-2">Nachweise</div>
              <div className="flex flex-wrap gap-2">
                {risk.evidence.map((ev) => (
                  <Link
                    key={ev}
                    to="/app/evidence"
                    className="text-teal-400 hover:underline font-mono text-xs flex items-center gap-1 border border-teal-900/40 px-2 py-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {ev}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer-Aktionen */}
        <div className="border-t border-titanium-800 px-5 py-3 flex flex-wrap gap-2">
          <button
            onClick={() => actions.onNachweis(risk)}
            className="flex items-center gap-1.5 border border-titanium-800 hover:border-titanium-600 px-3 py-1.5 text-xs font-mono text-titanium-300 hover:text-titanium-100"
          >
            <FileCheck2 className="h-3 w-3" />
            Nachweis hinzufügen
          </button>
          <button
            onClick={() => actions.onMassnahme(risk)}
            className="flex items-center gap-1.5 border border-titanium-800 hover:border-titanium-600 px-3 py-1.5 text-xs font-mono text-titanium-300 hover:text-titanium-100"
          >
            <ShieldCheck className="h-3 w-3" />
            Maßnahme dokumentieren
          </button>
          <button
            onClick={() => actions.onClose(risk)}
            disabled={busy}
            className="ml-auto flex items-center gap-1.5 border border-red-900 hover:border-red-700 px-3 py-1.5 text-xs font-mono text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            Risk schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Haupt-View ─────────────────────────────────────────────────────────────
function _RiskCenterView() {
  const { activeTenantId } = useTenant();
  const navigate = useNavigate();
  const [activeRisks, setActiveRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | 'Alle'>('Alle');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'Alle'>('Alle');
  const [statusFilter,   setStatusFilter]   = useState<Status | 'Alle'>('Alle');
  const [search,         setSearch]         = useState('');
  const [detailRisk,     setDetailRisk]     = useState<Risk | null>(null);
  const [busyId,         setBusyId]         = useState<string | null>(null);
  const [toast,          setToast]          = useState<{ msg: string; tone: 'ok' | 'error' } | null>(null);

  function showToast(msg: string, tone: 'ok' | 'error' = 'ok') {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  }

  function reload() {
    if (!activeTenantId) {
      setActiveRisks([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    fetchTenantIncidents(activeTenantId)
      .then((incidents) => {
        setActiveRisks(incidents.map(incidentToRisk));
      })
      .catch((err: unknown) => {
        setActiveRisks([]);
        setLoadError(err instanceof Error ? err.message : 'Vorfälle konnten nicht geladen werden.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId]);

  async function applyTransition(risk: Risk, status: IncidentStatus) {
    if (!risk.incidentId) {
      showToast('Dieser Eintrag hat keinen Incident-Bezug — Status wird nicht persistiert.', 'error');
      return;
    }
    setBusyId(risk.id);
    try {
      const res = await transitionIncident(risk.incidentId, status);
      if (!res.ok) {
        showToast(res.error?.message ?? 'Statuswechsel fehlgeschlagen.', 'error');
        return;
      }
      showToast('Status aktualisiert.');
      setDetailRisk(null);
      reload();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const actions: RiskActions = {
    busyId,
    onMassnahme: () => navigate('/app/remediation'),
    onNachweis: () => navigate('/app/evidence'),
    onStatus: (risk, status) => void applyTransition(risk, status),
    onClose: (risk) => void applyTransition(risk, 'resolved'),
  };

  const counts = useMemo(() => ({
    Kritisch: activeRisks.filter((r) => r.severity === 'Kritisch').length,
    Hoch:     activeRisks.filter((r) => r.severity === 'Hoch').length,
    Mittel:   activeRisks.filter((r) => r.severity === 'Mittel').length,
    Niedrig:  activeRisks.filter((r) => r.severity === 'Niedrig').length,
    Gesamt:   activeRisks.length,
  }), [activeRisks]);

  const filtered = useMemo(() => {
    let list = [...activeRisks];
    if (severityFilter !== 'Alle') list = list.filter((r) => r.severity === severityFilter);
    if (categoryFilter !== 'Alle') list = list.filter((r) => r.category === categoryFilter);
    if (statusFilter   !== 'Alle') list = list.filter((r) => r.status   === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.systems.some((s) => s.toLowerCase().includes(q)) ||
        r.framework.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [activeRisks, severityFilter, categoryFilter, statusFilter, search]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {/* ── Seitenkopf ── */}
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/app/websites"
            className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"
          >
            ←
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-orange-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Risk Center</div>
              <div className="text-[11px] text-titanium-400 font-mono">
                Governance OS · DSGVO · EU AI Act · Ampelsystem
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-titanium-600 border border-titanium-900 px-2 py-1">
            Stand: {asOfLabel(activeRisks)}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Metrics Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <MetricCard label="Gesamt Risiken" value={counts.Gesamt}   colorCls="text-titanium-100" />
          <MetricCard label="Kritisch"       value={counts.Kritisch} colorCls="text-red-400" />
          <MetricCard label="Hoch"           value={counts.Hoch}     colorCls="text-orange-400" />
          <MetricCard label="Mittel"         value={counts.Mittel}   colorCls="text-amber-400" />
          <MetricCard label="Niedrig"        value={counts.Niedrig}  colorCls="text-teal-400" />
        </div>

        {/* ── Risk Priority Matrix + Kategorien ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RiskHeatmap risks={activeRisks} />
          <CategoryBarChart risks={activeRisks} />
        </div>

        {/* ── Filterleiste ── */}
        <div className="border border-titanium-900 bg-obsidian-900 p-3">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Ampel-Filter */}
            {(['Alle', 'Kritisch', 'Hoch', 'Mittel', 'Niedrig'] as const).map((s) => {
              const isActive = severityFilter === s;
              if (s === 'Alle') {
                return (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter('Alle')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border text-[11px] font-mono font-bold ${
                      isActive
                        ? 'bg-titanium-800 border-titanium-600 text-titanium-100'
                        : 'border-titanium-800 text-titanium-500 hover:border-titanium-600 hover:text-titanium-300'
                    }`}
                  >
                    Alle {counts.Gesamt}
                  </button>
                );
              }
              const sev = s as Severity;
              const cfg = SEVERITY_CFG[sev];
              return (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(isActive ? 'Alle' : sev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border text-[11px] font-mono font-bold ${
                    isActive
                      ? `${cfg.badge} opacity-100`
                      : `${cfg.btn} opacity-70 hover:opacity-100`
                  }`}
                >
                  <span className={`w-2 h-2 rounded-none ${cfg.dot}`} />
                  {sev} {counts[sev]}
                </button>
              );
            })}

            {/* Trenner */}
            <div className="w-px h-6 bg-titanium-900 mx-1 hidden sm:block" />

            {/* Suche */}
            <div className="flex items-center gap-1.5 border border-titanium-800 bg-obsidian-950 px-2 py-1.5 flex-1 min-w-[160px]">
              <Search className="h-3 w-3 text-titanium-600 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen…"
                className="bg-transparent text-[12px] font-mono text-titanium-200 placeholder-titanium-700 outline-none w-full"
              />
            </div>

            {/* Kategorie-Dropdown */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as Category | 'Alle')}
                className="appearance-none bg-obsidian-950 border border-titanium-800 text-[11px] font-mono text-titanium-400 px-3 py-1.5 pr-7 outline-none hover:border-titanium-600"
              >
                <option value="Alle">Kategorie</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-titanium-600 pointer-events-none" />
            </div>

            {/* Status-Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Status | 'Alle')}
                className="appearance-none bg-obsidian-950 border border-titanium-800 text-[11px] font-mono text-titanium-400 px-3 py-1.5 pr-7 outline-none hover:border-titanium-600"
              >
                <option value="Alle">Status</option>
                {(['Offen', 'In Bearbeitung', 'Behoben', 'Akzeptiert'] as Status[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-titanium-600 pointer-events-none" />
            </div>
          </div>

          {/* Ergebnis-Info */}
          <div className="mt-2 text-[10px] font-mono text-titanium-600">
            {filtered.length} von {activeRisks.length} Risiken
            {(severityFilter !== 'Alle' || categoryFilter !== 'Alle' || statusFilter !== 'Alle' || search) && (
              <button
                onClick={() => { setSeverityFilter('Alle'); setCategoryFilter('Alle'); setStatusFilter('Alle'); setSearch(''); }}
                className="ml-3 text-teal-500 hover:text-teal-400 hover:underline"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* ── Risk-Liste ── */}
        {loading ? (
          <div className="border border-titanium-900 bg-obsidian-900 py-16 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-titanium-600 animate-spin" />
            <p className="text-sm text-titanium-500 font-mono">Vorfälle werden geladen…</p>
          </div>
        ) : loadError ? (
          <div className="border border-red-900 bg-red-950/30 py-16 flex flex-col items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <p className="text-sm text-red-300 font-mono">{loadError}</p>
          </div>
        ) : activeRisks.length === 0 ? (
          <div className="border border-titanium-900 bg-obsidian-900 py-16 flex flex-col items-center gap-3 text-center px-6">
            <ShieldCheck className="h-8 w-8 text-titanium-700" />
            <p className="text-sm text-titanium-200 font-display">Noch keine Vorfälle</p>
            <p className="text-[12px] text-titanium-500 font-mono max-w-md">
              Das Risk Center zeigt nur Mandanten-Incidents. Leere Mandanten bleiben leer — keine Demo-Daten.
            </p>
            <button
              onClick={() => navigate('/app/websites')}
              className="mt-2 px-3 py-1.5 text-[11px] font-mono border border-teal-800 text-teal-300 hover:border-teal-600"
            >
              Domain scannen
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-titanium-900 bg-obsidian-900 py-16 flex flex-col items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-titanium-700" />
            <p className="text-sm text-titanium-500 font-mono">Keine Risiken für diesen Filter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((risk) => (
              <RiskCard key={risk.id} risk={risk} onOpen={setDetailRisk} actions={actions} />
            ))}
          </div>
        )}
      </main>

      {/* ── Risk Detail Modal ── */}
      {detailRisk && (
        <RiskDetailModal risk={detailRisk} onClose={() => setDetailRisk(null)} actions={actions} />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 border font-mono text-xs shadow-lg ${
          toast.tone === 'error' ? 'bg-red-950 border-red-800 text-red-200' : 'bg-obsidian-800 border-teal-700 text-teal-300'
        }`}>
          {toast.tone === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export const RiskCenterView = withPerformanceMonitoring(
  _RiskCenterView,
  'RiskCenterView',
  { threshold: 500, maxRenders: 10 }
);
