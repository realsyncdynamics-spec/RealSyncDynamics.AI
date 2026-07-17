// MonitoringRuntimeView.tsx — P6 Monitoring Runtime Dashboard
// 24/7 DSGVO & EU AI Act Governance Operating System
// Abschnitte: Header + Metriken · Asset-Status (Tabs) · Alerts + Regeln · Live Feed

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MonitoringSurface } from '../../../pages/MonitoringPage';
import { useTenant } from '../../../core/access/TenantProvider';
import { fetchTenantAssets, fetchTenantEvents } from '../governanceApi';
import { countOpenIncidents } from '../incidentsApi';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../withPerformanceMonitoring';

// ---------------------------------------------------------------------------
// Mock-Daten
// ---------------------------------------------------------------------------

type DomainStatus = 'ok' | 'warning' | 'error' | 'critical';

interface WebsiteRow {
  domain: string;
  status: DomainStatus;
  score: number;
  findings: number;
  lastScan: string;
  nextScan: string;
  frequency: string;
}

const WEBSITE_STATUS: WebsiteRow[] = [
  { domain: 'atelier-nord.de',         status: 'ok',       score: 92, findings: 1, lastScan: 'vor 3 Min.', nextScan: '07:45', frequency: 'Täglich 06:00' },
  { domain: 'shop.atelier-nord.de',    status: 'warning',  score: 68, findings: 4, lastScan: 'vor 3 Min.', nextScan: '07:45', frequency: 'Täglich 06:00' },
  { domain: 'blog.atelier-nord.de',    status: 'error',    score: 54, findings: 6, lastScan: 'vor 3 Min.', nextScan: '07:45', frequency: 'Täglich 06:00' },
  { domain: 'app.atelier-nord.de',     status: 'critical', score: 38, findings: 9, lastScan: 'vor 3 Min.', nextScan: '07:45', frequency: 'Täglich 06:00' },
  { domain: 'partner.atelier-nord.de', status: 'ok',       score: 88, findings: 2, lastScan: 'vor 3 Min.', nextScan: '07:45', frequency: 'Täglich 06:00' },
];

interface AiSystemRow {
  name: string;
  model: string;
  riskClass: string;
  compliance: number;
  lastCheck: string;
  status: DomainStatus;
}

const AI_SYSTEM_STATUS: AiSystemRow[] = [
  { name: 'CV-Screening HR-Tool',        model: 'HR-AI Suite v4.1',   riskClass: 'Hoch',      compliance: 33,  lastCheck: 'vor 1 Std.',  status: 'critical' },
  { name: 'Fraud Detection',             model: 'FraudGuard API v2',  riskClass: 'Hoch',      compliance: 58,  lastCheck: 'vor 1 Std.',  status: 'warning'  },
  { name: 'Produktempfehlung Shop',      model: 'Custom v2.3',        riskClass: 'Begrenzt',  compliance: 75,  lastCheck: 'vor 2 Std.',  status: 'warning'  },
  { name: 'Support-Chatbot Kodee',       model: 'claude-haiku-4-5',   riskClass: 'Begrenzt',  compliance: 100, lastCheck: 'vor 2 Std.',  status: 'ok'       },
  { name: 'Content-Moderations-KI',      model: 'gpt-4o-mini',        riskClass: 'Begrenzt',  compliance: 88,  lastCheck: 'vor 3 Std.',  status: 'ok'       },
];

interface DocumentRow {
  name: string;
  version: string;
  lastChanged: string;
  validUntil: string | null;
  owner: string;
  status: DomainStatus;
}

const DOCUMENT_STATUS: DocumentRow[] = [
  { name: 'Datenschutzerklärung',            version: 'v3.2',      lastChanged: '14.06.2026', validUntil: '14.06.2027', owner: 'L. Vogel',  status: 'ok'       },
  { name: 'AVV — Brevo',                     version: 'v1',        lastChanged: '05.06.2026', validUntil: '05.06.2027', owner: 'M. Brandt', status: 'ok'       },
  { name: 'Verarbeitungsverzeichnis',         version: 'v2025.4',  lastChanged: '01.03.2026', validUntil: '01.03.2027', owner: 'L. Vogel',  status: 'warning'  },
  { name: 'TOM-Dokumentation',               version: 'v2026.1',  lastChanged: '08.06.2026', validUntil: '08.06.2027', owner: 'M. Brandt', status: 'ok'       },
  { name: 'Impressum',                       version: 'v2.1',     lastChanged: '01.01.2026', validUntil: null,          owner: 'T. Younes', status: 'warning'  },
  { name: 'DSFA Empfehlungsalgorithmus',      version: 'Entwurf',  lastChanged: '—',          validUntil: null,          owner: 'M. Brandt', status: 'critical' },
];

interface PolicyRow {
  name: string;
  framework: string;
  status: DomainStatus | 'error';
  lastCheck: string;
  nextCheck: string;
}

const POLICY_STATUS: PolicyRow[] = [
  { name: 'Cookie Consent Policy',             framework: 'TDDDG §25',          status: 'error',   lastCheck: '16.06.2026', nextCheck: '23.06.2026' },
  { name: 'Drittlandtransfer Policy',          framework: 'DSGVO Art. 44-46',   status: 'warning', lastCheck: '16.06.2026', nextCheck: '23.06.2026' },
  { name: 'Datenschutz-Grundsätze',            framework: 'DSGVO Art. 5',       status: 'ok',      lastCheck: '16.06.2026', nextCheck: '30.06.2026' },
  { name: 'EU AI Act Compliance Policy',        framework: 'EU AI Act Art. 6',   status: 'warning', lastCheck: '16.06.2026', nextCheck: '23.06.2026' },
  { name: 'Incident Response Plan',            framework: 'DSGVO Art. 33',      status: 'ok',      lastCheck: '08.06.2026', nextCheck: '08.07.2026' },
  { name: 'Sub-Prozessoren-Vertragspflichten', framework: 'DSGVO Art. 28',      status: 'warning', lastCheck: '05.06.2026', nextCheck: '05.07.2026' },
];

interface AlertRow {
  id: string;
  severity: 'Kritisch' | 'Hoch' | 'Mittel' | 'Niedrig';
  title: string;
  asset: string;
  detected: string;
  link: string;
}

const ACTIVE_ALERTS: AlertRow[] = [
  { id: 'al-1', severity: 'Kritisch', title: 'Meta Pixel Pre-Consent auf app.atelier-nord.de',  asset: 'app.atelier-nord.de',  detected: 'vor 2 Std.',    link: '/app/risks' },
  { id: 'al-2', severity: 'Hoch',     title: 'Cookie-Banner ohne granulare Kategorien',          asset: 'blog.atelier-nord.de', detected: 'vor 9 Std.',    link: '/app/risks' },
  { id: 'al-3', severity: 'Hoch',     title: 'Unbekannter Tracker analytics.partner.io',         asset: 'shop.atelier-nord.de', detected: 'vor 4 Std.',    link: '/app/risks' },
  { id: 'al-4', severity: 'Mittel',   title: 'Google Fonts Drittlandtransfer ohne SCC',          asset: 'atelier-nord.de',      detected: 'vor 3 Tagen',   link: '/app/risks' },
];

interface AlertRuleRow {
  id: string;
  name: string;
  active: boolean;
  channels: string;
}

const INITIAL_ALERT_RULES: AlertRuleRow[] = [
  { id: 'r-1', name: 'Neuer Tracker erkannt',        active: true,  channels: 'E-Mail + Dashboard' },
  { id: 'r-2', name: 'Pre-Consent Tracking',         active: true,  channels: 'E-Mail + Dashboard' },
  { id: 'r-3', name: 'Score unter 60',               active: true,  channels: 'Dashboard'          },
  { id: 'r-4', name: 'KI-System ohne Dokumentation', active: true,  channels: 'E-Mail'             },
  { id: 'r-5', name: 'Dokument abgelaufen',          active: false, channels: 'E-Mail'             },
  { id: 'r-6', name: 'Drittland-Transfer ohne SCC',  active: true,  channels: 'E-Mail + Dashboard' },
  { id: 'r-7', name: 'SSL-Zertifikat < 30 Tage',    active: true,  channels: 'Dashboard'          },
];

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

function scoreColor(score: number): string {
  if (score >= 80) return 'text-teal-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function complianceColor(pct: number): string {
  if (pct >= 80) return 'text-teal-400';
  if (pct >= 60) return 'text-amber-400';
  return 'text-red-400';
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
function WebsitesTab() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-titanium-900">
            <Th>Status</Th>
            <Th>Domain</Th>
            <Th>Letzter Scan</Th>
            <Th>Score</Th>
            <Th>Findings</Th>
            <Th>Nächster Scan</Th>
            <Th>Frequenz</Th>
            <Th>Aktionen</Th>
          </tr>
        </thead>
        <tbody>
          {WEBSITE_STATUS.map((row) => (
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
                <span className={`font-mono text-[12px] font-semibold ${scoreColor(row.score)}`}>
                  {row.score}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className={`font-mono text-[12px] ${row.findings > 0 ? 'text-amber-400' : 'text-teal-400'}`}>
                  {row.findings}
                </span>
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-400">
                {row.nextScan}
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-500">
                {row.frequency}
              </td>
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  className="font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-2 py-0.5 transition-colors"
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: KI-Systeme
// ---------------------------------------------------------------------------
function AiSystemsTab() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-titanium-900">
            <Th>Status</Th>
            <Th>System</Th>
            <Th>Modell</Th>
            <Th>Letzte Prüfung</Th>
            <Th>Risk Class</Th>
            <Th>Compliance</Th>
            <Th>Aktionen</Th>
          </tr>
        </thead>
        <tbody>
          {AI_SYSTEM_STATUS.map((row) => (
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
                    row.riskClass === 'Hoch'
                      ? 'text-red-400 border-red-900 bg-red-950/30'
                      : 'text-amber-400 border-amber-900 bg-amber-950/30'
                  }`}
                >
                  {row.riskClass}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className={`font-mono text-[12px] font-semibold ${complianceColor(row.compliance)}`}>
                  {row.compliance}%
                </span>
              </td>
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  className="font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-2 py-0.5 transition-colors"
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Dokumente
// ---------------------------------------------------------------------------
function DokumenteTab() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-titanium-900">
            <Th>Status</Th>
            <Th>Dokument</Th>
            <Th>Version</Th>
            <Th>Letzte Änderung</Th>
            <Th>Gültig bis</Th>
            <Th>Verantwortlicher</Th>
            <Th>Aktionen</Th>
          </tr>
        </thead>
        <tbody>
          {DOCUMENT_STATUS.map((row) => (
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
                {row.version}
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-400">
                {row.lastChanged}
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-400">
                {row.validUntil ?? '—'}
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-titanium-400">
                {row.owner}
              </td>
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  className="font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-2 py-0.5 transition-colors"
                >
                  Ansehen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Richtlinien
// ---------------------------------------------------------------------------
function RichtlinienTab() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-titanium-900">
            <Th>Status</Th>
            <Th>Richtlinie</Th>
            <Th>Framework</Th>
            <Th>Letzte Prüfung</Th>
            <Th>Nächste Prüfung</Th>
            <Th>Aktionen</Th>
          </tr>
        </thead>
        <tbody>
          {POLICY_STATUS.map((row) => (
            <tr
              key={row.name}
              className="border-b border-titanium-900 hover:bg-obsidian-900/50 transition-colors"
            >
              <td className="px-3 py-2.5">
                <StatusCell status={row.status as DomainStatus} />
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
                {row.nextCheck}
              </td>
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  className="font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-2 py-0.5 transition-colors"
                >
                  Prüfen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sektion 3: Aktive Alerts
// ---------------------------------------------------------------------------
function ActiveAlertsPanel() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-titanium-900">
        <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">
          Aktive Alerts
        </span>
        <span className="ml-2 font-mono text-[10px] text-red-400 bg-red-950/40 border border-red-900 px-1.5 py-0.5">
          {ACTIVE_ALERTS.length}
        </span>
      </div>
      <div className="divide-y divide-titanium-900 flex-1">
        {ACTIVE_ALERTS.map((alert) => (
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
function AlertRulesPanel() {
  const [rules, setRules] = useState<AlertRuleRow[]>(INITIAL_ALERT_RULES);

  function toggleRule(id: string) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-titanium-900">
        <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">
          Alert-Regeln
        </span>
      </div>
      <div className="divide-y divide-titanium-900 flex-1">
        {rules.map((rule) => (
          <div key={rule.id} className="px-4 py-2.5 hover:bg-obsidian-900/50 transition-colors">
            <div className="flex items-center gap-3">
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggleRule(rule.id)}
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
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-titanium-900">
        <button
          type="button"
          className="w-full font-mono text-[10px] uppercase tracking-wider text-teal-400 hover:text-teal-300 border border-teal-900 hover:border-teal-700 px-3 py-1.5 transition-colors"
        >
          + Regel hinzufügen
        </button>
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

function Inner() {
  const { activeTenantId } = useTenant();
  const [assetCount, setAssetCount] = useState<string>('18');
  const [alertCount, setAlertCount] = useState<string>('4');
  const [lastCheck, setLastCheck] = useState<string>('vor 3 Min.');
  const [activeTab, setActiveTab] = useState<AssetTab>('websites');

  useEffect(() => {
    if (!activeTenantId) return;
    fetchTenantAssets(activeTenantId).then((a) => {
      if (a.length > 0) setAssetCount(String(a.length));
    }).catch(() => {});
    countOpenIncidents(activeTenantId).then((n) => setAlertCount(String(n))).catch(() => {});
    fetchTenantEvents(activeTenantId, 1).then((evs) => {
      if (evs.length > 0) {
        const diffMs = Date.now() - new Date(evs[0].created_at).getTime();
        const diffMin = Math.floor(diffMs / 60_000);
        const ts = diffMin < 60 ? `vor ${diffMin} Min.`
          : diffMin < 1440 ? `vor ${Math.floor(diffMin / 60)} Std.`
          : `vor ${Math.floor(diffMin / 1440)} Tag${Math.floor(diffMin / 1440) !== 1 ? 'en' : ''}`;
        setLastCheck(ts);
      }
    }).catch(() => {});
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
          <MetricCard label="Scans heute"        value="142" />
          <MetricCard label="Aktive Alerts"      value={alertCount} valueClass="text-red-400" />
          <MetricCard label="Letzte Prüfung"     value={lastCheck} valueClass="text-teal-400" />
          <MetricCard label="Nächste Prüfung"    value="07:45" />
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
          {activeTab === 'websites'    && <WebsitesTab />}
          {activeTab === 'ki-systeme'  && <AiSystemsTab />}
          {activeTab === 'dokumente'   && <DokumenteTab />}
          {activeTab === 'richtlinien' && <RichtlinienTab />}
        </div>
      </section>

      {/* ── Sektion 3: Alerts + Regeln ── */}
      <section className="border-b border-titanium-900">
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-titanium-900">
          {/* Linke Spalte — Aktive Alerts (2/3) */}
          <div className="lg:col-span-2">
            <ActiveAlertsPanel />
          </div>
          {/* Rechte Spalte — Alert-Regeln (1/3) */}
          <div>
            <AlertRulesPanel />
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

function _MonitoringRuntimeView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const MonitoringRuntimeView = withPerformanceMonitoring(
  _MonitoringRuntimeView,
  'MonitoringRuntimeView',
  { threshold: 500, maxRenders: 10 }
);
