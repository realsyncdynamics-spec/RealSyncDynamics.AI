import { Bot, FileCheck2, Radar } from 'lucide-react';

const agents = [
  {
    icon: Radar,
    label: 'Monitoring Agent',
    title: 'Website-Drift-Agent',
    text:
      'Überwacht Ihre Domains täglich auf neue Tracker, Scripts und Einbettungen – inklusive Consent-Timing. Erkennt er ein neues Risiko, erstellt er automatisch verständliche To-dos für Marketing, IT und Datenschutz.',
  },
  {
    icon: Bot,
    label: 'Governance Agent',
    title: 'AI-Usecase-Agent',
    text:
      'Erfasst Ihre KI-Workflows, ordnet sie den Kategorien des EU AI Act zu und prüft, welche Pflichten daraus folgen. Sie sehen, wo Logging, Human Oversight oder zusätzliche Dokumentation nötig werden.',
  },
  {
    icon: FileCheck2,
    label: 'Evidence Agent',
    title: 'Evidence-Agent',
    text:
      'Baut aus Scans, Logs und Änderungen einen auditfähigen Nachweis: Reports für interne Audits, Mandantenberichte oder Anfragen von Aufsichtsbehörden – ohne manuelle Excel-Pflege.',
  },
];

export function AgenticComplianceAgentsSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Agentic Compliance
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            AI-Agenten, die Ihre Compliance-Arbeit übernehmen.
          </h2>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
            RealSyncDynamics.AI arbeitet nicht nur mit festen Regeln, sondern setzt
            spezialisierte AI-Agenten ein, die Websites und KI-Workflows kontinuierlich
            beobachten, Probleme einordnen und To-dos für Ihr Team vorbereiten.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {agents.map((agent) => {
            const Icon = agent.icon;
            return (
              <article
                key={agent.title}
                className="bg-obsidian-900/60 border border-silver-700/30 p-6"
              >
                <div className="h-10 w-10 flex items-center justify-center border border-titanium-100/30 bg-titanium-100/5 text-titanium-100 mb-5">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-titanium-100 mb-3">
                  {agent.label}
                </div>
                <h3 className="font-display font-bold text-xl text-titanium-50">{agent.title}</h3>
                <p className="mt-3 text-sm text-silver-300 leading-relaxed">{agent.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
