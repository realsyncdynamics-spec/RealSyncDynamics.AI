import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../../core/access/TenantProvider';
import { fetchTenantAssets, type DbGovernanceAsset } from '../governanceApi';
import {
  ArrowLeft,
  Bot,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  FileText,
  Tag,
  Shield,
} from 'lucide-react';

// ── Typen ─────────────────────────────────────────────────────────────────────

type RiskClass = 'Verboten' | 'Hoch' | 'Begrenzt' | 'Minimal';
type SystemStatus = 'In Betrieb' | 'In Entwicklung' | 'Eingestellt' | 'Pausiert';

interface AiSystem {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  riskClass: RiskClass;
  scope: string;
  owner: string;
  status: SystemStatus;
  docProgress: number;
  docTotal: number;
  lastUpdated: string;
  obligations: string[];
  obligationsDone: boolean[];
}

// ── Mock-Daten ─────────────────────────────────────────────────────────────────

const AI_SYSTEMS: AiSystem[] = [
  {
    id: 'ais-001',
    name: 'Produktempfehlung Shop',
    description: 'Personalisierte Produktvorschläge im Checkout-Prozess auf Basis des Browserverhaltens',
    provider: 'Intern',
    model: 'Custom Recommendation Engine v2.3',
    riskClass: 'Begrenzt',
    scope: 'E-Commerce · Shop-Personalisierung',
    owner: 'Team Commerce',
    status: 'In Betrieb',
    docProgress: 6,
    docTotal: 8,
    lastUpdated: '15.06.2026',
    obligations: ['Transparenzhinweis', 'Nutzer-Information'],
    obligationsDone: [true, true],
  },
  {
    id: 'ais-002',
    name: 'Support-Chatbot "Kodee"',
    description: 'Automatisierte Erstantwort im Kundensupport, eskaliert bei komplexen Anfragen an Mensch',
    provider: 'Anthropic',
    model: 'claude-haiku-4-5-20251001',
    riskClass: 'Begrenzt',
    scope: 'Kundenservice · Erstantwort',
    owner: 'Team Support',
    status: 'In Betrieb',
    docProgress: 8,
    docTotal: 8,
    lastUpdated: '10.06.2026',
    obligations: ['Transparenzhinweis', 'Nutzer-Information'],
    obligationsDone: [true, true],
  },
  {
    id: 'ais-003',
    name: 'CV-Screening HR-Tool',
    description: 'Automatische Vorauswahl von Bewerbungsunterlagen anhand definierter Kriterien',
    provider: 'Extern',
    model: 'HR-AI Suite v4.1',
    riskClass: 'Hoch',
    scope: 'Human Resources · Recruiting',
    owner: 'Team People',
    status: 'In Betrieb',
    docProgress: 4,
    docTotal: 12,
    lastUpdated: '09.06.2026',
    obligations: [
      'Konformitätsbewertung', 'Risikomanagement-System', 'Datenverwaltung',
      'Technische Dokumentation', 'Transparenz', 'Menschliche Aufsicht',
      'Robustheit & Sicherheit', 'Genauigkeit', 'Registrierung EU-Datenbank',
      'Konformitätserklärung', 'CE-Kennzeichnung', 'Post-Market Monitoring',
    ],
    obligationsDone: [false, false, true, false, false, false, false, true, false, false, false, false],
  },
  {
    id: 'ais-004',
    name: 'Dynamic Pricing Engine',
    description: 'Automatische Preisanpassung basierend auf Nachfrage, Wettbewerb und Lagerbestand',
    provider: 'Intern',
    model: 'Pricing ML v1.7',
    riskClass: 'Begrenzt',
    scope: 'E-Commerce · Preisgestaltung',
    owner: 'Team Commerce',
    status: 'In Betrieb',
    docProgress: 5,
    docTotal: 8,
    lastUpdated: '08.06.2026',
    obligations: ['Transparenzhinweis', 'Nutzer-Information'],
    obligationsDone: [false, true],
  },
  {
    id: 'ais-005',
    name: 'Compliance Monitor',
    description: 'KI-gestützte Überwachung von Website-Compliance und Datenschutz-Verstößen',
    provider: 'RealSync',
    model: 'Governance Engine v3',
    riskClass: 'Minimal',
    scope: 'Compliance · Monitoring',
    owner: 'Team Compliance',
    status: 'In Betrieb',
    docProgress: 3,
    docTotal: 3,
    lastUpdated: '16.06.2026',
    obligations: ['Freiwilliger Verhaltenskodex'],
    obligationsDone: [true],
  },
  {
    id: 'ais-006',
    name: 'Fraud Detection',
    description: 'Echtzeit-Erkennung von betrügerischen Transaktionen im Shop',
    provider: 'Extern',
    model: 'FraudGuard API v2',
    riskClass: 'Hoch',
    scope: 'Zahlungsabwicklung · Sicherheit',
    owner: 'Team Commerce',
    status: 'In Betrieb',
    docProgress: 7,
    docTotal: 12,
    lastUpdated: '07.06.2026',
    obligations: [
      'Konformitätsbewertung', 'Risikomanagement-System', 'Datenverwaltung',
      'Technische Dokumentation', 'Transparenz', 'Menschliche Aufsicht',
      'Robustheit & Sicherheit', 'Genauigkeit', 'Registrierung EU-Datenbank',
      'Konformitätserklärung', 'CE-Kennzeichnung', 'Post-Market Monitoring',
    ],
    obligationsDone: [true, true, true, true, false, true, true, false, false, false, false, false],
  },
  {
    id: 'ais-007',
    name: 'Content-Moderations-KI',
    description: 'Automatische Prüfung von nutzergenerierten Inhalten auf Richtlinienkonformität',
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    riskClass: 'Begrenzt',
    scope: 'Content · Moderation',
    owner: 'Team Platform',
    status: 'In Betrieb',
    docProgress: 7,
    docTotal: 8,
    lastUpdated: '05.06.2026',
    obligations: ['Transparenzhinweis', 'Nutzer-Information'],
    obligationsDone: [true, false],
  },
  {
    id: 'ais-008',
    name: 'Inventory Forecast',
    description: 'Bestandsprognose und automatische Nachbestellungsempfehlungen',
    provider: 'Intern',
    model: 'Forecast ML v2.0',
    riskClass: 'Minimal',
    scope: 'Logistik · Bestandsmanagement',
    owner: 'Team Operations',
    status: 'In Betrieb',
    docProgress: 3,
    docTotal: 3,
    lastUpdated: '04.06.2026',
    obligations: ['Freiwilliger Verhaltenskodex'],
    obligationsDone: [true],
  },
  {
    id: 'ais-009',
    name: 'SEO Content Assistant',
    description: 'KI-Unterstützung bei der Erstellung von SEO-optimierten Produktbeschreibungen',
    provider: 'Anthropic',
    model: 'claude-sonnet-4-6',
    riskClass: 'Minimal',
    scope: 'Marketing · Content',
    owner: 'Team Marketing',
    status: 'In Betrieb',
    docProgress: 3,
    docTotal: 3,
    lastUpdated: '03.06.2026',
    obligations: ['Freiwilliger Verhaltenskodex'],
    obligationsDone: [true],
  },
  {
    id: 'ais-010',
    name: 'Kundenabwanderungs-Prognose',
    description: 'Vorhersage der Wahrscheinlichkeit, dass Kunden ihren Vertrag kündigen',
    provider: 'Intern',
    model: 'Churn Model v1.2',
    riskClass: 'Minimal',
    scope: 'CRM · Kundenbindung',
    owner: 'Team Customer Success',
    status: 'In Entwicklung',
    docProgress: 1,
    docTotal: 3,
    lastUpdated: '01.06.2026',
    obligations: ['Freiwilliger Verhaltenskodex'],
    obligationsDone: [false],
  },
  {
    id: 'ais-011',
    name: 'Smart Email Campaign AI',
    description: 'Automatische Personalisierung und Sendzeitoptimierung für E-Mail-Kampagnen',
    provider: 'Extern',
    model: 'Brevo AI',
    riskClass: 'Minimal',
    scope: 'Marketing · E-Mail',
    owner: 'Team Marketing',
    status: 'In Betrieb',
    docProgress: 3,
    docTotal: 3,
    lastUpdated: '28.05.2026',
    obligations: ['Freiwilliger Verhaltenskodex'],
    obligationsDone: [true],
  },
];

// ── Farb-Helfer ───────────────────────────────────────────────────────────────

function riskBadgeCls(rc: RiskClass): string {
  switch (rc) {
    case 'Verboten':  return 'text-red-500 bg-red-950/50 border-red-800';
    case 'Hoch':      return 'text-red-400 bg-red-950/30 border-red-900';
    case 'Begrenzt':  return 'text-amber-400 bg-amber-950/30 border-amber-900';
    case 'Minimal':   return 'text-teal-400 bg-teal-950/30 border-teal-900';
  }
}

function riskBarCls(rc: RiskClass): string {
  switch (rc) {
    case 'Verboten': return 'bg-red-600';
    case 'Hoch':     return 'bg-red-500';
    case 'Begrenzt': return 'bg-amber-500';
    case 'Minimal':  return 'bg-teal-500';
  }
}

function statusChipCls(s: SystemStatus): string {
  switch (s) {
    case 'In Betrieb':      return 'text-teal-400 border-teal-800 bg-teal-950/20';
    case 'In Entwicklung':  return 'text-amber-400 border-amber-800 bg-amber-950/20';
    case 'Eingestellt':     return 'text-titanium-500 border-titanium-800 bg-obsidian-900';
    case 'Pausiert':        return 'text-sky-400 border-sky-800 bg-sky-950/20';
  }
}

// ── Asset → AiSystem Mapping ──────────────────────────────────────────────────

function assetToAiSystem(a: DbGovernanceAsset): AiSystem {
  const riskMap: Record<string, RiskClass> = {
    prohibited: 'Verboten', high: 'Hoch', limited: 'Begrenzt',
    minimal: 'Minimal', unknown: 'Minimal',
  };
  const statusMap: Record<string, SystemStatus> = {
    active: 'In Betrieb', draft: 'In Entwicklung',
    archived: 'Eingestellt', under_review: 'In Betrieb', approved: 'In Betrieb',
  };
  const lastUpdated = new Date(a.updated_at).toLocaleDateString('de-DE');
  return {
    id: a.id,
    name: a.name,
    description: a.description ?? a.name,
    provider: a.vendor ?? 'Intern',
    model: (a.metadata['model_name'] as string | undefined) ?? a.name,
    riskClass: riskMap[a.ai_act_class] ?? 'Minimal',
    scope: a.data_types.join(' · ') || 'Allgemein',
    owner: a.owner_email ?? '–',
    status: statusMap[a.status] ?? 'In Betrieb',
    docProgress: 0,
    docTotal: 1,
    lastUpdated,
    obligations: [],
    obligationsDone: [],
  };
}

// ── Haupt-View ────────────────────────────────────────────────────────────────

type FilterTab = 'Alle' | 'Hoch-Risiko' | 'Begrenzt' | 'Minimal' | 'Ausstehend';

export function AiSystemRegistryView() {
  const { activeTenantId } = useTenant();
  const [activeAiSystems, setActiveAiSystems] = useState<AiSystem[]>(AI_SYSTEMS);
  const [activeTab, setActiveTab] = useState<FilterTab>('Alle');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    fetchTenantAssets(activeTenantId).then((assets) => {
      const aiAssets = assets.filter((a) => a.asset_type === 'ai_system').map(assetToAiSystem);
      if (aiAssets.length > 0) setActiveAiSystems(aiAssets);
    }).catch(() => {/* keep mock */});
  }, [activeTenantId]);

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'Hoch-Risiko': return activeAiSystems.filter((s) => s.riskClass === 'Hoch' || s.riskClass === 'Verboten');
      case 'Begrenzt':    return activeAiSystems.filter((s) => s.riskClass === 'Begrenzt');
      case 'Minimal':     return activeAiSystems.filter((s) => s.riskClass === 'Minimal');
      case 'Ausstehend':  return activeAiSystems.filter((s) => s.docProgress < s.docTotal);
      default:            return activeAiSystems;
    }
  }, [activeTab, activeAiSystems]);

  // Metriken
  const totalSystems     = activeAiSystems.length;
  const hochrisiko       = activeAiSystems.filter((s) => s.riskClass === 'Hoch').length;
  const dokumentVollst   = activeAiSystems.filter((s) => s.docProgress === s.docTotal).length;
  const naechstePruefung = '30.06.2026';

  // Risikoverteilung für Balken
  const verboten   = activeAiSystems.filter((s) => s.riskClass === 'Verboten').length;
  const hoch       = activeAiSystems.filter((s) => s.riskClass === 'Hoch').length;
  const begrenzt   = activeAiSystems.filter((s) => s.riskClass === 'Begrenzt').length;
  const minimal    = activeAiSystems.filter((s) => s.riskClass === 'Minimal').length;
  const totalForBar = verboten + hoch + begrenzt + minimal;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const TABS: FilterTab[] = ['Alle', 'Hoch-Risiko', 'Begrenzt', 'Minimal', 'Ausstehend'];

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-titanium-900 bg-obsidian-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/app" className="p-1.5 text-titanium-400 hover:bg-obsidian-800 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-teal-600 to-teal-800">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">
                KI-System-Register
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                EU AI Act · Art. 6 · Risikoklassifizierung + Dokumentationspflichten
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 border border-teal-700 bg-teal-900/30 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-teal-300 hover:bg-teal-900/60 hover:text-teal-100"
        >
          <Plus className="h-3.5 w-3.5" />
          KI-System hinzufügen
        </button>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">

        {/* Risikoverteilung-Balken */}
        <section className="border border-titanium-900 bg-obsidian-900 p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
            EU AI Act · Risikoklassen-Verteilung · {totalSystems} Systeme
          </p>
          <div className="flex h-5 w-full overflow-hidden">
            {verboten > 0 && (
              <div
                className="bg-red-700 flex items-center justify-center"
                style={{ width: `${(verboten / totalForBar) * 100}%` }}
                title={`Verboten: ${verboten}`}
              />
            )}
            {hoch > 0 && (
              <div
                className="bg-red-500 flex items-center justify-center"
                style={{ width: `${(hoch / totalForBar) * 100}%` }}
                title={`Hoch: ${hoch}`}
              />
            )}
            {begrenzt > 0 && (
              <div
                className="bg-amber-500 flex items-center justify-center"
                style={{ width: `${(begrenzt / totalForBar) * 100}%` }}
                title={`Begrenzt: ${begrenzt}`}
              />
            )}
            {minimal > 0 && (
              <div
                className="bg-teal-500 flex items-center justify-center"
                style={{ width: `${(minimal / totalForBar) * 100}%` }}
                title={`Minimal: ${minimal}`}
              />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-4">
            <LegendItem color="bg-red-700"  label="Verboten" count={verboten} />
            <LegendItem color="bg-red-500"  label="Hoch"     count={hoch} />
            <LegendItem color="bg-amber-500" label="Begrenzt" count={begrenzt} />
            <LegendItem color="bg-teal-500"  label="Minimal"  count={minimal} />
          </div>
        </section>

        {/* Metriken */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="KI-Systeme registriert" value={totalSystems.toString()} />
          <MetricCard label="Hochrisiko (Art. 6)"     value={hochrisiko.toString()}     tone="red" />
          <MetricCard label="Dokumentation vollständig" value={dokumentVollst.toString()} tone="teal" />
          <MetricCard label="Nächste Prüfung"         value={naechstePruefung}          tone="amber" mono />
        </div>

        {/* Filter-Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border px-3 py-1 font-mono text-[11px] uppercase tracking-wide ${
                activeTab === tab
                  ? 'border-teal-600/60 bg-teal-900/20 text-teal-200'
                  : 'border-titanium-800 bg-obsidian-900 text-titanium-300 hover:border-titanium-600 hover:text-titanium-100'
              }`}
            >
              {tab}
              {tab !== 'Alle' && (
                <span className="ml-1.5 font-mono text-[10px] text-titanium-500">
                  {tab === 'Hoch-Risiko' ? activeAiSystems.filter((s) => s.riskClass === 'Hoch' || s.riskClass === 'Verboten').length
                    : tab === 'Begrenzt' ? activeAiSystems.filter((s) => s.riskClass === 'Begrenzt').length
                    : tab === 'Minimal'  ? activeAiSystems.filter((s) => s.riskClass === 'Minimal').length
                    : activeAiSystems.filter((s) => s.docProgress < s.docTotal).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* System-Karten */}
        <div className="space-y-3">
          {filtered.map((system) => (
            <AiSystemCard key={system.id} system={system} />
          ))}
          {filtered.length === 0 && (
            <div className="border border-titanium-800 bg-obsidian-900 p-10 text-center">
              <p className="text-sm text-titanium-400">Keine KI-Systeme in dieser Ansicht.</p>
            </div>
          )}
        </div>

        {/* EU AI Act Info-Box */}
        <section className="border border-titanium-900 bg-obsidian-900 p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
            EU AI Act · Risikoklassen-Übersicht
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <RiskInfoCard
              label="Verboten"
              cls="border-red-900 bg-red-950/20 text-red-400"
              examples="Social Scoring, manipulative KI, biometrische Kategorisierung"
              obligation="Vollständiges Verbot — kein Einsatz zulässig"
            />
            <RiskInfoCard
              label="Hoch"
              cls="border-red-900 bg-red-950/10 text-red-400"
              examples="CV-Screening, Bonitätsprüfung, medizinische Diagnose"
              obligation="Konformitätsbewertung, Registrierung, Menschliche Aufsicht"
            />
            <RiskInfoCard
              label="Begrenzt"
              cls="border-amber-900 bg-amber-950/10 text-amber-400"
              examples="Chatbots, Empfehlungssysteme"
              obligation="Transparenzpflichten, Nutzer-Information"
            />
            <RiskInfoCard
              label="Minimal"
              cls="border-teal-900 bg-teal-950/10 text-teal-400"
              examples="Spam-Filter, Bestandsverwaltung"
              obligation="Freiwillige Verhaltenskodizes"
            />
          </div>
        </section>
      </main>

      {/* Add Modal */}
      {showAddModal && (
        <AddSystemModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            showToast('KI-System gespeichert');
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 border border-teal-700 bg-obsidian-900 px-4 py-2.5 font-mono text-[11px] text-teal-300 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── System-Karte ──────────────────────────────────────────────────────────────

function AiSystemCard({ system }: { system: AiSystem }) {
  const [expanded, setExpanded] = useState(false);
  const docPct = system.docTotal > 0 ? (system.docProgress / system.docTotal) * 100 : 0;
  const doneCnt = system.obligationsDone.filter(Boolean).length;

  return (
    <div className="flex border border-titanium-900 bg-obsidian-900 hover:border-titanium-700 transition-colors">
      {/* Risiko-Indikator-Leiste (3px links) */}
      <div className={`w-[3px] shrink-0 ${riskBarCls(system.riskClass)}`} />

      <div className="flex-1 min-w-0 p-4">
        {/* Zeile 1: Name + Status */}
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-display text-sm font-semibold text-titanium-50">{system.name}</span>
          <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${statusChipCls(system.status)}`}>
            {system.status}
          </span>
        </div>

        {/* Zeile 2: Anbieter · Modell */}
        <p className="font-mono text-[11px] text-titanium-500 mb-1">
          {system.provider} · {system.model}
        </p>

        {/* Zeile 3: Beschreibung */}
        <p className="text-xs text-titanium-400 line-clamp-2 mb-3">{system.description}</p>

        {/* Zeile 4: Risk-Badge + Scope */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${riskBadgeCls(system.riskClass)}`}>
            {system.riskClass}
          </span>
          <span className="font-mono text-[10px] text-titanium-500">{system.scope}</span>
        </div>

        {/* Zeile 5: Verantwortlicher + letzte Aktualisierung */}
        <div className="flex flex-wrap gap-4 mb-3">
          <span className="font-mono text-[10px] text-titanium-500">
            Verantwortlich: <span className="text-titanium-300">{system.owner}</span>
          </span>
          <span className="font-mono text-[10px] text-titanium-500">
            Aktualisiert: <span className="text-titanium-300">{system.lastUpdated}</span>
          </span>
        </div>

        {/* Dokumentations-Fortschrittsbalken */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] text-titanium-500">
              Dokumentation: <span className="text-titanium-300">{system.docProgress}/{system.docTotal} Pflichten</span>
            </span>
            {system.docProgress === system.docTotal && (
              <span className="font-mono text-[10px] text-teal-400">vollständig</span>
            )}
          </div>
          <div className="h-1.5 w-full bg-titanium-800">
            <div
              className={`h-1.5 ${docPct === 100 ? 'bg-teal-500' : docPct > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${docPct}%` }}
            />
          </div>
        </div>

        {/* Pflichten-Checkliste (aufklappbar) */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-titanium-500 hover:text-titanium-300 mb-2"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Pflichten ({doneCnt}/{system.obligations.length} erfüllt)
        </button>

        {expanded && (
          <ul className="mb-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {system.obligations.map((obl, i) => (
              <li key={obl} className="flex items-center gap-1.5">
                {system.obligationsDone[i] ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-teal-400" />
                ) : (
                  <Circle className="h-3 w-3 shrink-0 text-titanium-600" />
                )}
                <span className={`text-xs ${system.obligationsDone[i] ? 'text-teal-300' : 'text-titanium-400'}`}>
                  {obl}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Action-Buttons */}
        <div className="flex flex-wrap gap-1.5">
          <ActionBtn icon={<FileText className="h-3 w-3" />} label="Details" />
          <ActionBtn icon={<FileText className="h-3 w-3" />} label="Dokumentieren" />
          <ActionBtn icon={<Tag className="h-3 w-3" />}      label="Klassifizieren" />
          <ActionBtn icon={<Shield className="h-3 w-3" />}   label="Nachweis erstellen" />
        </div>
      </div>
    </div>
  );
}

// ── Hilfs-Komponenten ─────────────────────────────────────────────────────────

function MetricCard({
  label, value, tone, mono,
}: {
  label: string;
  value: string;
  tone?: 'red' | 'teal' | 'amber';
  mono?: boolean;
}) {
  const valCls =
    tone === 'red'   ? 'text-red-400'   :
    tone === 'teal'  ? 'text-teal-400'  :
    tone === 'amber' ? 'text-amber-400' :
    'text-titanium-50';
  return (
    <div className="border border-titanium-800 bg-obsidian-900 p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{label}</p>
      <p className={`mt-1 ${mono ? 'font-mono text-lg' : 'font-display text-2xl font-bold tracking-tight'} ${valCls}`}>
        {value}
      </p>
    </div>
  );
}

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-2.5 w-2.5 ${color}`} />
      <span className="font-mono text-[10px] text-titanium-400">{label}: <span className="text-titanium-200">{count}</span></span>
    </div>
  );
}

function RiskInfoCard({
  label, cls, examples, obligation,
}: {
  label: string;
  cls: string;
  examples: string;
  obligation: string;
}) {
  return (
    <div className={`border p-3 ${cls}`}>
      <p className={`font-mono text-[11px] font-semibold uppercase tracking-wider mb-2 ${cls.split(' ').find((c) => c.startsWith('text-')) ?? ''}`}>
        {label}
      </p>
      <p className="text-[11px] text-titanium-400 mb-1.5">{examples}</p>
      <p className="font-mono text-[10px] text-titanium-500">{obligation}</p>
    </div>
  );
}

function ActionBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-1 border border-titanium-800 bg-obsidian-950 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-titanium-400 hover:border-titanium-600 hover:text-titanium-100"
    >
      {icon}
      {label}
    </button>
  );
}

// ── Add-System-Modal ──────────────────────────────────────────────────────────

function AddSystemModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [provider, setProvider]       = useState('');
  const [model, setModel]             = useState('');
  const [riskClass, setRiskClass]     = useState<RiskClass>('Minimal');
  const [scope, setScope]             = useState('');
  const [owner, setOwner]             = useState('');
  const [status, setStatus]           = useState<SystemStatus>('In Betrieb');

  function handleSave() {
    if (!name.trim()) return;
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto border border-titanium-800 bg-obsidian-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal-Header */}
        <div className="flex items-center justify-between border-b border-titanium-900 px-4 py-3">
          <h2 className="font-display text-sm font-bold text-titanium-50">KI-System registrieren</h2>
          <button type="button" onClick={onClose} className="text-titanium-400 hover:text-titanium-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal-Body */}
        <div className="space-y-4 p-4">
          <ModalField label="Name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Kreditscoring-KI"
              className="w-full border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
            />
          </ModalField>

          <ModalField label="Beschreibung">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Was tut das System? In welchem Kontext?"
              className="w-full resize-y border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
            />
          </ModalField>

          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Anbieter">
              <input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Anthropic / OpenAI / Intern / …"
                className="w-full border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
              />
            </ModalField>
            <ModalField label="Modell">
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="claude-3-5-sonnet / gpt-4o / …"
                className="w-full border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
              />
            </ModalField>
          </div>

          <ModalField label="Risikoklasse">
            <select
              value={riskClass}
              onChange={(e) => setRiskClass(e.target.value as RiskClass)}
              className="w-full border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
            >
              <option value="Minimal">Minimal</option>
              <option value="Begrenzt">Begrenzt</option>
              <option value="Hoch">Hoch</option>
              <option value="Verboten">Verboten</option>
            </select>
          </ModalField>

          <ModalField label="Anwendungsbereich">
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="z.B. HR · Recruiting"
              className="w-full border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
            />
          </ModalField>

          <ModalField label="Verantwortlicher">
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="z.B. Team People"
              className="w-full border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
            />
          </ModalField>

          <ModalField label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SystemStatus)}
              className="w-full border border-titanium-800 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-teal-600"
            >
              <option value="In Betrieb">In Betrieb</option>
              <option value="In Entwicklung">In Entwicklung</option>
              <option value="Pausiert">Pausiert</option>
              <option value="Eingestellt">Eingestellt</option>
            </select>
          </ModalField>
        </div>

        {/* Modal-Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-titanium-900 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 font-mono text-xs text-titanium-400 hover:text-titanium-100"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="border border-teal-700 bg-teal-900/40 px-4 py-1.5 font-mono text-xs text-teal-200 hover:bg-teal-800/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-titanium-400">
        {label}
      </span>
      {children}
    </label>
  );
}
