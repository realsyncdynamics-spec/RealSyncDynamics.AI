import { Link } from 'react-router-dom';
import { ArrowLeft, Network } from 'lucide-react';
import {
  GovernanceRuntimeDashboard,
  GovernanceRuntimeDisclaimer,
} from '../features/governance/GovernanceRuntimeDashboard';
import { usePageMeta } from '../lib/usePageMeta';

/**
 * /governance-runtime — public preview of the Operational AI Governance
 * Infrastructure. Renders the dashboard shell with demo data so prospects
 * can see the four pillars (Runtime Telemetry · Policy Engine ·
 * Evidence Vault · AI Governance Graph) before a pilot starts.
 */
export function GovernanceRuntimePage() {
  usePageMeta({
    title: 'Governance Runtime — RealSyncDynamics.AI',
    description:
      'Operational AI Governance Infrastructure: Runtime Telemetry, Policy Engine, Evidence Vault und AI Governance Graph für regulierte Unternehmen — Demo-Ansicht.',
    url: 'https://RealSyncDynamicsAI.de/governance-runtime',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link
          to="/"
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
          aria-label="Zur Startseite"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-titanium-500 to-titanium-700 flex items-center justify-center">
            <Network className="h-4 w-4 text-titanium-50" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
            Governance Runtime
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 sm:mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Operational AI Governance Infrastructure
            </div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl">
              Event-driven Compliance Runtime für Websites, AI-Systeme und Lieferketten
            </h1>
            <p className="mt-4 max-w-3xl text-base sm:text-lg text-silver-300 leading-relaxed">
              Vier Pillars in einem Datenmodell: Runtime Telemetry, Policy Engine, Evidence Vault
              und AI Governance Graph. Browser-Extension, SDK, GitHub-Webhooks und Agent-Connectors
              speisen einen gemeinsamen Event-Stream — DSGVO-, TTDSG- und AI-Act-relevante
              Ereignisse werden auditierbar.
            </p>
          </div>

          <GovernanceRuntimeDashboard />
          <GovernanceRuntimeDisclaimer />
        </div>
      </main>

      <footer className="border-t border-titanium-900 px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto text-xs text-titanium-500 flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 RealSync Dynamics · EU-Hosted · Made in Germany</span>
          <div className="flex gap-4">
            <Link to="/legal/methodology" className="hover:text-titanium-300">Methodik</Link>
            <Link to="/security"          className="hover:text-titanium-300">Security</Link>
            <Link to="/contact-sales?intent=governance-pilot&source=governance-runtime" className="hover:text-titanium-300">
              Pilot anfragen
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
