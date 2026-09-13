import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { tierById, type PricingTier } from '../../config/pricing';
import {
  GA_DISPLAY,
  GA_GOLD_LITE,
  GA_H2,
  GA_LINE_SOFT,
  GA_MONO,
  GA_MUTED,
  GA_TEXT,
  GA_GOLD_FACE,
  GA_GOLD_FACE_SHADOW,
} from './governance-ai-theme';

/**
 * Pricing 3-up on the public landing — Dominik-Referenz layout.
 *
 * Monthly Starter / Growth / Agency from SSoT. Yearly = coming-soon
 * (implementation-status `pricing-yearly`).
 */
const LANDING_PLAN_IDS = ['starter', 'growth', 'agency'] as const;

export function LandingPricingSection() {
  const tiers = LANDING_PLAN_IDS.map((id) => tierById(id)).filter(
    (t): t is PricingTier => Boolean(t),
  );
  if (tiers.length === 0) return null;

  return (
    <section
      id="pricing"
      className="ga-band relative z-[1] border-t border-[#d0c3a4]/10 py-[64px] lg:py-[72px]"
    >
      <div className="mx-auto max-w-[1500px] px-[4vw]">
        <p
          className="inline-block rounded-full border px-[11px] py-[7px] text-[9px] font-medium tracking-[.23em]"
          style={{
            fontFamily: GA_MONO,
            color: GA_GOLD_LITE,
            borderColor: `${GA_GOLD_LITE}47`,
          }}
        >
          PREISE
        </p>
        <h2
          className="mt-[18px] leading-[1.05] tracking-[-.03em]"
          style={{
            fontFamily: GA_DISPLAY,
            fontWeight: 500,
            fontSize: GA_H2,
            color: GA_TEXT,
          }}
        >
          Pläne für die{' '}
          <em className="not-italic" style={{ color: GA_GOLD_LITE }}>
            Governance Runtime.
          </em>
        </h2>
        <p className="mt-[14px] max-w-[640px] text-[13px] leading-[1.65]" style={{ color: GA_MUTED }}>
          Monatliche Self-Service-Tarife — Starter €79 · Growth €249 · Agency €699.
          Jahresabrechnung: Coming Soon (noch nicht in Stripe verdrahtet).
        </p>
        <p
          className="mt-3 max-w-[720px] text-[11px] leading-relaxed tracking-[.02em]"
          style={{ fontFamily: GA_MONO, color: GA_GOLD_LITE }}
        >
          Upgrade-Leiter: Einzel-Domain → Starter · SaaS → Growth · Agentur → Agency ·
          DSB/Enterprise → Anfrage (/contact-sales). Partner ist Legacy/Inquiry — kein
          Self-Serve „Scale“.
        </p>

        <div className="mt-[36px] grid gap-[12px] md:grid-cols-3">
          {tiers.map((tier) => {
            const featured = tier.highlight || tier.id === 'growth';
            return (
              <article
                key={tier.id}
                className="ga-card flex min-h-[260px] flex-col border p-[20px]"
                style={{
                  borderColor: featured ? `${GA_GOLD_LITE}73` : 'rgba(255,255,255,0.12)',
                  background: featured
                    ? 'linear-gradient(135deg, rgba(208,195,164,0.10), rgba(7,9,13,0.72))'
                    : 'linear-gradient(135deg, rgba(20,21,25,0.7), rgba(7,9,13,0.72))',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className="text-[9px] tracking-[.2em]"
                    style={{ fontFamily: GA_MONO, color: GA_GOLD_LITE }}
                  >
                    {tier.name.toUpperCase()}
                  </p>
                  {(tier.badges[0] || featured) && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[8px] tracking-[.14em]"
                      style={{
                        fontFamily: GA_MONO,
                        borderColor: `${GA_GOLD_LITE}55`,
                        color: GA_GOLD_LITE,
                      }}
                    >
                      {(tier.badges[0] ?? 'Empfohlen').toUpperCase()}
                    </span>
                  )}
                </div>
                <h3
                  className="mt-4 text-[28px] tracking-tight"
                  style={{ fontFamily: GA_DISPLAY, fontWeight: 500, color: GA_TEXT }}
                >
                  {tier.priceEur} €
                  <span
                    className="ml-2 text-[11px] tracking-[.14em]"
                    style={{ fontFamily: GA_MONO, color: GA_MUTED }}
                  >
                    / Monat
                  </span>
                </h3>
                <p className="mt-2 text-[12px] leading-relaxed" style={{ color: GA_MUTED }}>
                  {tier.tagline}
                </p>
                <ul className="mt-5 flex-1 space-y-2 border-t pt-4" style={{ borderColor: GA_LINE_SOFT }}>
                  {tier.bullets.slice(0, 4).map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 text-[11px] leading-relaxed"
                      style={{ color: '#898a91' }}
                    >
                      <span style={{ color: GA_GOLD_LITE }}>+</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={tier.cta.href.startsWith('/') ? tier.cta.href : `/checkout/${tier.id}`}
                  data-testid={`landing-pricing-cta-${tier.id}`}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full px-[18px] py-[13px] text-[11px] font-semibold transition hover:brightness-110"
                  style={
                    featured
                      ? { background: GA_GOLD_FACE, color: '#14100b', boxShadow: GA_GOLD_FACE_SHADOW }
                      : {
                          backgroundColor: 'transparent',
                          color: '#e8ddc8',
                          border: '1px solid rgba(208,195,164,0.55)',
                        }
                  }
                >
                  {tier.cta.label} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-8 text-center space-y-2">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 text-[12px] transition hover:opacity-90"
            style={{ color: GA_GOLD_LITE }}
          >
            Alle Preise und Module <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <p
            className="text-[10px] tracking-[.08em]"
            style={{ fontFamily: GA_MONO, color: GA_MUTED }}
          >
            Monatlich live · Yearly Coming Soon · Enterprise auf Anfrage (/contact-sales)
          </p>
        </div>
      </div>
    </section>
  );
}
