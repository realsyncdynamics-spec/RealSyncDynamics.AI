import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { RoadmapSection } from '../components/sections/RoadmapSection';
import { usePageMeta } from '../lib/usePageMeta';

/**
 * /roadmap — public roadmap page.
 *
 * Thin wrapper around <RoadmapSection /> so the same section component can be
 * re-used as a teaser on the landing page later if we want one.
 */
export function Roadmap() {
  usePageMeta({
    title: 'Roadmap — RealSyncDynamics.AI',
    description:
      'Geplante und in Entwicklung befindliche Funktionen für Continuous Compliance Monitoring, Audit-Trails und AI-Act-Readiness.',
    url: 'https://realsyncdynamicsai.de/roadmap',
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
            <Compass className="h-4 w-4 text-titanium-50" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Roadmap</div>
        </div>
      </header>

      <main>
        <RoadmapSection />
      </main>

      <footer className="border-t border-titanium-900 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto text-xs text-titanium-500 flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 RealSync Dynamics · Status ehrlich kommuniziert · Made in Germany</span>
          <Link to="/legal/methodology" className="hover:text-titanium-300">Methodik 2026.05.0</Link>
        </div>
      </footer>
    </div>
  );
}
