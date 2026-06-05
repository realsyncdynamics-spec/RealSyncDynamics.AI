import { Globe, Scan, AlertTriangle, Zap, FileStack, FileText, ArrowRight } from 'lucide-react';

interface FlowStep {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FLOW_STEPS: FlowStep[] = [
  {
    number: '01',
    icon: <Globe className="h-6 w-6" />,
    title: 'Website',
    description: 'Ihre Website, KI-Systeme, APIs und Third-Parties werden erfasst.'
  },
  {
    number: '02',
    icon: <Scan className="h-6 w-6" />,
    title: 'Scan',
    description: 'Headers, Cookies, Tracker, API-Calls und Datenflüsse werden automatisch gescannt.'
  },
  {
    number: '03',
    icon: <AlertTriangle className="h-6 w-6" />,
    title: 'Finding',
    description: 'Detektierte Risiken werden klassifiziert (DSGVO-Artikel, EU AI Act).'
  },
  {
    number: '04',
    icon: <Zap className="h-6 w-6" />,
    title: 'Risk',
    description: 'Risk-Score berechnet, Severity bestimmt, Policies geprüft.'
  },
  {
    number: '05',
    icon: <FileStack className="h-6 w-6" />,
    title: 'Evidence',
    description: 'Alle Erkenntnisse werden in eine kryptografisch versiegelte Evidence-Chain geschrieben.'
  },
  {
    number: '06',
    icon: <FileText className="h-6 w-6" />,
    title: 'Report',
    description: 'Audit-fähige Reports und Nachweise für Regulatoren und interne Reviews.'
  },
];

/**
 * Runtime Governance Flow Section — explains how governance detection works.
 * Differentiates from cookie-consent tools and traditional GDPR documentation.
 */
export function RuntimeGovernanceFlowSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3">
            Wie es funktioniert
          </p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 mb-4">
            Der Governance-Runtime-Flow
          </h2>
          <p className="text-titanium-300 max-w-3xl">
            Im Unterschied zu Cookie-Consent-Tools und statischen DSGVO-Dokumentationslösungen:
            Governance Runtime führt automatisierte Scans, Risikoklassifikation und
            kryptografische Evidence-Archivierung durch — kontinuierlich und nachvollziehbar.
          </p>
        </div>

        {/* Flow Visualization */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
          {FLOW_STEPS.map((step, idx) => (
            <div key={step.number} className="flex flex-col">
              {/* Card */}
              <div className="border border-titanium-900 bg-obsidian-900/60 p-5 mb-3 flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-none bg-obsidian-950 border border-titanium-800 flex items-center justify-center text-titanium-400">
                    {step.icon}
                  </div>
                  <span className="font-mono text-[11px] text-titanium-500">{step.number}</span>
                </div>
                <h3 className="font-display font-semibold text-titanium-50 text-sm mb-2">
                  {step.title}
                </h3>
                <p className="text-xs text-titanium-400 leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Arrow (on desktop, not after last) */}
              {idx < FLOW_STEPS.length - 1 && (
                <div className="hidden lg:flex items-center justify-center mb-3">
                  <ArrowRight className="h-5 w-5 text-titanium-700 rotate-90 lg:rotate-0" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Differentiator section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
          <div className="border border-titanium-900 bg-obsidian-950/40 p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">
              Cookie-Consent-Tools
            </p>
            <ul className="text-xs text-titanium-400 space-y-1">
              <li>✓ Banner-Management</li>
              <li>✓ Consent-Tracking</li>
              <li>✗ Keine Risiko-Analyse</li>
              <li>✗ Manuelle Dokumentation</li>
            </ul>
          </div>

          <div className="border border-titanium-900 bg-obsidian-950/40 p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">
              RealSync Runtime
            </p>
            <ul className="text-xs text-titanium-300 space-y-1">
              <li>✓ Automatische Scans</li>
              <li>✓ Risikoklassifikation</li>
              <li>✓ Evidence-Vault</li>
              <li>✓ Audit-fähig</li>
            </ul>
          </div>

          <div className="border border-titanium-900 bg-obsidian-950/40 p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">
              Klassische DSGVO-Dokumentation
            </p>
            <ul className="text-xs text-titanium-400 space-y-1">
              <li>✓ Templates & Checklisten</li>
              <li>✓ Prozess-Dokumentation</li>
              <li>✗ Keine Runtime-Überwachung</li>
              <li>✗ Statisch, nicht kontinuierlich</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
