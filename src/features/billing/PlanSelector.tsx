/**
 * Plan Selector — Interactive tier card grid with Checkout CTA
 *
 * Displays all PUBLIC_PRICING_TIERS (starter → partner) with feature comparison,
 * highlight states, and CTA buttons.
 */

import React from 'react';
import { PUBLIC_PRICING_TIERS, type TierId, TIER_ACCENT, PRICING_TRUST_NOTE } from '../../config/pricing';
import { getComplianceBanner } from '../../lib/compliance-notices';

export interface PlanSelectorProps {
  selectedPlan?: TierId;
  onSelectPlan: (planId: TierId) => void;
  isLoading?: boolean;
  disabled?: boolean;
  testIdPrefix?: 'pricing' | 'checkout';
}

export function PlanSelector({
  selectedPlan,
  onSelectPlan,
  isLoading = false,
  disabled = false,
  testIdPrefix = 'pricing',
}: PlanSelectorProps) {
  return (
    <div className="w-full bg-obsidian-900 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-titanium-50 mb-4">
            Wähle deinen Plan
          </h2>
          <p className="text-titanium-300 max-w-2xl mx-auto">
            Von kostenlos bis Enterprise — alle Funktionen skalieren mit deinen Anforderungen.
            14 Tage kostenlos testen, jederzeit kündbar.
          </p>
        </div>

        {/* Compliance Banner */}
        <div className="bg-obsidian-800 border border-titanium-700 rounded-lg p-4 mb-12 text-center">
          <p className="text-sm text-titanium-300">
            {getComplianceBanner('paid_subscription')}
          </p>
        </div>

        {/* Tier Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
          {PUBLIC_PRICING_TIERS.map((tier) => {
            const isSelected = selectedPlan === tier.id;
            const accentStyle = TIER_ACCENT[tier.id];

            return (
              <div
                key={tier.id}
                data-testid={`${testIdPrefix}-card-${tier.id}`}
                className={`relative rounded-none transition-all ${
                  tier.highlight ? 'ring-2 ring-security-500 lg:scale-105' : ''
                } ${isSelected ? 'ring-2 ring-ai-cyan-400' : ''}`}
              >
                <div className={`bg-obsidian-800 border-2 ${accentStyle.border} p-6 h-full flex flex-col`}>
                  {/* Badges */}
                  {tier.badges && tier.badges.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {tier.badges.map((badge) => (
                        <span
                          key={badge}
                          className="text-xs font-bold uppercase tracking-wider bg-security-900 text-security-300 px-2 py-1"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Title */}
                  <h3 className={`text-xl font-bold mb-2 ${accentStyle.text}`}>
                    {tier.name}
                  </h3>

                  {/* Price */}
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-titanium-50">
                      {tier.priceString}
                      <span className="text-lg text-titanium-400"> €</span>
                    </div>
                    <p className="text-sm text-titanium-400">{tier.priceSuffix}</p>
                  </div>

                  {/* Tagline */}
                  <p className="text-sm text-titanium-300 mb-6">{tier.tagline}</p>

                  {/* Bots Quota (if applicable) */}
                  {tier.botsQuota.maxBots > 0 && (
                    <div className="mb-6 pb-6 border-b border-obsidian-700">
                      <p className="text-xs text-titanium-400 mb-2">Governance-Bots</p>
                      <p className="text-sm font-semibold text-titanium-50">
                        {tier.botsQuota.maxBots} Bots · {tier.botsQuota.maxAnswersPerMonth.toLocaleString('de-DE')} Antworten/mo
                      </p>
                    </div>
                  )}

                  {/* Features List */}
                  <ul className="flex-1 space-y-3 mb-6">
                    {tier.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex gap-3 text-sm text-titanium-300">
                        <span className="text-security-400 mt-0.5 flex-shrink-0">✓</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    data-testid={testIdPrefix === 'pricing' ? `pricing-book-${tier.id}` : `checkout-plan-${tier.id}`}
                    onClick={() => onSelectPlan(tier.id)}
                    disabled={disabled || isLoading}
                    className={`w-full py-3 px-4 font-bold uppercase tracking-wider transition-all ${
                      isSelected
                        ? 'bg-ai-cyan-500 text-obsidian-900 hover:bg-ai-cyan-400'
                        : tier.highlight
                          ? 'bg-security-500 text-white hover:bg-security-600'
                          : 'bg-obsidian-700 text-titanium-50 hover:bg-obsidian-600 border border-titanium-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isLoading && <span className="inline-block mr-2">⏳</span>}
                    {tier.cta.label}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust Note */}
        <div className="text-center text-sm text-titanium-400">
          {PRICING_TRUST_NOTE}
        </div>
      </div>
    </div>
  );
}
