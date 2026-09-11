import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SELLABLE_PRICING_TIERS } from '../../config/pricing';
import {
  LANDING_ACCENT,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_LINE,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Pricing 3-up on the public landing — Dominik-Referenz layout.
 *
 * Beträge und Labels kommen ausschließlich aus `shared/pricing.ts` über
 * `SELLABLE_PRICING_TIERS`. Agency ist legacy und erscheint hier nicht;
 * die dritte Karte ist Enterprise (Auf Anfrage), sofern verkaufbar.
 */
export function LandingPricingSection() {
  const tiers = SELLABLE_PRICING_TIERS.slice(0, 3);
  if (tiers.length === 0) return null;

  return (
    <section id="pricing" className="border-t border-white/[0.06] py-[92px]">
      <div className="mx-auto max-w-[1500px] px-[4vw]">
        <p
          className="inline-block rounded-full border px-[11px] py-[7px] text-[9px] font-medium tracking-[.23em]"
          style={{
            fontFamily: LANDING_MONO,
            color: LANDING_ACCENT,
            borderColor: `${LANDING_ACCENT}47`,
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
          Live-Tarife aus dem Produktkatalog — kein Demo-Pricing. Starter und Growth
          starten self-service; Enterprise nach Vertrag.
        </p>

        <div className="mt-[45px] grid gap-[14px] md:grid-cols-3">
          {tiers.map((tier) => {
            const featured = tier.highlight;
            return (
              <article
                key={tier.id}
                className="flex min-h-[280px] flex-col border p-[22px]"
                style={{
                  borderColor: featured ? `${LANDING_ACCENT}73` : 'rgba(255,255,255,0.12)',
                  background: featured
                    ? 'linear-gradient(135deg, rgba(228,207,162,0.08), rgba(7,9,13,0.72))'
                    : 'linear-gradient(135deg, rgba(20,21,25,0.7), rgba(7,9,13,0.72))',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className="text-[9px] tracking-[.2em]"
                    style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                  >
                    {tier.name.toUpperCase()}
                  </p>
                  {tier.badges[0] && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[8px] tracking-[.14em]"
                      style={{
                        fontFamily: LANDING_MONO,
                        borderColor: `${LANDING_ACCENT}55`,
                        color: LANDING_ACCENT,
                      }}
                    >
                      {tier.badges[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <h3
                  className="mt-4 text-[28px] tracking-tight"
                  style={{ fontFamily: LANDING_SERIF, fontWeight: 500, color: LANDING_TEXT }}
                >
                  {tier.priceOnRequest ? 'Auf Anfrage' : `${tier.priceEur} €`}
                  {!tier.priceOnRequest && (
                    <span
                      className="ml-2 text-[11px] tracking-[.14em]"
                      style={{ fontFamily: LANDING_MONO, color: LANDING_MUTED }}
                    >
                      / Monat
                    </span>
                  )}
                </h3>
                <p className="mt-2 text-[12px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                  {tier.tagline}
                </p>
                <ul className="mt-5 flex-1 space-y-2 border-t pt-4" style={{ borderColor: LANDING_LINE }}>
                  {tier.bullets.slice(0, 4).map((b) => (
                    <li key={b} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: '#898a91' }}>
                      <span style={{ color: LANDING_ACCENT }}>+</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={tier.cta.href.startsWith('/') ? tier.cta.href : `/pricing#plan-${tier.id}`}
                  className="mt-6 inline-flex items-center justify-center gap-2 px-[18px] py-[13px] text-[11px] font-semibold transition hover:brightness-105"
                  style={
                    featured
                      ? { backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }
                      : {
                          backgroundColor: 'transparent',
                          color: LANDING_ACCENT,
                          border: `1px solid ${LANDING_ACCENT}80`,
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
            style={{ color: LANDING_ACCENT }}
          >
            Alle Preise und Module <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
