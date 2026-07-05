import { Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { getFeatureBySlug, getPlansByFeature } from '../../content/pricingContent';

interface FeatureDetailPageProps {
  featureSlug: string;
}

export function FeatureDetailPage({ featureSlug }: FeatureDetailPageProps) {
  const feature = getFeatureBySlug(featureSlug);
  const plans = getPlansByFeature(featureSlug);

  if (!feature) {
    return (
      <div className="min-h-screen bg-hero-only flex items-center justify-center text-titanium-50">
        <div className="text-center">
          <h1 className="font-display font-bold text-3xl mb-4">Feature nicht gefunden</h1>
          <Link to="/pricing" className="surface-mono inline-flex items-center gap-2 px-5 py-3 text-sm font-bold">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50" data-testid={`feature-detail-${feature.slug}`}>
      {/* Top bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm text-silver-300 hover:text-titanium-50" data-testid="feature-back-to-pricing">
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Übersicht
        </Link>
      </div>

      {/* Main content */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 flex-grow">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-12 pb-12 border-b border-silver-700/30">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
              Feature · Detailinformation
            </div>
            <h1 className="font-display font-bold text-4xl sm:text-5xl mb-2">{feature.title}</h1>
            <p className="text-lg text-silver-300">{feature.subtitle}</p>
          </div>

          {/* What it does */}
          <section className="mb-12 pb-12 border-b border-silver-700/30">
            <h2 className="font-display font-bold text-2xl mb-4">Was macht diese Funktion?</h2>
            <p className="text-base text-silver-300 leading-relaxed">{feature.whatItDoes}</p>
          </section>

          {/* Why it matters */}
          <section className="mb-12 pb-12 border-b border-silver-700/30">
            <h2 className="font-display font-bold text-2xl mb-4">Warum ist das wichtig?</h2>
            <p className="text-base text-silver-300 leading-relaxed">{feature.whyItMatters}</p>
          </section>

          {/* Customer benefit */}
          <section className="mb-12 pb-12 border-b border-silver-700/30">
            <h2 className="font-display font-bold text-2xl mb-4">Was hat der Kunde konkret davon?</h2>
            <p className="text-base text-silver-300 leading-relaxed">{feature.customerBenefit}</p>
          </section>

          {/* Included in plans */}
          <section className="mb-12 pb-12 border-b border-silver-700/30">
            <h2 className="font-display font-bold text-2xl mb-6">In welchen Paketen enthalten?</h2>
            {plans.length > 0 ? (
              <div className="space-y-2">
                {plans.map((plan) => (
                  <Link
                    key={plan.slug}
                    to={`/pricing/${plan.slug}`}
                    className="flex items-center justify-between p-4 bg-obsidian-900/60 border border-silver-700/30 hover:border-titanium-200/60 rounded-none transition-colors group"
                    data-testid={`feature-plan-link-${plan.slug}`}
                  >
                    <div>
                      <h3 className="font-display font-bold text-titanium-50">{plan.name}</h3>
                      <p className="text-sm text-silver-300">{plan.priceString} {plan.interval}</p>
                    </div>
                    <Check className="h-5 w-5 text-emerald-400 group-hover:text-emerald-300" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-base text-silver-300">Dieses Feature ist derzeit in keinem Paket enthalten.</p>
            )}
          </section>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/pricing" className="surface-mono py-4 text-base font-bold rounded-none text-center hover:bg-opacity-90 flex-1" data-testid="feature-back-to-paketubersicht">
              Zurück zur Paketübersicht
            </Link>
            {plans.length > 0 && (
              <Link
                to={`/pricing/${plans[0]?.slug || 'growth'}`}
                className="py-4 px-6 text-base font-bold rounded-none text-center bg-obsidian-900/60 border border-titanium-200/30 text-titanium-50 hover:border-titanium-200/60 transition-colors flex-1"
                data-testid={`feature-view-plan-${plans[0]?.slug || 'growth'}`}
              >
                Passenden Plan ansehen
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-silver-700/40 px-4 sm:px-6 lg:px-8 py-4 mt-12">
        <div className="max-w-5xl mx-auto text-[10px] font-mono uppercase tracking-wider text-silver-500">
          <p>© 2026 RealSync Dynamics · Made in Germany</p>
        </div>
      </footer>
    </div>
  );
}
