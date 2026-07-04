import { Link } from 'react-router-dom';
import { ArrowRight, Activity } from 'lucide-react';

/**
 * Reusable CTA block for the SEO money pages.
 *
 * Title and copy intentionally neutral:
 *   - no guarantee language
 *   - no Bußgeld / Abmahnung framing
 *   - explicit "technische Vorprüfung" tone
 *
 * Two CTAs:
 *   1. /audit  — primary, free entry point
 *   2. /pricing (optional) — secondary, recurring monitoring upgrade
 */
interface Props {
  source: string;                  // tracking tag baked into the audit href
  showSecondary?: boolean;         // default: true
  secondaryHref?: string;          // default: '/pricing'
  secondaryLabel?: string;         // default: 'Monitoring ansehen'
}

export function AuditCTA({
  source,
  showSecondary = true,
  secondaryHref = '/pricing',
  secondaryLabel = 'Monitoring ansehen',
}: Props) {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-14 sm:py-16 bg-obsidian-900/40">
      <div className="max-w-3xl mx-auto text-center">
        <Activity className="h-5 w-5 text-gold-400 mx-auto mb-3" strokeWidth={1.5} />
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 tracking-tight leading-tight mb-3">
          Website technisch vorprüfen
        </h2>
        <p className="text-sm sm:text-base text-silver-300 leading-relaxed max-w-xl mx-auto mb-6">
          Starten Sie den kostenlosen Audit und erhalten Sie eine strukturierte Einschätzung möglicher
          DSGVO-, TDDDG- und Tracking-Risiken.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={`/audit?source=${encodeURIComponent(source)}`}
            className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
          >
            Kostenlosen Audit starten <ArrowRight className="h-4 w-4" />
          </Link>
          {showSecondary && (
            <Link
              to={secondaryHref}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
        <p className="mt-5 text-[11px] text-silver-500 max-w-xl mx-auto leading-relaxed">
          Der Audit ersetzt keine individuelle Rechtsberatung und keine vollständige technische Prüfung.
        </p>
      </div>
    </section>
  );
}
