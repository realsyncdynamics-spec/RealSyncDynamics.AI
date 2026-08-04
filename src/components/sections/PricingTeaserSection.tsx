import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { UnifiedPricingGrid } from '../pricing/unified/UnifiedPricingGrid';
import { PRICING_TRUST_NOTE } from '../../config/pricing';

/**
 * PricingTeaserSection — wiederverwendbarer Preis-Teaser für Long-Form-
 * Landings (Hero + Niche-Pages). Nutzt UnifiedPricingGrid für konsistente,
 * wartungsfreie Darstellung über alle Surfaces.
 */
export interface PricingTeaserProps {
  sourceTag: string;
}

export function PricingTeaserSection({ sourceTag }: PricingTeaserProps) {
  const contactHref = `/contact-sales?intent=pricing&source=${encodeURIComponent(sourceTag)}`;

  return (
    <section
      id="preise"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            Preise
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
            Professional Governance Runtime für Unternehmen
          </h2>
        </div>

        {/* Unified Pricing Grid */}
        <div className="mb-8">
          <UnifiedPricingGrid
            variant="landing"
            highlight="growth"
            source={sourceTag}
          />
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            to="/pricing"
            className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded"
          >
            Alle Preise + Enterprise <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to={contactHref}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded transition-colors"
          >
            AI Agent fragen
          </Link>
        </div>

        <p className="mt-4 text-center text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
          {PRICING_TRUST_NOTE}
        </p>
      </div>
    </section>
  );
}
