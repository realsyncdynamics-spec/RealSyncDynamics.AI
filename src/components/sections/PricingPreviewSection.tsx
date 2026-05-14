import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PLANS } from '../../content/runtimeVocab';

// PricingPreviewSection — slim, four-card preview that lives on the landing.
// The full /pricing page can still hold a feature matrix; this section's
// job is to make the cost legible at-a-glance and route into activation.

export function PricingPreviewSection() {
  return (
    <section
      aria-label="Pricing preview"
      className="bg-obsidian-900 border-b border-titanium-900 py-20 sm:py-28 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            04 · Pricing
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            Four plans. One runtime.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Free scant einmal. Monitoring hält die Runtime an. Governance fügt den AI-Act-Layer hinzu.
            Scale ist für mehrere Domains und SSO.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          {PLANS.map((plan, i) => {
            const isFeatured = i === 1; // Monitoring is the recommended tier
            return (
              <article
                key={plan.id}
                className={[
                  'bg-obsidian-950 p-6 flex flex-col gap-4',
                  isFeatured ? 'lg:-mt-3 lg:mb-0 lg:-mb-0 ring-1 ring-cyan-500/30' : '',
                ].join(' ')}
              >
                <header>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <h3 className="text-lg font-display font-semibold text-titanium-50">{plan.name}</h3>
                    {isFeatured && (
                      <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-300 px-1.5 py-0.5 border border-cyan-500/30">
                        recommended
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-titanium-500">
                    {plan.tagline}
                  </p>
                </header>

                <div className="font-display font-semibold text-3xl text-titanium-50 tabular-nums">
                  {plan.headline}
                  {plan.headline.startsWith('€') && plan.id !== 'free' && (
                    <span className="text-xs text-titanium-500 ml-1">/ mo</span>
                  )}
                </div>

                <ul className="flex-1 space-y-1.5 pt-2 border-t border-titanium-900/60">
                  {plan.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-[12px] text-titanium-300">
                      <span className="inline-block w-1 h-1 bg-titanium-600 mt-2 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={plan.cta.to}
                  className={[
                    'inline-flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold tracking-tight transition-colors',
                    plan.cta.kind === 'primary'
                      ? 'bg-titanium-50 text-obsidian-950 hover:bg-titanium-200'
                      : 'bg-obsidian-900 text-titanium-100 hover:bg-obsidian-800 border border-titanium-800',
                  ].join(' ')}
                >
                  {plan.cta.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/pricing"
            className="text-xs text-titanium-400 hover:text-titanium-100 underline transition-colors font-mono"
          >
            Full plan comparison →
          </Link>
        </div>
      </div>
    </section>
  );
}
