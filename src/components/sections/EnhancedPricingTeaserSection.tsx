import { Link } from 'react-router-dom';
import { Check, ArrowRight, Zap } from 'lucide-react';
import { CTA } from '../../content/runtimeVocab';

interface PricingOption {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaUrl: string;
  highlight?: boolean;
}

const PRICING_OPTIONS: PricingOption[] = [
  {
    id: 'free',
    name: 'Free',
    price: '€0',
    period: 'einmalig',
    description: 'Der Einstieg ohne Karte',
    features: [
      '1 kostenlosen Website-Scan',
      'Risk-Score + Top-3 Findings',
      'Sofort-Export als PDF'
    ],
    cta: 'Kostenlosen Audit starten',
    ctaUrl: '/audit?source=pricing_teaser'
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    price: 'ab €79',
    period: '/Monat',
    description: 'Drift-Detection 24/7',
    features: [
      '1 Domain mit Drift-Monitoring',
      'Tägliche Re-Scans + Alerts',
      'Evidence-Chain',
      'Email + Slack-Benachrichtigungen'
    ],
    cta: 'Monitoring starten',
    ctaUrl: '/checkout/starter?source=pricing-landing'
  },
  {
    id: 'governance',
    name: 'Governance',
    price: 'ab €249',
    period: '/Monat',
    description: 'Vollständige Compliance-Automation',
    features: [
      'AI-Usecase-Registry',
      'EU AI Act Klassifikation',
      'DPIA-Templates + Policies',
      'Audit-Trail + §13 Drafts',
      'Evidence Vault'
    ],
    cta: 'Governance starten',
    ctaUrl: '/checkout/growth?source=pricing-landing',
    highlight: true
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 'ab €699',
    period: '/Monat',
    description: 'Multi-Domain + White-Label',
    features: [
      '10 Domains',
      'Kundenprofile + Subaccounts',
      'White-Label-Reports',
      'API-Zugang',
      'Custom Branding'
    ],
    cta: 'Agency starten',
    ctaUrl: '/checkout/agency?source=pricing-landing'
  }
];

/**
 * Enhanced Pricing Teaser — improved visibility and conversion on landing page.
 * Highlights best-value tier, clear feature matrices, prominent CTAs.
 */
export function EnhancedPricingTeaserSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20 bg-obsidian-900/30">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3">
            Transparente Preise
          </p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 mb-4">
            Preise — self-service, ohne Gespräch
          </h2>
          <p className="text-titanium-300 max-w-3xl mx-auto">
            Alle Tarife enthalten EU-Hosting (Frankfurt), den AVV und sind monatlich kündbar.
            Wählen Sie nach Domain-Anzahl und gewünschter Compliance-Tiefe.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {PRICING_OPTIONS.map((option) => (
            <div
              key={option.id}
              className={`border rounded-none transition-all ${
                option.highlight
                  ? 'border-amber-500 bg-obsidian-900 ring-2 ring-amber-500/30 md:col-span-2 lg:col-span-1 lg:scale-105'
                  : 'border-titanium-900 bg-obsidian-900/60 hover:border-titanium-700'
              } p-6 flex flex-col`}
            >
              {/* Highlight Badge */}
              {option.highlight && (
                <div className="flex items-center gap-1.5 mb-4 text-amber-300 text-xs font-mono uppercase tracking-wider">
                  <Zap className="h-3.5 w-3.5" />
                  Most Popular
                </div>
              )}

              {/* Tier Name */}
              <h3 className="font-display font-bold text-titanium-50 text-lg mb-1">
                {option.name}
              </h3>

              {/* Price */}
              <div className="mb-2">
                <span className="font-display font-bold text-2xl text-titanium-50">
                  {option.price}
                </span>
                <span className="text-xs text-titanium-400 ml-1">{option.period}</span>
              </div>

              {/* Description */}
              <p className="text-xs text-titanium-400 mb-5">{option.description}</p>

              {/* Features List */}
              <ul className="space-y-2 mb-6 flex-1">
                {option.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-titanium-300">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                to={option.ctaUrl}
                className={`inline-flex items-center justify-center gap-2 rounded-none text-sm font-semibold transition-colors py-2.5 px-4 w-full ${
                  option.highlight
                    ? 'bg-amber-500 text-obsidian-950 hover:bg-amber-400'
                    : 'border border-titanium-700 text-titanium-100 hover:border-titanium-500 hover:text-titanium-50'
                }`}
              >
                {option.cta}
                {option.highlight && <ArrowRight className="h-3.5 w-3.5" />}
              </Link>
            </div>
          ))}
        </div>

        {/* Secondary Links */}
        <div className="text-center text-sm text-titanium-400 space-y-2">
          <p>
            <Link to="/pricing" className="text-titanium-200 hover:text-titanium-50 underline-offset-4 hover:underline">
              Alle Tarife & Details anschauen
            </Link>{' '}
            · Vergleichstabelle, Features, FAQ
          </p>
          <p>
            Enterprise-Anfrage?{' '}
            <Link
              to="/contact-sales?tier=enterprise&source=pricing-landing"
              className="text-titanium-200 hover:text-titanium-50 underline-offset-4 hover:underline"
            >
              {CTA.enterprise}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
