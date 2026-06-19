// MonitoringRuntimeView.tsx — P6 Monitoring Runtime Dashboard
// 24/7 DSGVO & EU AI Act Governance Operating System
// Abschnitte: Header + Metriken · Asset-Status (Tabs) · Alerts + Regeln · Live Feed

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MonitoringSurface } from '../../../pages/MonitoringPage';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  fetchTenantAssets, fetchTenantEvents, fetchTenantPolicies,
  type DbGovernanceAsset, type DbGovernancePolicy, type DbGovernanceEvent,
} from '../governanceApi';
import { countOpenIncidents } from '../incidentsApi';
import {
  loadAlertRules, setAlertRuleActive, addCustomAlertRule, deleteAlertRule,
  type AlertRule,
} from './alertRulesApi';

// ---------------------------------------------------------------------------
// Datentypen + Mapper — echte Governance-Assets/Policies/Events → Tabellenzeilen
// (zuvor standen hier hartkodierte Beispiel-Arrays, die eingeloggten Tenants
//  fabrizierte Monitoring-Zahlen zeigten — entfernt, Audit-Befund K1.)
// ---------------------------------------------------------------------------

type DomainStatus = 'ok' | 'warning' | 'error' | 'critical';

interface WebsiteRow {
  domain: string;
  status: DomainStatus;
  score: number;
  lastScan: string;
}

interface AiSystemRow {
  name: string;
  model: string;
  riskClass: string;
  riskScore: number;
  lastCheck: string;
  status: DomainStatus;
}

interface PolicyRow {
  name: string;
  framework: string;
  enabled: boolean;
  status: DomainStatus;
  lastCheck: string;
}

interface AlertRow {
  id: string;
  severity: 'Kritisch' | 'Hoch' | 'Mittel' | 'Niedrig';
  title: string;
  asset: string;
  detected: string;
  link: string;
}

// risk_score: höher = höheres Risiko (siehe governance-risk-score). Daraus die
// Ampel ableiten, damit die Farben der echten Datenlage entsprechen.
function statusFromRisk(score: number): DomainStatus {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'error';
  if (score >= 40) return 'warning';
  return 'ok';
}

function relTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffMin < 1440) return `vor ${Math.floor(diffMin / 60)} Std.`;
  const d = Math.floor(diffMin / 1440);
  return `vor ${d} Tag${d !== 1 ? 'en' : ''}`;
}

const AI_ACT_LABEL: Record<string, string> = {
  prohibited: 'Verboten', high: 'Hoch', limited: 'Begrenzt', minimal: 'Minimal', unknown: 'Unbekannt',
};

const POLICY_TYPE_LABEL: Record<string, string> = {
  data_transfer: 'Datentransfer', model_usage: 'Modellnutzung', human_review: 'Menschliche Prüfung',
  logging_required: 'Logging-Pflicht', vendor_restriction: 'Anbieter-Restriktion', retention: 'Aufbewahrung',
  security: 'Sicherheit', ai_act: 'EU AI Act', gdpr: 'DSGVO',
};

const RISK_LEVEL_TO_SEVERITY: Record<string, AlertRow['severity']> = {
  critical: 'Kritisch', high: 'Hoch', medium: 'Mittel', low: 'Niedrig', info: 'Niedrig',
};

function assetToWebsiteRow(a: DbGovernanceAsset): WebsiteRow {
  return {
    domain: a.system_url || a.name,
    status: statusFromRisk(a.risk_score),
    score: a.risk_score,
    lastScan: relTime(a.updated_at),
  };
}

function assetToAiSystemRow(a: DbGovernanceAsset): AiSystemRow {
  return {
    name: a.name,
    model: (a.metadata['model_name'] as string | undefined) ?? a.vendor ?? '–',
    riskClass: AI_ACT_LABEL[a.ai_act_class] ?? 'Unbekannt',
    riskScore: a.risk_score,
    lastCheck: relTime(a.updated_at),
    status: statusFromRisk(a.risk_score),
  };
}

function policyToRow(p: DbGovernancePolicy): PolicyRow {
  return {
    name: p.name,
    framework: POLICY_TYPE_LABEL[p.policy_type] ?? p.policy_type,
    enabled: p.enabled,
    status: p.enabled ? 'ok' : 'warning',
    lastCheck: relTime(p.updated_at),
  };
}

function eventToAlertRow(e: DbGovernanceEvent): AlertRow {
  return {
    id: e.id,
    severity: RISK_LEVEL_TO_SEVERITY[e.risk_level] ?? 'Niedrig',
    title: e.title,
    asset: e.vendor || e.event_source || '–',
    detected: relTime(e.created_at),
    link: e.asset_id ? `/app/assets/${e.asset_id}` : '/app/risks',
  };
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

type StatusColor = 'teal' | 'amber' | 'red' | 'orange';

function statusDotClass(status: DomainStatus): string {
  switch (status) {
    case 'ok':       return 'bg-teal-400';
    case 'warning':  return 'bg-amber-400';
    case 'error':    return 'bg-red-400';
    case 'critical': return 'bg-red-500';
  }
}

function statusTextClass(status: DomainStatus): string {
  switch (status) {
    case 'ok':       return 'text-teal-400';
    case 'warning':  return 'text-amber-400';
    case 'error':    return 'text-red-400';
    case 'critical': return 'text-red-500';
  }
}

function statusLabel(status: DomainStatus): string {
  switch (status) {
    case 'ok':       return 'OK';
    case 'warning':  return 'Warnung';
    case 'error':    return 'Fehler';
    case 'critical': return 'Kritisch';
  }
}

function severityColor(severity: AlertRow['severity']): string {
  switch (severity) {
    case 'Kritisch': return 'text-red-400';
    case 'Hoch':     return 'text-orange-400';
    case 'Mittel':   return 'text-amber-400';
    case 'Niedrig':  return 'text-teal-400';
  }
}

function severityDotClass(severity: AlertRow['severity']): string {
  switch (severity) {
    case 'Kritisch': return 'bg-red-400';
    case 'Hoch':     return 'bg-orange-400';
    case 'Mittel':   return 'bg-amber-400';
    case 'Niedrig':  return 'bg-teal-400';
  }
}

// Risk-Score-Färbung: höher = höheres Risiko = wärmere Farbe.
function riskScoreColor(score: number): string {
  if (score >= 80) return 'text-red-500';
  if (score >= 60) return 'text-red-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-teal-400';
}

// ---------------------------------------------------------------------------
// Unter-Komponenten
// ---------------------------------------------------------------------------

/** Metrikkachel in der Header-Reihe */
function MetricCard({
  label,
  value,
  valueClass = 'text-titanium-100',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 px-4 py-3 flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 whitespace-nowrap">
        {label}
      </span>
      <span className={`font-mono text-xl font-semibold tabular-nums leading-tight ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

/** Spalten-Überschrift für Tabellen */
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[10px] font-mono uppercase tracking-wider text-titanium-500 px-3 py-2 font-normal whitespace-nowrap">
      {children}
    </th>
  );
}

/** Status-Punkt + Label als Zellinhalt */
function StatusCell({ status }: { status: DomainStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${statusDotClass(status)}`} />
      <span className={`font-mono text-[11px] ${statusTextClass(status)}`}>
        {statusLabel(status)}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tab: Websites
// ---------------------------------------------------------------------------
/** Leerzeile/Hinweis innerhalb einer Tabelle */
function TabEmpty({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center font-mono text-[12px] text-titanium-500">
        {label}
      </td>
    </tr>
  );
}

function WebsitesTab({ rows, loading, hasTenant }: { rows: WebsiteRow[]; loading: boolean; hasTenant: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-titanium-900">
            <Th>Status</Th>
            <Th>Domain</Th>
            <Th>Letzte Aktualisierung</Th>
            <Th>Risk Score</Th>
            <Th>Aktionen</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TabEmpty colSpan={5} label="Wird geladen …" />
          ) : !hasTenant ? (
            <TabEmpty colSpan={5} label="Kein aktiver Arbeitsbereich." />
          ) : rows.length === 0 ? (
            <TabEmpty colSpan={5} label="Noch keine Websites registriert — über Scans hinzufügen." />
          ) : (
            rows.map((row) => (
              <tr
                key={row.domain}
                className="border-b border-titanium-900 hover:bg-obsidian-900/50 transition-colors"
              >
                <td className="px-3 py-2.5">
                  <StatusCell status={row.status} />
                </td>
                <td className="px-3 py-2.5 font-mono text-[12px] text-titanium-100">
                  {row.domain}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-400">
                  {row.lastScan}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`font-mono text-[12px] font-semibold ${riskScoreColor(row.score)}`}>
                    {row.score}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    to="/app/scans"
                    className="font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-2 py-0.5 transition-colors"
                  >
                    Details
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: KI-Systeme
// ---------------------------------------------------------------------------
function AiSystemsTab({ rows, loading, hasTenant }: { rows: AiSystemRow[]; loading: boolean; hasTenant: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-titanium-900">
            <Th>Status</Th>
            <Th>System</Th>
            <Th>Modell</Th>
            <Th>Letzte Aktualisierung</Th>
            <Th>Risk Class</Th>
            <Th>Risk Score</Th>
            <Th>Aktionen</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TabEmpty colSpan={7} label="Wird geladen …" />
          ) : !hasTenant ? (
            <TabEmpty colSpan={7} label="Kein aktiver Arbeitsbereich." />
          ) : rows.length === 0 ? (
            <TabEmpty colSpan={7} label="Noch keine KI-Systeme registriert — im KI-System-Register anlegen." />
          ) : (
            rows.map((row) => (
              <tr
                key={row.name}
                className="border-b border-titanium-900 hover:bg-obsidian-900/50 transition-colors"
              >
                <td className="px-3 py-2.5">
                  <StatusCell status={row.status} />
                </td>
                <td className="px-3 py-2.5 text-titanium-100 text-[12px]">
                  {row.name}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-400">
                  {row.model}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-400">
                  {row.lastCheck}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 border ${
                      row.riskClass === 'Hoch' || row.riskClass === 'Verboten'
                        ? 'text-red-400 border-red-900 bg-red-950/30'
                        : 'text-amber-400 border-amber-900 bg-amber-950/30'
                    }`}
                  >
                    {row.riskClass}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`font-mono text-[12px] font-semibold ${riskScoreColor(row.riskScore)}`}>
                    {row.riskScore}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    to="/app/ai-systems"
                    className="font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-2 py-0.5 transition-colors"
                  >
                    Details
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Dokumente
// ---------------------------------------------------------------------------
function DokumenteTab() {
  // Für Dokumente existiert noch keine Live-Datenquelle in dieser Ansicht
  // (generated_documents ist noch nicht angebunden). Statt fabrizierter
  // Beispiel-Dokumente ein ehrlicher Hinweis mit Verweis auf die echte Ansicht.
  return (
    <div className="px-6 py-10 text-center">
      <p className="font-mono text-[12px] text-titanium-400">
        Dokumenten-Monitoring wird hier in Kürze live angebunden.
      </p>
      <p className="mt-1 font-mono text-[11px] text-titanium-600">
        Deine erzeugten Compliance-Dokumente findest du bereits unter{' '}
        <Link to="/app/documents" className="text-teal-400 hover:text-teal-300 underline">
          Dokumente
        </Link>.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Richtlinien
// ---------------------------------------------------------------------------
function RichtlinienTab({ rows, loading, hasTenant }: { rows: PolicyRow[]; loading: boolean; hasTenant: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-titanium-900">
            <Th>Status</Th>
            <Th>Richtlinie</Th>
            <Th>Typ</Th>
            <Th>Letzte Änderung</Th>
            <Th>Aktiv</Th>
            <Th>Aktionen</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TabEmpty colSpan={6} label="Wird geladen …" />
          ) : !hasTenant ? (
            <TabEmpty colSpan={6} label="Kein aktiver Arbeitsbereich." />
          ) : rows.length === 0 ? (
            <TabEmpty colSpan={6} label="Noch keine Richtlinien definiert." />
          ) : (
            rows.map((row) => (
              <tr
                key={row.name}
                className="border-b border-titanium-900 hover:bg-obsidian-900/50 transition-colors"
              >
                <td className="px-3 py-2.5">
                  <StatusCell status={row.status} />
                </td>
                <td className="px-3 py-2.5 text-titanium-100 text-[12px]">
                  {row.name}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-500">
                  {row.framework}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-400">
                  {row.lastCheck}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-400">
                  {row.enabled ? 'Ja' : 'Nein'}
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    to="/app/policies/templates"
                    className="font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-2 py-0.5 transition-colors"
                  >
                    Prüfen
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sektion 3: Aktive Alerts
// ---------------------------------------------------------------------------
function ActiveAlertsPanel({ alerts, loading }: { alerts: AlertRow[]; loading: boolean }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-titanium-900">
        <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">
          Aktive Alerts
        </span>
        <span className="ml-2 font-mono text-[10px] text-red-400 bg-red-950/40 border border-red-900 px-1.5 py-0.5">
          {alerts.length}
        </span>
      </div>
      <div className="divide-y divide-titanium-900 flex-1">
        {loading && (
          <div className="px-4 py-6 font-mono text-[11px] text-titanium-500">Wird geladen …</div>
        )}
        {!loading && alerts.length === 0 && (
          <div className="px-4 py-6 font-mono text-[11px] text-titanium-500">
            Keine offenen Alerts — keine kritischen oder hohen Ereignisse in den letzten Meldungen.
          </div>
        )}
        {alerts.map((alert) => (
          <div key={alert.id} className="px-4 py-3 hover:bg-obsidian-900/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className={`inline-block h-2 w-2 rounded-full shrink-0 mt-1.5 ${severityDotClass(alert.severity)}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-mono text-[10px] uppercase tracking-wider ${severityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="font-mono text-[10px] text-titanium-500">
                      {alert.detected}
                    </span>
                  </div>
                  <p className="text-[12px] text-titanium-100 mt-0.5 leading-snug">
                    {alert.title}
                  </p>
                  <p className="font-mono text-[10px] text-titanium-500 mt-0.5">
                    {alert.asset}
                  </p>
                </div>
              </div>
              <Link
                to={alert.link}
                className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-2 py-0.5 transition-colors whitespace-nowrap"
              >
                Anzeigen
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sektion 3: Alert-Regeln
// ---------------------------------------------------------------------------
function AlertRulesPanel({ tenantId }: { tenantId: string | null }) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tenantId) { setRules([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadAlertRules(tenantId)
      .then((r) => { if (!cancelled) setRules(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId]);

  async function toggleRule(rule: AlertRule) {
    const next = !rule.active;
    // Optimistisch umschalten, bei Fehler zurückrollen.
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: next } : r)));
    try {
      await setAlertRuleActive(rule.id, next);
    } catch {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: rule.active } : r)));
      setError('Speichern fehlgeschlagen.');
    }
  }

  async function confirmAdd() {
    const name = newName.trim();
    if (!name || !tenantId) return;
    setBusy(true);
    try {
      const created = await addCustomAlertRule(tenantId, name, 'Dashboard');
      setRules((prev) => [...prev, created]);
      setNewName('');
      setAdding(false);
    } catch {
      setError('Regel konnte nicht angelegt werden.');
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(rule: AlertRule) {
    const snapshot = rules;
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    try {
      await deleteAlertRule(rule.id);
    } catch {
      setRules(snapshot);
      setError('Löschen fehlgeschlagen.');
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-titanium-900">
        <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">
          Alert-Regeln
        </span>
      </div>
      <div className="divide-y divide-titanium-900 flex-1">
        {loading && (
          <div className="px-4 py-6 font-mono text-[11px] text-titanium-500">Wird geladen …</div>
        )}
        {!loading && !tenantId && (
          <div className="px-4 py-6 font-mono text-[11px] text-titanium-500">Kein aktiver Arbeitsbereich.</div>
        )}
        {!loading && tenantId && rules.length === 0 && (
          <div className="px-4 py-6 font-mono text-[11px] text-titanium-500">Noch keine Regeln.</div>
        )}
        {rules.map((rule) => (
          <div key={rule.id} className="px-4 py-2.5 hover:bg-obsidian-900/50 transition-colors group">
            <div className="flex items-center gap-3">
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggleRule(rule)}
                className={`relative inline-flex h-4 w-7 shrink-0 items-center border-0 transition-colors focus:outline-none ${
                  rule.active ? 'bg-teal-500' : 'bg-titanium-700'
                }`}
                aria-label={rule.active ? 'Deaktivieren' : 'Aktivieren'}
              >
                <span
                  className={`inline-block h-3 w-3 bg-white transition-transform ${
                    rule.active ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-[12px] text-titanium-100 leading-tight block truncate">
                  {rule.name}
                </span>
                <span className="font-mono text-[10px] text-titanium-500">
                  {rule.channels}
                </span>
              </div>
              {rule.is_custom && (
                <button
                  type="button"
                  onClick={() => removeRule(rule)}
                  className="font-mono text-[11px] text-titanium-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Regel entfernen"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <div className="px-4 py-2 font-mono text-[10px] text-red-400 border-t border-red-900/50">{error}</div>
      )}
      <div className="px-4 py-3 border-t border-titanium-900">
        {adding ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
              placeholder="Regelname …"
              autoFocus
              className="w-full bg-obsidian-950 border border-titanium-800 px-2 py-1.5 text-[12px] text-titanium-100 placeholder:text-titanium-600 focus:outline-none focus:border-teal-700"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmAdd}
                disabled={busy || !newName.trim()}
                className="flex-1 font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-3 py-1.5 transition-colors disabled:opacity-40"
              >
                {busy ? 'Speichert …' : 'Anlegen'}
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewName(''); }}
                className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 hover:text-titanium-300 border border-titanium-800 px-3 py-1.5 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={!tenantId}
            className="w-full font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-3 py-1.5 transition-colors disabled:opacity-40"
          >
            + Regel hinzufügen
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Haupt-Komponente
// ---------------------------------------------------------------------------

type AssetTab = 'websites' | 'ki-systeme' | 'dokumente' | 'richtlinien';

const TAB_LABELS: Record<AssetTab, string> = {
  'websites':   'Websites',
  'ki-systeme': 'KI-Systeme',
  'dokumente':  'Dokumente',
  'richtlinien': 'Richtlinien',
};

export function MonitoringRuntimeView() {
  const { activeTenantId } = useTenant();
  // Echte Werte: Default '–' statt fabrizierter Zahlen. Erst nach dem Laden
  // werden reale Counts/Zeilen gesetzt; ohne Tenant/Daten bleibt '–' sichtbar.
  const [assetCount, setAssetCount] = useState<string>('–');
  const [alertCount, setAlertCount] = useState<string>('–');
  const [lastCheck, setLastCheck] = useState<string>('–');
  const [activeTab, setActiveTab] = useState<AssetTab>('websites');
  const [loading, setLoading] = useState(true);
  const [websiteRows, setWebsiteRows] = useState<WebsiteRow[]>([]);
  const [aiSystemRows, setAiSystemRows] = useState<AiSystemRow[]>([]);
  const [policyRows, setPolicyRows] = useState<PolicyRow[]>([]);
  const [alertRows, setAlertRows] = useState<AlertRow[]>([]);

  useEffect(() => {
    if (!activeTenantId) {
      setAssetCount('–');
      setAlertCount('–');
      setLastCheck('–');
      setWebsiteRows([]);
      setAiSystemRows([]);
      setPolicyRows([]);
      setAlertRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    fetchTenantAssets(activeTenantId).then((a) => {
      if (cancelled) return;
      setAssetCount(String(a.length));
      setWebsiteRows(a.filter((x) => x.asset_type === 'website').map(assetToWebsiteRow));
      setAiSystemRows(a.filter((x) => x.asset_type === 'ai_system').map(assetToAiSystemRow));
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });

    fetchTenantPolicies(activeTenantId).then((p) => {
      if (!cancelled) setPolicyRows(p.map(policyToRow));
    }).catch(() => {});

    countOpenIncidents(activeTenantId).then((n) => {
      if (!cancelled) setAlertCount(String(n));
    }).catch(() => {});

    fetchTenantEvents(activeTenantId, 50).then((evs) => {
      if (cancelled) return;
      if (evs.length > 0) setLastCheck(relTime(evs[0].created_at));
      else setLastCheck('Keine Prüfung');
      setAlertRows(
        evs.filter((e) => e.risk_level === 'critical' || e.risk_level === 'high')
          .slice(0, 8)
          .map(eventToAlertRow),
      );
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [activeTenantId]);


  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">

      {/* ── Sektion 1: Header + Coverage-Metriken ── */}
      <section className="border-b border-titanium-900">
        {/* Header-Zeile */}
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 border-b border-titanium-900">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold tracking-tight text-titanium-50 leading-none">
                Monitoring Runtime
              </h1>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-teal-400">
                <span className="inline-block h-2 w-2 rounded-full bg-teal-400 motion-safe:animate-pulse" />
                AKTIV
              </span>
            </div>
            <p className="mt-1 font-mono text-[10px] text-titanium-500 uppercase tracking-wider">
              24/7 · EU-lokal · DSGVO &amp; EU AI Act
            </p>
          </div>
        </div>

        {/* Metriken-Reihe */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-titanium-900">
          <MetricCard label="Überwachte Assets" value={assetCount} />
          <MetricCard label="Scans heute"        value="–" />
          <MetricCard label="Aktive Alerts"      value={alertCount} valueClass="text-red-400" />
          <MetricCard label="Letzte Prüfung"     value={lastCheck} valueClass="text-teal-400" />
          <MetricCard label="Nächste Prüfung"    value="–" />
        </div>
      </section>

      {/* ── Sektion 2: Asset Monitoring Status (Tabs) ── */}
      <section className="border-b border-titanium-900">
        {/* Tab-Leiste */}
        <div className="flex border-b border-titanium-900 px-6 pt-4">
          {(Object.keys(TAB_LABELS) as AssetTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'pb-2 px-4 font-mono text-[11px] uppercase tracking-wider transition-colors border-b-2 -mb-px',
                activeTab === tab
                  ? 'border-teal-400 text-titanium-50'
                  : 'border-transparent text-titanium-500 hover:text-titanium-200',
              ].join(' ')}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Tab-Inhalt */}
        <div className="py-2">
          {activeTab === 'websites'    && <WebsitesTab rows={websiteRows} loading={loading} hasTenant={!!activeTenantId} />}
          {activeTab === 'ki-systeme'  && <AiSystemsTab rows={aiSystemRows} loading={loading} hasTenant={!!activeTenantId} />}
          {activeTab === 'dokumente'   && <DokumenteTab />}
          {activeTab === 'richtlinien' && <RichtlinienTab rows={policyRows} loading={loading} hasTenant={!!activeTenantId} />}
        </div>
      </section>

      {/* ── Sektion 3: Alerts + Regeln ── */}
      <section className="border-b border-titanium-900">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-titanium-900">
          {/* Linke Spalte — Aktive Alerts (2/3) */}
          <div className="lg:col-span-2">
            <ActiveAlertsPanel alerts={alertRows} loading={loading} />
          </div>
          {/* Rechte Spalte — Alert-Regeln (1/3) */}
          <div>
            <AlertRulesPanel tenantId={activeTenantId} />
          </div>
        </div>
      </section>

      {/* ── Sektion 4: Live Event Stream ── */}
      <section>
        {/* Stream-Header */}
        <div className="px-6 py-3 border-b border-titanium-900 flex items-center gap-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">
            Live Event Stream
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-teal-400">
            <span className="inline-block h-2 w-2 rounded-full bg-teal-400 motion-safe:animate-pulse" />
            Echtzeit
          </span>
          <span className="ml-auto font-mono text-[10px] text-titanium-500">
            Letzte 24 Stunden · Live-Feed
          </span>
        </div>
        {/* Embedded Feed */}
        <MonitoringSurface embedded />
      </section>
    </div>
  );
}
