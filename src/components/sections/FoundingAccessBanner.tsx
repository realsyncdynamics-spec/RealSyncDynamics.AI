import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { CTA } from '../../content/runtimeVocab';

/**
 * Founding Access Banner — prominently displayed above hero.
 * Self-serve signup for founding member program.
 */
export function FoundingAccessBanner() {
  return (
    <section className="border-b border-titanium-900 bg-obsidian-900/80 px-4 sm:px-6 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          {/* Left: Headline + Subtext */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-amber-400" />
              <h2 className="font-display font-bold text-lg sm:text-xl text-titanium-50">
                Founding Access geöffnet.
              </h2>
            </div>
            <p className="text-sm sm:text-base text-titanium-300 max-w-2xl">
              Die ersten 100 Unternehmen erhalten priorisierten Zugang zur Governance-AI-Plattform.
            </p>
            <p className="text-xs sm:text-sm text-titanium-400 mt-2">
              Kostenlos testen. Feedback geben. Die Plattform aktiv mitgestalten.
            </p>
          </div>

          {/* Right: CTAs */}
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Link
              to="/audit?source=founding-banner"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-cyan-400 text-obsidian-950 text-sm font-semibold hover:bg-cyan-300 transition-colors rounded-none border-none"
            >
              Kostenlosen Audit starten
            </Link>
            <Link
              to="/welcome?source=founding-banner&intent=founding"
              className="inline-flex items-center justify-center px-5 py-2.5 border border-amber-500 text-amber-300 text-sm font-semibold hover:bg-amber-500/10 transition-colors rounded-none"
            >
              {CTA.foundingAccess}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
