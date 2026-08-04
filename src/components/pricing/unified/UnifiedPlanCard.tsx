/**
 * UnifiedPlanCard — einzige Präsentationskomponente für alle Preisplan-Darstellungen.
 *
 * Diese Komponente wird auf Landing Pages, Pricing-Seite, Checkout und überall
 * sonst eingesetzt, wo Pläne angezeigt werden. Alle Styling-, Layout- und
 * Struktur-Entscheidungen sind HIER zentralisiert — nicht in 5 verschiedenen
 * Orten repliziert.
 *
 * Verwendung:
 *   <UnifiedPlanCard plan={plan} variant="compact" highlight={true} />
 *   <UnifiedPlanCard plan={plan} variant="full" showComparison={true} />
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import {
  type Plan, formatPriceEur, TIER_ACCENT, type PlanId,
} from '../../../config/pricing';

export type UnifiedPlanCardVariant = 'compact' | 'full' | 'hero';

export interface UnifiedPlanCardProps {
  plan: Plan;
  variant?: UnifiedPlanCardVariant;
  /** Optional: Zeigt „Empfohlen" Badge */
  highlight?: boolean;
  /** Optional: CTA-Button Link/Action */
  onCta?: () => void;
  ctaHref?: string;
  /** Optional: Vergleich-Feature (für Pricing-Tabelle) */
  showComparison?: boolean;
  /** Optional: Inline-Vergleich */
  comparisonWith?: PlanId;
}

/**
 * Professionelle Plan-Karte — einheitliche Struktur:
 *
 *   1. Badge / Highlight
 *   2. Plan-Name
 *   3. Preis + Billing-Interval
 *   4. Outcome-Headline (was der Kunde BEKOMMT)
 *   5. Technical Subheadline (wie das funktioniert)
 *   6. Runtime-Limits (Top 3–4)
 *   7. Module (nach Bereich: GOVERN/AUTOMATE/ENGAGE)
 *   8. Feature-Highlights (4 Gruppen)
 *   9. CTA-Button
 */

export function UnifiedPlanCard({
  plan, variant = 'compact', highlight = false, onCta, ctaHref, showComparison, comparisonWith,
}: UnifiedPlanCardProps) {
  const accentClasses = TIER_ACCENT[plan.id as PlanId];
  const priceFormatted = formatPriceEur(plan.price.monthlyEur);
  const isFreePlan = plan.price.monthlyEur === 0;

  const commonCardClasses = `
    relative rounded-lg border transition-all duration-200
    ${highlight
      ? `border-gold-400 bg-gold-400/5 shadow-lg shadow-gold-400/20 ring-2 ring-gold-400/30`
      : `border-titanium-800 bg-obsidian-950/40 hover:border-titanium-700 hover:shadow-md`
    }
  `;

  // Compact: Teaser auf Landing Pages (klein, 4 Features)
  if (variant === 'compact') {
    return (
      <div className={`${commonCardClasses} p-5 sm:p-6 flex flex-col`}>
        {/* Badge */}
        {highlight && (
          <div className="mb-3 inline-flex w-fit items-center gap-1.5 px-3 py-1 bg-gold-400 text-obsidian-950 font-mono text-xs font-bold uppercase tracking-wider rounded">
            Empfohlen
          </div>
        )}
        {plan.badges?.[0] && !highlight && (
          <div className="mb-3 inline-flex w-fit items-center gap-1.5 px-2 py-0.5 bg-titanium-800/30 text-titanium-300 font-mono text-xs font-semibold uppercase tracking-wider rounded">
            {plan.badges[0]}
          </div>
        )}

        {/* Plan Name */}
        <h3 className="font-display font-bold text-lg sm:text-xl text-titanium-50 mb-2">
          {plan.name}
        </h3>

        {/* Price */}
        <div className="mb-1">
          <span className="text-3xl font-display font-bold text-gold-400">
            {isFreePlan ? '0 €' : priceFormatted}
          </span>
          {!isFreePlan && (
            <span className="ml-2 text-sm text-titanium-400">/ Monat</span>
          )}
        </div>

        {/* Outcome Headline */}
        <p className="text-xs font-mono uppercase tracking-wider text-titanium-400 mb-3">
          {plan.outcomeHeadline}
        </p>

        {/* Top Features */}
        <ul className="space-y-1.5 flex-1 mb-4">
          {plan.features.audit_evidence.slice(0, 3).map((feature: string) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-titanium-300">
              <Check className="h-4 w-4 text-gold-400 mt-0.5 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        {ctaHref && (
          <Link
            to={ctaHref}
            className={`w-full py-2.5 text-sm font-bold rounded transition-colors ${
              highlight
                ? 'bg-gold-400 text-obsidian-950 hover:bg-gold-500'
                : 'bg-titanium-800 text-titanium-50 hover:bg-titanium-700'
            }`}
          >
            {plan.ctaLabel}
          </Link>
        )}
        {onCta && !ctaHref && (
          <button
            onClick={onCta}
            className={`w-full py-2.5 text-sm font-bold rounded transition-colors ${
              highlight
                ? 'bg-gold-400 text-obsidian-950 hover:bg-gold-500'
                : 'bg-titanium-800 text-titanium-50 hover:bg-titanium-700'
            }`}
          >
            {plan.ctaLabel}
          </button>
        )}
      </div>
    );
  }

  // Full: Vollständige Karte auf Pricing-Seite (alles sichtbar)
  if (variant === 'full') {
    return (
      <div className={`${commonCardClasses} p-6 sm:p-8 flex flex-col`}>
        {/* Top Border Accent */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${accentClasses.border}`} />

        {/* Badge Row */}
        {(highlight || plan.badges?.[0]) && (
          <div className="mb-4 flex items-center gap-2">
            {highlight && (
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-gold-400 text-obsidian-950 font-mono text-xs font-bold uppercase tracking-wider rounded">
                Empfohlen
              </div>
            )}
            {plan.badges?.[0] && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-titanium-800/30 text-titanium-300 font-mono text-xs font-semibold uppercase tracking-wider rounded">
                {plan.badges[0]}
              </div>
            )}
          </div>
        )}

        {/* Plan Name + Price */}
        <h3 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 mb-1">
          {plan.name}
        </h3>

        <div className="mb-4">
          <span className={`text-4xl font-display font-bold ${accentClasses.text}`}>
            {isFreePlan ? '0 €' : priceFormatted}
          </span>
          {!isFreePlan && (
            <span className="ml-2 text-base text-titanium-400">/ Monat</span>
          )}
        </div>

        {/* Outcome Headline */}
        <p className="text-lg font-semibold text-titanium-100 leading-relaxed mb-3">
          {plan.outcomeHeadline}
        </p>

        {/* Technical Subheadline */}
        <p className="text-sm text-titanium-400 leading-relaxed mb-6">
          {plan.technicalSubheadline}
        </p>

        {/* Runtime Limits (Top 3) */}
        <div className="mb-6 pb-6 border-b border-titanium-800">
          <h4 className="text-xs font-mono uppercase tracking-wider text-titanium-400 mb-3">
            Runtime-Limits
          </h4>
          <div className="space-y-1.5 text-sm text-titanium-300">
            <div className="flex justify-between">
              <span>Bots</span>
              <span className="font-semibold text-titanium-100">{plan.limits.bots === -1 ? '∞' : plan.limits.bots}</span>
            </div>
            <div className="flex justify-between">
              <span>Domains</span>
              <span className="font-semibold text-titanium-100">{plan.limits.domains === -1 ? '∞' : plan.limits.domains}</span>
            </div>
            <div className="flex justify-between">
              <span>Automationsläufe / Monat</span>
              <span className="font-semibold text-titanium-100">{plan.limits.automationRunsPerMonth === -1 ? '∞' : plan.limits.automationRunsPerMonth.toLocaleString('de-DE')}</span>
            </div>
            {plan.limits.tenants > 1 && (
              <div className="flex justify-between">
                <span>Mandanten</span>
                <span className="font-semibold text-titanium-100">{plan.limits.tenants === -1 ? '∞' : plan.limits.tenants}</span>
              </div>
            )}
          </div>
        </div>

        {/* Features in Gruppen */}
        <div className="mb-6 pb-6 border-b border-titanium-800 flex-1">
          <h4 className="text-xs font-mono uppercase tracking-wider text-titanium-400 mb-3">
            Enthalten
          </h4>
          <div className="space-y-4">
            {/* Audit & Evidence */}
            <div>
              <h5 className="text-xs font-semibold text-titanium-300 mb-1.5">Audit & Evidence</h5>
              <ul className="space-y-1">
                {plan.features.audit_evidence.slice(0, 2).map((f: string) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-titanium-400">
                    <Check className="h-3.5 w-3.5 text-gold-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Governance */}
            <div>
              <h5 className="text-xs font-semibold text-titanium-300 mb-1.5">AI Governance</h5>
              <ul className="space-y-1">
                {plan.features.ai_governance.slice(0, 2).map((f: string) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-titanium-400">
                    <Check className="h-3.5 w-3.5 text-gold-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Automation & Ops */}
            <div>
              <h5 className="text-xs font-semibold text-titanium-300 mb-1.5">Automation & Ops</h5>
              <ul className="space-y-1">
                {plan.features.automation_ops.slice(0, 2).map((f: string) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-titanium-400">
                    <Check className="h-3.5 w-3.5 text-gold-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        {ctaHref && (
          <Link
            to={ctaHref}
            className={`w-full py-3 text-center text-sm font-bold rounded transition-colors inline-flex items-center justify-center gap-2 ${
              highlight
                ? 'bg-gold-400 text-obsidian-950 hover:bg-gold-500'
                : 'bg-titanium-800 text-titanium-50 hover:bg-titanium-700'
            }`}
          >
            {plan.ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        {onCta && !ctaHref && (
          <button
            onClick={onCta}
            className={`w-full py-3 text-center text-sm font-bold rounded transition-colors inline-flex items-center justify-center gap-2 ${
              highlight
                ? 'bg-gold-400 text-obsidian-950 hover:bg-gold-500'
                : 'bg-titanium-800 text-titanium-50 hover:bg-titanium-700'
            }`}
          >
            {plan.ctaLabel} <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return null;
}
