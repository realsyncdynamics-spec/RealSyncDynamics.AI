import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { COMPANY } from '../../../config/company';
import { CTA } from '../../../content/runtimeVocab';
import { tierById, type PricingTier } from '../../../config/pricing';
import {
  checkoutHrefForPlan,
  formatPriceEur,
  pricingTaxNote,
  PLANS,
} from '@/shared/pricing';

const PLAN_IDS = ['starter', 'growth', 'agency', 'enterprise'] as const;
const SOURCE = 'landing-v2-pricing';

/** Jahres-Checkout ist in Stripe nicht verdrahtet — Toggle bleibt aus. */
const YEARLY_BILLING_ENABLED = PLANS.some(
  (plan) =>
    plan.yearlyPlanKey !== null &&
    plan.yearlyCheckoutUnavailable !== true &&
    plan.price.yearlyEur !== null,
);

function bullets(tier: PricingTier): string[] {
  // Karten zeigen die ersten vier Punkte der SSoT-Matrix; Vollmatrix auf /pricing.
  return tier.bullets.filter((b) => b.trim().length > 0).slice(0, 4);
}

/**
 * 07 Preise — vier Karten aus `shared/pricing.ts`. Der Jahres-Toggle bleibt
 * ausgeblendet, solange `yearlyCheckoutUnavailable` für alle Pläne gilt
 * (sonst endet Checkout mit PRICE_NOT_CONFIGURED).
 */
export function PricingV2() {
  const [cycle] = useState<'month' | 'year'>('month');
  const tiers = PLAN_IDS.map((id) => tierById(id)).filter((t): t is PricingTier => Boolean(t));
  if (tiers.length === 0) return null;

  return (
    <section id="preise" className="lv2__section" aria-labelledby="lv2-preise-title">
      <div className="lv2__wrap">
        <div className="lv2-pricing__head">
          <div>
            <p className="lv2__kicker">Preise</p>
            <h2 id="lv2-preise-title" className="lv2__h2">
              Transparent, monatlich kündbar, in Euro.
            </h2>
          </div>
          {YEARLY_BILLING_ENABLED ? (
            <div className="lv2-toggle" role="group" aria-label="Abrechnungszeitraum">
              <button type="button" aria-pressed={cycle === 'month'}>
                Monatlich
              </button>
              <button type="button" aria-pressed={cycle === 'year'}>
                Jährlich · 2 Monate gratis
              </button>
            </div>
          ) : (
            <p
              className="lv2__kicker"
              data-testid="pricing-yearly-disabled"
              title="Jahrespreise sind in Stripe noch nicht verdrahtet"
            >
              Monatlich · Jährlich demnächst
            </p>
          )}
        </div>

        <ul className="lv2-plans">
          {tiers.map((tier) => {
            const plan = tier.plan;
            const price = tier.priceOnRequest
              ? 'Auf Anfrage'
              : formatPriceEur(plan.price.monthlyEur);
            const suffix = tier.priceOnRequest ? tier.priceSuffix : '/ Monat';
            const href = checkoutHrefForPlan(plan, {
              interval: 'month',
              source: SOURCE,
            });
            const featured = plan.highlight;

            return (
              <li key={tier.id} className="lv2-plan" data-featured={featured ? 'true' : undefined}>
                <div className="lv2-plan__top">
                  <h3 className="lv2__h3">{plan.name}</h3>
                  {featured && <span className="lv2-plan__badge">EMPFOHLEN</span>}
                </div>
                <p className="lv2-plan__price" data-text={tier.priceOnRequest ? 'true' : undefined}>
                  <span>{price}</span> <small>{suffix}</small>
                </p>
                <p className="lv2-plan__note">
                  {tier.priceOnRequest ? 'SLA & dedizierter Tenant' : 'monatlich kündbar'}
                </p>
                <p className="lv2-plan__desc">{plan.outcomeHeadline}</p>
                <ul className="lv2-plan__features">
                  {bullets(tier).map((b) => (
                    <li key={b}>
                      <Check size={16} aria-hidden="true" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={href}
                  className={`lv2-btn ${featured ? 'lv2-btn--gold' : 'lv2-btn--glass'}`}
                  data-plan-cta={plan.id}
                >
                  {plan.purchaseMode === 'inquiry' ? CTA.enterprise : plan.ctaLabel}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="lv2-pricing__foot">
          {pricingTaxNote(COMPANY.taxMode)} Bezahlung per Karte
          oder SEPA-Lastschrift über Stripe. Vollständige Feature-Matrix unter{' '}
          <Link to="/pricing" className="lv2-btn lv2-btn--link">
            /pricing
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
