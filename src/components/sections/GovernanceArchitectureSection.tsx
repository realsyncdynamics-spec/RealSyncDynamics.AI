import { ArrowRight } from 'lucide-react';

const LAYERS = [
  {
    label: 'WEBSITE',
    title: 'Website Layer',
    body: 'Seiten · Formulare · Cookies · Tracker · Tag Manager · CMP-Verhalten',
    techs: ['Browser-Extension', 'Headless-Scanner', 'Consent-Timing'],
  },
  {
    label: 'API',
    title: 'API Layer',
    body: 'Backend-Endpunkte · Datenflüsse · Vendor-APIs · Webhook-Streams',
    techs: ['SDK Telemetry', 'Cloud-Connectors', 'CI/CD-Hooks'],
  },
  {
    label: 'AI',
    title: 'AI Layer',
    body: 'KI-Usecases · Modelle · Datasets · Prompts · AI-Act-Risikoklassen',
    techs: ['Annex-III Classifier', 'Obligation-Engine', 'Drift-Detector'],
  },
  {
    label: 'AGENT',
    title: 'Agent Layer',
    body: 'Autonome Workflows · Tool-Use-Loops · Approvals · Evidence',
    techs: ['Agent-Runtime', 'Orchestrator', 'Audit-Trail'],
  },
];

const LOOP = [
  { step: 'DISCOVER', body: 'Browser-Extension · SDK · Cloud-Connectors finden neue Assets' },
  { step: 'INVENTORY', body: 'Governance-Graph speichert Entitäten + Lineage' },
  { step: 'CLASSIFY', body: 'Risk-Engine + AI-Act-Classifier setzen Risikoklasse' },
  { step: 'ENFORCE', body: 'Policy-Engine entscheidet allow / warn / approve / block' },
  { step: 'MONITOR', body: 'Telemetrie-Stream + TSDB sehen Runtime-Realität' },
  { step: 'DETECT', body: 'Drift · Anomalien · Regulatorische Änderungen' },
  { step: 'REMEDIATE', body: 'Workflow-Engine + Connectors öffnen Jira/GitHub/Slack' },
  { step: 'EVIDENCE', body: 'Hash-chained · Ed25519 signiert · RFC-3161 timestamped' },
];

export function GovernanceArchitectureSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Plattform-Architektur
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Vier Layer. Ein geschlossener Governance-Loop.
          </h2>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
            Die Plattform ist keine Sammlung von Tools, sondern eine Governance-Runtime mit klaren
            Schichten — und einer kontinuierlich laufenden Discover-zu-Evidence-Pipeline darüber.
          </p>
        </div>

        {/* 4-layer stack */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-12">
          {LAYERS.map((layer, idx) => (
            <article
              key={layer.label}
              className="relative bg-obsidian-900/60 border border-silver-700/30 p-5"
            >
              <div className="absolute -top-2 left-5 px-2 py-0.5 bg-obsidian-950 border border-titanium-100/30 text-[10px] font-mono uppercase tracking-[0.18em] text-titanium-100">
                {idx + 1}. {layer.label}
              </div>
              <h3 className="font-display font-bold text-lg text-titanium-50 mt-3">{layer.title}</h3>
              <p className="mt-2 text-sm text-silver-300 leading-relaxed">{layer.body}</p>
              <div className="mt-4 flex flex-wrap gap-1">
                {layer.techs.map((t) => (
                  <span
                    key={t}
                    className="border border-silver-700/30 bg-obsidian-950/60 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-silver-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        {/* Loop diagram */}
        <div className="bg-obsidian-900/60 border border-silver-700/30 p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-5">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-titanium-100">
              Continuous Governance Loop
            </div>
          </div>
          <h3 className="font-display font-bold text-xl text-titanium-50 mb-2">
            Discover → Inventory → Classify → Enforce → Monitor → Detect → Remediate → Evidence
          </h3>
          <p className="text-sm text-silver-400 mb-6">
            Jeder Pfeil ist ein Service. Jeder Service emittiert Events. Der Loop läuft per Tenant
            kontinuierlich — kein Quartals-Audit, kein „einmal-pro-Release"-Check.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {LOOP.map((s, idx) => (
              <div
                key={s.step}
                className="relative border border-silver-700/30 bg-obsidian-950/60 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[10px] text-silver-500">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-100">
                    {s.step}
                  </span>
                  {idx < LOOP.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-silver-500 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-silver-300 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-silver-700/30 pt-5 text-sm text-silver-400">
            Tiefere Architektur-Spec:{' '}
            <span className="text-titanium-100">docs/architecture/governance-os-blueprint.md</span>{' '}
            — 13 Services, Postgres+AGE-Graph, Policy-DSL, 10-Agent-Fleet, Roadmap bis 2029.
          </div>
        </div>
      </div>
    </section>
  );
}
