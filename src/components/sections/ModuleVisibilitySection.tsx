import { ModuleStatusBadge } from '../../features/governance/ModuleStatusBadge';
import type { ModuleStatus } from '../../features/governance/moduleConfig';

interface ModuleCard {
  title: string;
  status: ModuleStatus;
  description: string;
}

const MODULES: ModuleCard[] = [
  {
    title: 'Website Governance',
    status: 'live',
    description: 'Automatische DSGVO- und EU-AI-Act-Scans für Websites, Tracker und Third-Parties.'
  },
  {
    title: 'Evidence Vault',
    status: 'live',
    description: 'Kryptografisch versiegelte Audit-Trails für Compliance-Nachweise und Regulatory Review.'
  },
  {
    title: 'Runtime Monitoring',
    status: 'beta',
    description: '24/7 Drift-Detection und kontinuierliche Überwachung von Website-Änderungen.'
  },
  {
    title: 'KI-System Registry',
    status: 'beta',
    description: 'Zentrales Verzeichnis für alle KI-Systeme mit EU-AI-Act-Klassifikation und Risiko-Assessment.'
  },
  {
    title: 'Risk Management',
    status: 'beta',
    description: 'Automatische Risiko-Klassifikation, Priorisierung und Remediation-Tracking.'
  },
  {
    title: 'Vendor Tracking',
    status: 'roadmap',
    description: 'Überwachung von Third-Party-Abhängigkeiten und Vendor-Risiken (Q3 2026).'
  },
  {
    title: 'DSFA Generator',
    status: 'roadmap',
    description: 'Automatisierte Datenschutz-Folgenabschätzungen basierend auf erfassten Datenflüssen (Q3 2026).'
  },
  {
    title: 'Auto Remediation',
    status: 'roadmap',
    description: 'Agenten-gestützte automatische Fehlerbehebung und Policy-Enforcement (Q4 2026).'
  },
];

/**
 * Module Visibility Section — shows all governance modules with status badges.
 * Appears directly after hero to set expectations about feature maturity.
 */
export function ModuleVisibilitySection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3">
            Feature-Matrix
          </p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 mb-4">
            Governance-Module
          </h2>
          <p className="text-titanium-300 max-w-3xl">
            Vollständige Feature-Matrix für Website-Governance, KI-Systeme und Compliance-Automation.
            Status-Badges zeigen Verfügbarkeit (Live, Beta, Roadmap).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((module) => (
            <div
              key={module.title}
              className="border border-titanium-900 bg-obsidian-900/60 p-5 hover:border-titanium-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-display font-semibold text-titanium-50 text-sm leading-snug flex-1">
                  {module.title}
                </h3>
                <ModuleStatusBadge status={module.status} compact={false} />
              </div>
              <p className="text-sm text-titanium-300 leading-relaxed">
                {module.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 border-l-4 border-titanium-700 bg-titanium-900/10 p-4 text-sm text-titanium-300">
          <strong className="text-titanium-100">Neue Mitglieder:</strong> Founding-Access-Nutzer erhalten
          Priorität bei Beta-Features und direkten Input in den Roadmap-Prozess.
        </div>
      </div>
    </section>
  );
}
