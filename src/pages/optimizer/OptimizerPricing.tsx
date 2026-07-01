/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SEITE 6 — /optimizer/pricing  (Preisübersicht)
 * Typ: INFO + ACTION. Paket-Karten aus OPTIMIZER_TIERS.
 *   „Paket wählen" → /optimizer/auth (nicht eingeloggt)
 *                  → /optimizer/checkout (eingeloggt, Phase 3; bis dahin
 *                     kanonische /pricing-Strecke mit echtem Stripe).
 */

import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Info } from 'lucide-react';

import { OptimizerLayout } from './OptimizerLayout';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import {
  OPTIMIZER_TIERS, formatTierPrice, isPaidTier, MIN_TIER_FOR_FULL_REPORT,
  type OptimizerTier,
} from '../../lib/optimizer/tiers';

export function OptimizerPricing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSupabaseAuth();

  function choose(tier: OptimizerTier) {
    if (tier.id === 'gratis') {
      // Gratis braucht keinen Checkout — direkt zum (bei Auth) Bericht.
      navigate(isAuthenticated ? '/optimizer/dashboard' : '/optimizer/auth');
      return;
    }
    if (!isAuthenticated) {
      navigate('/optimizer/auth');
      return;
    }
    // TODO(Phase 3): → /optimizer/checkout?tier=<id>
    // Bis dahin: kanonische Paket-/Checkout-Strecke (echtes Stripe).
    navigate('/pricing');
  }

  const minTier = OPTIMIZER_TIERS.find((t) => t.id === MIN_TIER_FOR_FULL_REPORT);

  return (
    <OptimizerLayout
      step={5}
      pageType="info"
      backTo="/optimizer/results"
      metaTitle="Pakete — Cloud Code Optimizer"
      metaDescription="Wähle dein Paket: vom kostenlosen Scan bis zu Auto-Fix und kontinuierlichem Monitoring."
    >
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 tracking-tight mb-3">
        Wähle dein Paket
      </h1>

      {minTier && (
        <p className="inline-flex items-start gap-2 text-sm text-titanium-300 bg-obsidian-900 border border-titanium-900 rounded-none p-3 mb-8">
          <Info className="h-4 w-4 text-security-400 shrink-0 mt-0.5" aria-hidden />
          <span>
            Für den <span className="text-titanium-100 font-semibold">vollständigen Bericht</span> brauchst du
            mindestens <span className="text-titanium-100 font-semibold">{minTier.name}</span>.
          </span>
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {OPTIMIZER_TIERS.map((tier) => (
          <div
            key={tier.id}
            className={
              'flex flex-col border rounded-none p-5 ' +
              (tier.highlight ? 'border-security-600 bg-security-900/15' : 'border-titanium-900 bg-obsidian-900')
            }
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-display font-bold text-titanium-50">{tier.name}</span>
              {tier.highlight && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-security-300">beliebt</span>
              )}
            </div>
            <div className="font-mono text-xl text-titanium-100 mb-1 tabular-nums">{formatTierPrice(tier)}</div>
            <div className="text-xs text-titanium-500 mb-4">{tier.tagline}</div>

            <div className="flex items-start gap-2 text-sm text-titanium-300 mb-6 flex-1">
              <Check className={`h-4 w-4 shrink-0 mt-0.5 ${isPaidTier(tier.id) ? 'text-petrol' : 'text-titanium-600'}`} aria-hidden />
              <span>{tier.optimizerFeature}</span>
            </div>

            <button
              type="button"
              onClick={() => choose(tier)}
              className={
                'inline-flex items-center justify-center gap-2 font-bold px-4 py-2.5 rounded-none transition-colors ' +
                (tier.highlight
                  ? 'bg-security-500 hover:bg-security-400 text-white'
                  : 'border border-titanium-700 hover:border-titanium-500 text-titanium-100')
              }
            >
              {tier.id === 'gratis' ? 'Kostenlos starten' : 'Paket wählen'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </OptimizerLayout>
  );
}
