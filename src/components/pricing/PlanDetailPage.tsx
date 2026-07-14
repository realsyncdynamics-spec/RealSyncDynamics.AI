import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { getPlanBySlug, getFeaturesByPlan, ALL_PLAN_SLUGS } from '../../content/pricingContent';

interface PlanDetailPageProps {
  planSlug: string;
}

export function PlanDetailPage({ planSlug }: PlanDetailPageProps) {
  const navigate = useNavigate();
  const plan = getPlanBySlug(planSlug);
  const features = getFeaturesByPlan(planSlug);

  if (!plan) {
    return (
      <div className="min-h-screen bg-hero-only flex items-center justify-center text-titanium-50">
        <div className="text-center">
          <h1 className="font-display font-bold text-3xl mb-4">Paket nicht gefunden</h1>
          <Link to="/pricing" className="surface-mono inline-flex items-center gap-2 px-5 py-3 text-sm font-bold">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  const planIndex = ALL_PLAN_SLUGS.indexOf(planSlug);
  const prevPlan = planIndex > 0 ? ALL_PLAN_SLUGS[planIndex - 1] : null;
  const nextPlan = planIndex < ALL_PLAN_SLUGS.length - 1 ? ALL_PLAN_SLUGS[planIndex + 1] : null;

  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50" data-testid={`plan-detail-${plan.slug}`}>
      {/* Top bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm text-silver-300 hover:text-titanium-50" data-testid="plan-detail-back">
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Übersicht
        </Link>
      </div>

      {/* Hero section */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 flex-grow">
        <div className="max-w-3xl mx-auto">
          {/* Price header */}
          <div className="mb-8">
            {plan.badge && (
              <div className="inline-block mb-3 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] bg-titanium-200/10 border border-titanium-200/30 text-titanium-100 rounded-none">
                {plan.badge}
              </div>
            )}
            <h1 className="font-display font-bold text-4xl sm:text-5xl mb-2">{plan.name}</h1>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold">{plan.priceString}</span>
              <span className="text-sm text-silver-300">{plan.interval}</span>
            </div>
            <p className="text-lg text-silver-300 leading-relaxed">{plan.shortDescription}</p>
          </div>

          {/* Trial info */}
          {plan.trial && (
            <div className="mb-8 p-4 bg-obsidian-900/60 border border-titanium-200/30 rounded-none">
              <p className="text-sm text-titanium-300">
                <strong>{plan.trial.days} Tage kostenlos testen.</strong> {plan.trial.description}
              </p>
            </div>
          )}

          {/* Main CTA button */}
          <div className="mb-12">
            <button
              onClick={() => navigate(plan.checkoutPath)}
              className="w-full surface-mono py-4 text-base font-bold rounded-none text-center hover:bg-opacity-90"
              data-testid="plan-cta-button"
            >
              {plan.cta.label}
            </button>
          </div>

          {/* For whom section */}
          <section className="mb-12 pb-12 border-b border-silver-700/30">
            <h2 className="font-display font-bold text-2xl mb-4">Für wen ist dieser Plan gedacht?</h2>
            <p className="text-base text-silver-300 leading-relaxed">{plan.targetAudience}</p>
          </section>

          {/* What customer gets section */}
          <section className="mb-12 pb-12 border-b border-silver-700/30">
            <h2 className="font-display font-bold text-2xl mb-6">Was bekommt der Kunde konkret?</h2>
            <ul className="space-y-3">
              {plan.whatCustomerGets.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-titanium-200/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="h-2 w-2 rounded-full bg-titanium-200" />
                  </div>
                  <span className="text-base text-silver-300">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Problems solved section */}
          {plan.problemsSolved.length > 0 && (
            <section className="mb-12 pb-12 border-b border-silver-700/30">
              <h2 className="font-display font-bold text-2xl mb-6">Welche Probleme löst dieser Plan?</h2>
              <ul className="space-y-2">
                {plan.problemsSolved.map((problem, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-base text-silver-300">
                    <span className="text-titanium-200 mr-2">•</span>
                    {problem}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Detailed sections */}
          {plan.detailedSections.map((section, idx) => (
            <section key={idx} className="mb-12 pb-12 border-b border-silver-700/30">
              <h2 className="font-display font-bold text-2xl mb-4">{section.title}</h2>
              <p className="text-base text-silver-300 leading-relaxed">{section.content}</p>
            </section>
          ))}

          {/* Features included section */}
          <section className="mb-12 pb-12 border-b border-silver-700/30">
            <h2 className="font-display font-bold text-2xl mb-6">Enthaltene Features</h2>
            <div className="space-y-3">
              {features.map((feature) => (
                <div
                  key={feature.slug}
                  className="flex items-start justify-between gap-4 p-4 bg-obsidian-900/60 border border-silver-700/30 hover:border-titanium-200/60 rounded-none transition-colors group"
                >
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-titanium-50 mb-1">{feature.title}</h3>
                    <p className="text-sm text-silver-300">{feature.subtitle}</p>
                  </div>
                  <Link
                    to={`/features/${feature.slug}`}
                    className="flex items-center justify-center w-10 h-10 shrink-0 text-titanium-200 hover:text-titanium-50 transition-colors"
                    title="Mehr Details"
                    data-testid={`feature-link-${feature.slug}`}
                  >
                    <Info className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* After purchase section */}
          <section className="mb-12 pb-12 border-b border-silver-700/30">
            <h2 className="font-display font-bold text-2xl mb-4">Was passiert nach der Buchung?</h2>
            <ol className="space-y-3">
              {[
                'Sie werden zur Bezahlung weitergeleitet (Stripe)',
                'Nach erfolgreicher Zahlung erhalten Sie eine Bestätigungs-E-Mail',
                'Ihr Account wird sofort aktiviert',
                'Sie können sich anmelden und mit der Nutzung beginnen',
              ].map((step, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-titanium-200/20 text-[12px] font-bold text-titanium-200 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-base text-silver-300 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Bottom CTA */}
          <div className="mb-12">
            <button
              onClick={() => navigate(plan.checkoutPath)}
              className="w-full surface-mono py-4 text-base font-bold rounded-none text-center hover:bg-opacity-90"
            >
              {plan.cta.label}
            </button>
          </div>
        </div>
      </section>

      {/* Navigation */}
      <section className="px-4 sm:px-6 lg:px-8 py-8 border-t border-silver-700/30">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          {prevPlan ? (
            <Link
              to={`/pricing/${prevPlan}`}
              className="flex items-center gap-2 text-sm font-bold text-silver-300 hover:text-titanium-50"
              data-testid="plan-nav-prev"
            >
              <ArrowLeft className="h-4 w-4" />
              Vorheriger Plan
            </Link>
          ) : (
            <div />
          )}
          <Link to="/pricing" className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-300 hover:text-titanium-50">
            Zur Übersicht
          </Link>
          {nextPlan ? (
            <Link
              to={`/pricing/${nextPlan}`}
              className="flex items-center gap-2 text-sm font-bold text-silver-300 hover:text-titanium-50"
              data-testid="plan-nav-next"
            >
              Nächster Plan
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-silver-700/40 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto text-[10px] font-mono uppercase tracking-wider text-silver-500">
          <p>© 2026 RealSync Dynamics · Made in Germany</p>
        </div>
      </footer>
    </div>
  );
}
