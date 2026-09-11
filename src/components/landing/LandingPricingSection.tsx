import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { tierById, type PricingTier } from '../../config/pricing';
import {
  LANDING_ACCENT,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_GLOW_CTA,
  LANDING_LABEL,
  LANDING_LINE,
  LANDING_LINE_ACCENT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_PANEL,
  LANDING_PANEL_RAISED,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Pricing 3-up on the public landing — enterprise cyan scale.
 *
 * Feste Reihenfolge Starter / Growth (featured) / Agency aus der SSoT
 * (`shared/pricing.ts`). Agency ist wieder self_service (Stripe Live-Price
 * `price_1TfsV9…`); CTA geht auf `/checkout/agency`.
 * Cyan nur auf featured Border + Primary-CTA.
 */
const LANDING_PLAN_IDS = ['starter', 'growth', 'agency'] as const;

export function LandingPricingSection() {
  const tiers = LANDING_PLAN_IDS.map((id) => tierById(id)).filter(
    (t): t is PricingTier => Boolean(t),
  );
  if (tiers.length === 0) return null;

  return (
    <section id="pricing" className="border-t border-white/[0.06] py-[92px]">
      <div className="mx-auto max-w-[1500px] px-[4vw]">
        <p
          className="inline-block rounded-full border px-[11px] py-[7px] text-[9px] font-medium tracking-[.23em]"
          style={{
            fontFamily: LANDING_MONO,
            color: LANDING_LABEL,
            borderColor: LANDING_LINE,
          }}
        >
          PREISE
        </p>
        <h2
          className="mt-[22px] text-[clamp(40px,5vw,65px)] leading-none tracking-[-.035em]"
          style={{ fontFamily: LANDING_SERIF, fontWeight: 500, color: LANDING_TEXT }}
        >
          Pläne für die{' '}
          <em className="not-italic" style={{ color: LANDING_ACCENT }}>
            Governance Runtime.
          </em>
        </h2>
        <p className="mt-[17px] max-w-[760px] text-[13px] leading-[1.7]" style={{ color: LANDING_MUTED }}>
          Live-Tarife aus dem Produktkatalog — Starter, Growth und Agency starten
          self-service über Stripe.
        </p>

        <div className="mt-[45px] grid gap-[14px] md:grid-cols-3">
          {tiers.map((tier) => {
            const featured = tier.highlight || tier.id === 'growth';
            return (
              <article
                key={tier.id}
                className="flex min-h-[280px] flex-col border p-[22px]"
                style={{
                  borderColor: featured ? LANDING_LINE_ACCENT : LANDING_LINE,
                  background: featured
                    ? `linear-gradient(160deg, rgba(0,229,255,0.06), ${LANDING_PANEL_RAISED} 42%, ${LANDING_PANEL})`
                    : `linear-gradient(160deg, ${LANDING_PANEL_RAISED}, ${LANDING_PANEL})`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className="text-[9px] tracking-[.2em]"
                    style={{
                      fontFamily: LANDING_MONO,
                      color: featured ? LANDING_ACCENT : LANDING_LABEL,
                    }}
                  >
                    {tier.name.toUpperCase()}
                  </p>
                  {(tier.badges[0] || featured) && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[8px] tracking-[.14em]"
                      style={{
                        fontFamily: LANDING_MONO,
                        borderColor: featured ? LANDING_LINE_ACCENT : LANDING_LINE,
                        color: featured ? LANDING_ACCENT : LANDING_LABEL,
                      }}
                    >
                      {(tier.badges[0] ?? 'Empfohlen').toUpperCase()}
                    </span>
                  )}
                </div>
                <h3
                  className="mt-4 text-[28px] tracking-tight"
                  style={{ fontFamily: LANDING_SERIF, fontWeight: 500, color: LANDING_TEXT }}
                >
                  {tier.priceEur} €
                  <span
                    className="ml-2 text-[11px] tracking-[.14em]"
                    style={{ fontFamily: LANDING_MONO, color: LANDING_MUTED }}
                  >
                    / Monat
                  </span>
                </h3>
                <p className="mt-2 text-[12px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                  {tier.tagline}
                </p>
                <ul className="mt-5 flex-1 space-y-2 border-t pt-4" style={{ borderColor: LANDING_LINE }}>
                  {tier.bullets.slice(0, 4).map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 text-[11px] leading-relaxed"
                      style={{ color: LANDING_MUTED }}
                    >
                      <span style={{ color: featured ? LANDING_ACCENT : LANDING_LABEL }}>+</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={tier.cta.href.startsWith('/') ? tier.cta.href : `/checkout/${tier.id}`}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full px-[18px] py-[13px] text-[11px] font-semibold transition hover:brightness-110"
                  style={
                    featured
                      ? {
                          backgroundColor: LANDING_BUTTON,
                          color: LANDING_BUTTON_TEXT,
                          boxShadow: LANDING_GLOW_CTA,
                        }
                      : {
                          backgroundColor: 'transparent',
                          color: LANDING_TEXT,
                          border: '1px solid rgba(255,255,255,0.45)',
                        }
                  }
                >
                  {tier.cta.label} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 text-[12px] transition hover:opacity-90"
            style={{ color: LANDING_MUTED }}
          >
            Alle Preise und Module <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
