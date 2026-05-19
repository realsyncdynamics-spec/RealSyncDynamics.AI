import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  FileText,
  ScrollText,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';
import {
  RuntimeGauge,
  RuntimeHeader,
  RuntimeKpiCard,
  RuntimeLogStream,
  RuntimeMetricBar,
  RuntimeSectionHeader,
  RuntimeShell,
  RuntimeSidebar,
  RuntimeStatusBadge,
  RuntimeTable,
  RuntimeTelemetryBar,
  severityToTone,
  type RuntimeColumn,
  type RuntimeSidebarItem,
} from '../components/runtime-ui';
import { RUNTIME_DEMO_OVERVIEW } from '../lib/runtime/runtimeDemoData';
import type {
  RuntimeAgent,
  RuntimeEvidenceEvent,
  RuntimeIncident,
  RuntimeInfraSignal,
} from '../lib/runtime/runtimeTypes';

const SIDEBAR_ITEMS: RuntimeSidebarItem[] = [
  { to: '/leitstand',           label: 'Leitstand',         icon: <ServerCog className="h-3.5 w-3.5" /> },
  { to: '/governance',          label: 'Governance',        icon: <ScrollText className="h-3.5 w-3.5" /> },
  { to: '/governance/vvt',      label: 'Runtime-VVT',       icon: <FileText className="h-3.5 w-3.5" />, pending: true },
  { to: '/agents',              label: 'Agenten',           icon: <Bot className="h-3.5 w-3.5" /> },
  { to: '/evidence',            label: 'Nachweiskette',     icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { to: '/runtime',             label: 'Runtime-Surface',   icon: <ServerCog className="h-3.5 w-3.5" /> },
];

const AGENT_STATUS_LABEL: Record<RuntimeAgent['status'], string> = {
  idle:            'Idle',
  running:         'Running',
  review_required: 'Review erforderlich',
  paused:          'Pausiert',
  offline:         'Offline',
};

const AGENT_STATUS_TONE: Record<RuntimeAgent['status'], 'success' | 'warn' | 'neutral' | 'cyan' | 'danger'> = {
  idle:            'neutral',
  running:         'cyan',
  review_required: 'warn',
  paused:          'neutral',
  offline:         'danger',
};

const INCIDENT_STATUS_LABEL: Record<RuntimeIncident['status'], string> = {
  open:            'Offen',
  review_required: 'Review erforderlich',
  mitigated:       'Mitigiert',
  closed:          'Geschlossen',
};

const INCIDENT_STATUS_TONE: Record<RuntimeIncident['status'], 'warn' | 'success' | 'neutral'> = {
  open:            'warn',
  review_required: 'warn',
  mitigated:       'success',
  closed:          'neutral',
};

const INFRA_TONE: Record<RuntimeInfraSignal['state'], 'success' | 'warn' | 'danger' | 'neutral'> = {
  ok:      'success',
  warn:    'warn',
  fail:    'danger',
  unknown: 'neutral',
};

const INFRA_LABEL: Record<RuntimeInfraSignal['state'], string> = {
  ok:      'OK',
  warn:    'Warnung',
  fail:    'Fehler',
  unknown: 'Unbekannt',
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', { hour12: false });
  } catch {
    return iso;
  }
}

export function Leitstand() {
  usePageMeta({
    title: 'Governance Leitstand — RealSyncDynamics.AI',
    description: 'Operativer Leitstand fuer KI- und Datenschutz-Governance: KPIs, Incidents, Agenten-Status und Nachweiskette in einer Surface.',
    url: 'https://RealSyncDynamicsAI.de/leitstand',
  });

  const overview = RUNTIME_DEMO_OVERVIEW;
  const [showOnlyReview, setShowOnlyReview] = useState(false);

  const incidents = useMemo(() => {
    return showOnlyReview
      ? overview.incidents.filter((incident) => incident.status === 'review_required')
      : overview.incidents;
  }, [overview.incidents, showOnlyReview]);

  const incidentColumns: Array<RuntimeColumn<RuntimeIncident>> = [
    {
      key: 'severity', header: 'Severity', width: '120px',
      render: (row) => <RuntimeStatusBadge label={row.severity} tone={severityToTone(row.severity)} />,
    },
    {
      key: 'title', header: 'Titel',
      render: (row) => (
        <div>
          <p className="text-titanium-50">{row.title}</p>
          {row.source_url ? (
            <p className="mt-0.5 break-all font-mono text-[11px] text-titanium-500">{row.source_url}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'rule', header: 'Regel', width: '220px',
      render: (row) => (
        <span className="font-mono text-xs text-titanium-300">
          {row.rule_id ?? '—'}
          {row.rule_version ? <span className="text-titanium-500"> · v{row.rule_version}</span> : null}
        </span>
      ),
    },
    {
      key: 'detected_at', header: 'Erkannt', width: '160px',
      render: (row) => <span className="font-mono text-xs text-titanium-300">{formatDateTime(row.detected_at)}</span>,
    },
    {
      key: 'status', header: 'Status', width: '180px',
      render: (row) => (
        <RuntimeStatusBadge label={INCIDENT_STATUS_LABEL[row.status]} tone={INCIDENT_STATUS_TONE[row.status]} />
      ),
    },
  ];

  const agentColumns: Array<RuntimeColumn<RuntimeAgent>> = [
    { key: 'name', header: 'Agent', render: (row) => <span className="text-titanium-50">{row.name}</span> },
    { key: 'role', header: 'Rolle', render: (row) => <span className="text-titanium-300">{row.role}</span> },
    {
      key: 'status', header: 'Status', width: '180px',
      render: (row) => (
        <RuntimeStatusBadge
          label={AGENT_STATUS_LABEL[row.status]}
          tone={AGENT_STATUS_TONE[row.status]}
          live={row.status === 'running'}
        />
      ),
    },
    {
      key: 'last_seen', header: 'Zuletzt', width: '180px',
      render: (row) => <span className="font-mono text-xs text-titanium-300">{formatDateTime(row.last_seen)}</span>,
    },
  ];

  const evidenceColumns: Array<RuntimeColumn<RuntimeEvidenceEvent>> = [
    {
      key: 'occurred_at', header: 'Zeit', width: '160px',
      render: (row) => <span className="font-mono text-xs text-titanium-300">{formatDateTime(row.occurred_at)}</span>,
    },
    { key: 'subject', header: 'Ereignis', render: (row) => <span className="font-mono text-xs text-titanium-100">{row.subject}</span> },
    { key: 'agent',   header: 'Agent',    render: (row) => <span className="text-titanium-300">{row.agent ?? '—'}</span>, width: '180px' },
    {
      key: 'hash', header: 'Hash',
      render: (row) => row.hash ? (
        <span className="font-mono text-[11px] text-titanium-400">{row.hash}</span>
      ) : <span className="text-titanium-500">—</span>,
    },
  ];

  // Beispielhafte Telemetrie-Werte fuer die Metric-Bars — Demo-Skala 0..100.
  const eventsPerHour = 47;
  const reviewQueue   = 12;
  const driftPct      = 0.34;

  return (
    <RuntimeShell
      scanline
      header={
        <>
          <Navbar />
          <RuntimeHeader
            title="Governance Leitstand"
            subtitle="Echtzeit-Ueberwachung · Nachweiskette · Review-Pipeline"
            state={{ label: 'Demo-Telemetrie', tone: 'demo' }}
            actions={
              <button
                type="button"
                onClick={() => setShowOnlyReview((value) => !value)}
                className="inline-flex items-center gap-2 border border-titanium-700 bg-obsidian-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-titanium-200 hover:border-ai-cyan-500 hover:text-ai-cyan-200"
              >
                {showOnlyReview ? 'Alle Incidents' : 'Nur Review erforderlich'}
              </button>
            }
          />
        </>
      }
      sidebar={<RuntimeSidebar title="Surfaces" items={SIDEBAR_ITEMS} />}
    >
      <RuntimeTelemetryBar
        source="runtime.demo.overview"
        state="demo"
        meta={`erzeugt ${formatDateTime(overview.generated_at)}`}
      />

      <section className="mt-6">
        <RuntimeSectionHeader
          eyebrow="01 · Runtime Overview"
          title="Operative KPIs"
          subtitle="Aus Beispielereignissen abgeleitet. Keine Live-Behauptung ohne verbundenes Backend."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {overview.kpis.map((kpi) => (
            <RuntimeKpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <RuntimeGauge label="Drift-Quote (Demo)" value={driftPct} hint="Anteil Drift-Events / Gesamtevents" />
          <div className="border border-titanium-800 bg-obsidian-950 p-3">
            <RuntimeMetricBar label="Events / Stunde" value={eventsPerHour} max={120} unit="ev/h" />
          </div>
          <div className="border border-titanium-800 bg-obsidian-950 p-3">
            <RuntimeMetricBar label="Review-Queue" value={reviewQueue} max={40} unit="offen" tone="warn" />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <RuntimeSectionHeader
          eyebrow="02 · Governance Incidents"
          title="Offene Vorfaelle"
          subtitle="Sortiert nach Erkennungszeit. Review-Status ist verbindlich vor Freigabe."
        />
        <RuntimeTable
          columns={incidentColumns}
          rows={incidents}
          rowKey={(row) => row.id}
          emptyHint="Keine Incidents mit diesem Filter."
        />
      </section>

      <section className="mt-8">
        <RuntimeSectionHeader
          eyebrow="03 · Agent Status"
          title="Governance-Agenten"
          subtitle="Drift · AI-Risk · Evidence · Policy — jede Aktion wird als Nachweis gespiegelt."
        />
        <RuntimeTable
          columns={agentColumns}
          rows={overview.agents}
          rowKey={(row) => row.id}
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <RuntimeSectionHeader
            eyebrow="04 · Evidence Events"
            title="Letzte Nachweiseintraege"
            subtitle="Hashes sind Beispielwerte zur UI-Darstellung."
          />
          <RuntimeTable
            columns={evidenceColumns}
            rows={overview.evidence}
            rowKey={(row) => row.id}
          />
        </div>
        <div>
          <RuntimeSectionHeader
            eyebrow="05 · Infrastructure Health"
            title="Komponenten-Status"
            subtitle="Statusquellen sind aktuell statisch (Demo). Sobald angeschlossen: echte Heartbeats."
          />
          <ul className="space-y-2">
            {overview.infra.map((signal) => (
              <li
                key={signal.id}
                className="flex items-center justify-between border border-titanium-800 bg-obsidian-950 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-titanium-100">{signal.label}</p>
                  {signal.detail ? (
                    <p className="font-mono text-[11px] text-titanium-500">{signal.detail}</p>
                  ) : null}
                </div>
                <RuntimeStatusBadge label={INFRA_LABEL[signal.state]} tone={INFRA_TONE[signal.state]} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <RuntimeSectionHeader
          eyebrow="06 · Audit Log Stream"
          title="Live-Stream der Governance-Ereignisse"
          subtitle="Demo-Stream — kein echter Backend-Push. Mit angeschlossener Telemetrie ersetzt der Stream diese Daten."
          actions={
            <div className="hidden items-center gap-2 sm:flex">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-mono text-[11px] uppercase tracking-wide text-amber-200">
                keine Live-Quelle verbunden
              </span>
            </div>
          }
        />
        <RuntimeLogStream entries={overview.log} live={false} />
      </section>

      <footer className="mt-10 border-t border-titanium-800 pt-4 font-mono text-[11px] uppercase tracking-wide text-titanium-500">
        Demo-Telemetrie · Beispielereignisse · keine rechtliche Bewertung
      </footer>
    </RuntimeShell>
  );
}

export default Leitstand;
