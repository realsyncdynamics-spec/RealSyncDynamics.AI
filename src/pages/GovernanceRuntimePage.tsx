import { Link } from 'react-router-dom';
import { ArrowLeft, Network } from 'lucide-react';
import { GovernanceRuntimeDashboard } from '../features/governance/GovernanceRuntimeDashboard';
import { usePageMeta } from '../lib/usePageMeta';

/**
 * /governance-runtime — public preview of the Operational AI Governance
 * Infrastructure. The dashboard component already brings its own section
 * wrapper, eyebrow, headline and CTA — this page only adds the route
 * chrome (back-link header + footer) and head meta.
 */
export function GovernanceRuntimePage() {
  usePageMeta({
    title: 'Governance Runtime — RealSyncDynamics.AI',
    description:
      'Operational AI Governance Infrastructure: Event-driven Compliance für AI-Systeme, Websites und Agents — Demo-Ansicht der Produktstruktur.',
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

      <main>
        <GovernanceRuntimeDashboard />
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
