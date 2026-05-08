import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * PricingTeaserSection — wiederverwendbarer 3-Tier-Preis-Teaser für Long-
 * Form-Landings (Hero + Niche-Pages). Preis-Daten sind hartcodiert auf
 * den kanonischen Tier-Stand der /pricing-Page (PricingPage.tsx).
 *
 * Source-Tag landet als ?source-Param am Sales-CTA, damit Lead-Inbox
 * sehen kann, ob die Conversion aus Hero / Niche-SaaS / Niche-Praxen /
 * Niche-Agenturen kam.
 */
export interface PricingTeaserProps {
  sourceTag: string;            // 'hero' | 'fuer-saas' | 'fuer-agenturen' | 'fuer-praxen'
}

const TIERS = [
  {
    name: 'Scan',
    price: 'Kostenlos',
    tagline: 'Schneller DSGVO-Check',
    bullets: ['Einmaliger Domain-Scan', 'Risk-Score + Top-3-Findings', 'Kein Account nötig'],
    highlight: false,
  },
  {
    name: 'Protect',
    price: '99 € / Monat',
    tagline: 'Compliance-Standard · 1 Domain',
    bullets: ['Vollständiger Audit + Paragraphenbezug', 'DSE + AVV automatisch generiert', 'Wöchentlicher Re-Audit + Alerts'],
    highlight: true,
  },
  {
    name: 'Comply',
    price: '249 € / Monat',
    tagline: 'AI-Act + Multi-Domain',
    bullets: ['VVT + TOM + AI-Act-Risk', 'Bis zu 5 Domains', 'API + Signierte PDF-Exports'],
    highlight: false,
  },
];

export function PricingTeaserSection({ sourceTag }: PricingTeaserProps) {
  const contactHref = `/contact-sales?intent=pricing&source=${encodeURIComponent(sourceTag)}`;

  return (
    <section
      id="preise"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            Preise
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
            Plan für jede Unternehmensgröße
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative p-5 sm:p-6 bg-obsidian-900/60 border rounded-none transition-colors ${
                tier.highlight
                  ? 'border-gold-400/80'
                  : 'border-silver-700/30 hover:border-gold-400/60'
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-5 px-2 py-0.5 bg-gold-400 text-obsidian-950 font-mono uppercase tracking-wider text-[10px] font-bold">
                  Empfohlen
                </div>
              )}
              <div className="font-display font-bold text-titanium-50 text-base sm:text-lg mt-1 mb-1">
                {tier.name}
              </div>
              <div className="text-2xl font-display font-bold text-gold-400 mb-1.5 tabular-nums">
                {tier.price}
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-silver-400 mb-3">
                {tier.tagline}
              </div>
              <ul className="space-y-1.5 text-sm text-silver-300">
                {tier.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="text-gold-400 shrink-0 leading-relaxed">+</span>
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            to="/pricing"
            className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
          >
            Alle Preise + Enterprise <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to={contactHref}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
          >
            Beratungstermin vereinbaren
          </Link>
        </div>

        <p className="mt-4 text-center text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
          Free-Tier verfügbar · Monatlich kündbar · Keine Kreditkarte für Trial
        </p>
      </div>
    </section>
  );
}
