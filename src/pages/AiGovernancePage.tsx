import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import { AiGovernanceDashboard } from '../features/ai-governance/AiGovernanceDashboard';
import { RuntimeDashboard } from '../features/ai-governance/RuntimeDashboard';
import { BrowserExtensionSection } from '../components/sections/BrowserExtensionSection';
import { PolicyEngineSection } from '../components/sections/PolicyEngineSection';
import { EnterpriseEvidenceVaultSection } from '../components/sections/EnterpriseEvidenceVaultSection';
import { AgentConnectorsSection } from '../components/sections/AgentConnectorsSection';

/**
 * /ai-governance — Public Marketing-Page fuer die AI-Governance-OS-Capability.
 *
 * In dieser PR rein public und demo-faehig (statische Daten via
 * AiGovernanceDashboard). Strukturell vorbereitet fuer Auth-Gating in
 * Folge-PRs (Runtime-Telemetry, Policy-Enforcement).
 *
 * SEO-Meta-Tags werden global ueber <SEOHead /> in App.tsx via
 * src/config/seo.ts gesetzt — kein lokaler SEOHead-Mount noetig.
 */
export function AiGovernancePage() {
  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      <header className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-silver-700/30">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-display font-bold tracking-tight text-titanium-50">
            RealSyncDynamics.AI
          </span>
        </Link>

        <Link
          to="/contact-sales?intent=ai-governance"
          className="surface-mono inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Founding Access starten <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <section className="px-4 sm:px-6 lg:px-8 pt-14 pb-10 sm:pt-20 sm:pb-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-4">
            AI Governance · EU AI Act · DSGVO · Runtime Readiness
          </div>

          <h1 className="font-display font-bold text-4xl sm:text-6xl text-titanium-50 tracking-tight leading-[1.03] max-w-4xl">
            Das Governance-Betriebssystem für AI-Nutzung im Unternehmen.
          </h1>

          <p className="mt-6 max-w-3xl text-base sm:text-xl text-silver-300 leading-relaxed">
            Unternehmen nutzen ChatGPT, Claude, Copilot, Cursor, interne Agents und
            AI-Workflows — aber häufig ohne Inventar, Policy Enforcement oder Prüfpfad.
            RealSyncDynamicsAI macht AI-Systeme sichtbar, bewertbar und nachweisbar.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/contact-sales?intent=ai-governance"
              className="surface-mono inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold rounded-none"
            >
              Founding Access starten <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/ai-act-faq"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-silver-500 hover:border-titanium-200 text-silver-100 hover:text-titanium-50 text-base font-semibold rounded-none transition-colors"
            >
              EU AI Act FAQ
            </Link>
          </div>
        </div>
      </section>

      <AiGovernanceDashboard />

      {/* Runtime Telemetry — der zweite Layer: was tatsaechlich passiert */}
      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-950/50">
        <div className="max-w-5xl mx-auto text-center">
          <Activity className="mx-auto h-10 w-10 text-gold-400 mb-5" />
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            Vom Inventar zur Runtime
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight">
            Von AI-Inventar zu Runtime Governance.
          </h2>
          <p className="mt-4 text-silver-300 leading-relaxed max-w-3xl mx-auto">
            Inventory zeigt was Sie haben. Runtime zeigt was tatsächlich passiert — pro Mitarbeiter,
            pro Agent, pro Vendor. Telemetrie aus SDK, Browser-Extension und Agent-Connectors
            landet im Evidence Vault, kritische Events triggern Policies automatisch.
          </p>
        </div>
      </section>

      <RuntimeDashboard />

      {/* Browser Extension Detection-Layer */}
      <BrowserExtensionSection />

      {/* Policy Engine — Verdicts pro Event */}
      <PolicyEngineSection />

      {/* Enterprise Evidence Vault — Tamper-Evident-Audit-Trail */}
      <EnterpriseEvidenceVaultSection />

      {/* Agent Connectors — SDK + Workflow-Integrationen */}
      <AgentConnectorsSection />

      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <Capability
            title="AI Inventory"
            text="Alle AI-Systeme, Modelle, Vendors, Datenarten, Owner und Zwecke zentral erfassen."
          />
          <Capability
            title="Policy Engine"
            text="Regeln für externe Modelle, personenbezogene Daten, Human Review und Logging definieren."
          />
          <Capability
            title="Evidence Vault"
            text="Klassifizierungen, Freigaben, Policy-Verstöße und Audit-Ereignisse nachvollziehbar dokumentieren."
          />
        </div>
      </section>

      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-titanium-100 mb-5" />
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight">
            Von Website-Compliance zu AI Governance Infrastructure.
          </h2>
          <p className="mt-4 text-silver-300 leading-relaxed">
            Der nächste Schritt ist nicht noch ein Dokumentengenerator, sondern eine
            laufende Governance-Schicht für AI-Systeme, Datenflüsse und Agent-Aktionen.
          </p>
        </div>
      </section>
    </div>
  );
}

function Capability({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-obsidian-900/60 border border-silver-700/30 p-6">
      <h3 className="font-display font-bold text-xl text-titanium-50">{title}</h3>
      <p className="mt-3 text-sm text-silver-300 leading-relaxed">{text}</p>
    </div>
  );
}
