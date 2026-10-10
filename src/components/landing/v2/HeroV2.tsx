import { Link } from 'react-router-dom';
import { checkoutHrefForPlan, formatPriceEur, planById } from '@/shared/pricing';
import {
  LV2_H1_GOLD,
  LV2_H1_SILVER,
  LV2_HERO_NOTE,
  LV2_PIPELINE,
  LV2_STACK,
} from './landing-v2-content';

const SOURCE = 'landing-v2-hero';

/**
 * Screen 01 — Hero. Der Einstieg zeigt die echten Produktoberflächen:
 * Scan, Runtime und Enterprise-Anfrage. Die bestehenden Tarif-Buttons
 * bleiben aus der Pricing-SSoT verdrahtet; der Hero zeigt damit
 * Produktoberflächen und buchbare Einstiegspfade ohne Demo-CTA und
 * ohne zweite Preislogik.
 */
export function HeroV2() {
  const starter = planById('starter');
  const growth = planById('growth');
  const agency = planById('agency');
  const tierButtons = [starter, growth, agency];

  return (
    <section id="top" className="lv2-hero" aria-labelledby="lv2-hero-title">
      <div className="lv2-hero__map" aria-hidden="true">
        <img src="/europe-map-v2.png" alt="" loading="eager" decoding="async" fetchPriority="high" />
      </div>

      <div className="lv2__wrap lv2-hero__inner">
        <h1 id="lv2-hero-title" className="lv2-hero__h1">
          <span className="is-silver">{LV2_H1_SILVER} </span>
          <span className="is-gold">{LV2_H1_GOLD}</span>
        </h1>

        <ol className="lv2-pipeline" aria-label="Betriebsschleife">
          {LV2_PIPELINE.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <ul className="lv2-stack" aria-label="Stack">
          {LV2_STACK.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="lv2-hero__cta" role="group" aria-label="Hero-Aktionen">
          <Link
            to={`/audit?source=${SOURCE}`}
            className="lv2-btn lv2-btn--gold"
            data-hero-cta="audit"
            data-testid="hero-primary-cta"
          >
            Governance-Scan starten
          </Link>
          <Link to="/governance-runtime" className="lv2-btn lv2-btn--glass" data-hero-cta="runtime">
            Runtime ansehen
          </Link>
          {tierButtons.map((plan) => (
            <Link
              key={plan.id}
              to={checkoutHrefForPlan(plan, { source: SOURCE })}
              className={`lv2-btn lv2-btn--glass${plan.highlight ? ' lv2-btn--featured' : ''}`}
              data-hero-cta={`plan-${plan.id}`}
            >
              {plan.name}
              <strong>{formatPriceEur(plan.price.monthlyEur)}</strong>
            </Link>
          ))}
          <Link
            to="/contact-sales?tier=enterprise&source=landing-v2-hero"
            className="lv2-btn lv2-btn--glass lv2-btn--enterprise"
            data-hero-cta="enterprise"
            data-testid="hero-secondary-cta"
          >
            Enterprise anfragen
          </Link>
        </div>

        <p className="lv2-hero__note">{LV2_HERO_NOTE}</p>
        <p className="lv2-hero__truthline">
          Ein Frontend, eine Runtime: Scan, Policy Engine, Evidence, Activation und Command Center führen in dieselbe Produktarchitektur.
        </p>
      </div>
    </section>
  );
}
