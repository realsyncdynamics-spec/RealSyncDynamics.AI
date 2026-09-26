/**
 * Tarife der Governance-AI-Vorschau.
 *
 * Inhaltlich identisch mit `LandingPricingSection` — dieselbe Reihenfolge,
 * dieselbe SSoT (`config/pricing.ts`), dieselben vier Bullets, dieselben
 * Checkout-Ziele. Unterschiedlich ist nur die Optik: Black-Glass statt
 * Gold/Cream, und die Tarife sind farblich gestaffelt.
 *
 * ## Die Staffelung trägt eine Aussage
 *
 * Starter und Growth stehen in Cyan — das ist die Aktionsfarbe der Seite, und
 * beide sind Self-Service. Agency bekommt City-Light-Gold, dieselbe Farbe wie
 * die Enterprise-Sektion: Damit liest sich die VIP-Stufe als eine Ebene, nicht
 * als zwei unverbundene Sonderfälle. Growth bleibt die hervorgehobene Karte.
 *
 * Eine eigene Komponente statt eines Umbaus der bestehenden: `/` steht unter
 * Design-Lock und färbt ihre Tarife über feste Konstanten aus
 * `landing-theme.ts`. Diese Datei fasst die Startseite nicht an.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { tierById, type PricingTier } from '../../config/pricing';
import { GA_DISPLAY, GA_LINE_SOFT, GA_MONO, GA_MUTED, GA_TITAN } from './governance-ai-theme';
import { SectionEyebrow, SectionHeading } from './GovernanceSectionChrome';

/**
 * Feste Reihenfolge auf `/`: drei Self-Service-Stufen plus Enterprise. Enterprise
 * zeigt „Auf Anfrage" (`priceOnRequest`) und führt auf die Anfrage-Strecke.
 */
const LANDING_PLAN_IDS = ['starter', 'growth', 'agency', 'enterprise'] as const;

/**
 * Keine farbliche VIP-Stufe mehr: In der Governance-OS-Palette trägt Cyan nur
 * Systemzustände, die Stufen unterscheiden sich über Inhalt, nicht über Farbe.
 */
const VIP_TIERS = new Set<string>();

export function GovernancePricingSection() {
  const tiers = LANDING_PLAN_IDS.map((id) => tierById(id)).filter(
    (t): t is PricingTier => Boolean(t),
  );
  if (tiers.length === 0) return null;

  return (
    <section
      id="pricing"
      className="ga-band-alt relative z-[1] border-t px-[4vw] py-[clamp(60px,6vw,92px)]"
      style={{ borderColor: GA_LINE_SOFT }}
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto w-full max-w-[1500px]">
        <SectionEyebrow>PLATTFORM</SectionEyebrow>
        <span id="pricing-heading">
          <SectionHeading accent="nach Governance-Tiefe.">Plattform-Zugang</SectionHeading>
        </span>
        <p className="mt-4 max-w-[660px] text-pretty leading-[1.7]" style={{ color: GA_MUTED }}>
          Monatlich abgerechnet. Enterprise mit Multi-Tenant-Runtime, SSO und SLA nach Vereinbarung.
        </p>

        <div className="mt-[38px] grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          {tiers.map((tier) => {
            const featured = tier.highlight || tier.id === 'growth';
            const vip = VIP_TIERS.has(tier.id);

            return (
              <article
                key={tier.id}
                className={`ga-card ga-glass flex min-h-[300px] flex-col p-6 ${vip ? 'ga-vip' : ''}`}
                style={
                  featured
                    ? {
                        borderColor: 'var(--ga-accent-border)',
                        boxShadow:
                          'var(--ga-featured-shadow, 0 0 0 1px rgba(34,195,230,.3), 0 30px 80px rgba(0,0,0,.65), 0 0 70px rgba(34,195,230,.28))',
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className="text-[11px] tracking-[.2em]"
                    style={{ fontFamily: GA_MONO, color: 'var(--ga-accent)' }}
                  >
                    {tier.name.toUpperCase()}
                  </p>
                  {(tier.badges[0] || featured) && (
                    <span
                      className="whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] tracking-[.12em]"
                      style={{
                        fontFamily: GA_MONO,
                        borderColor: 'var(--ga-accent-border)',
                        color: 'var(--ga-accent)',
                      }}
                    >
                      {(tier.badges[0] ?? 'Empfohlen').toUpperCase()}
                    </span>
                  )}
                </div>

                <h3
                  className="mt-[18px] text-[40px] font-normal leading-none tracking-[-.01em]"
                  style={{
                    fontFamily: GA_DISPLAY,
                    backgroundImage:
                      'var(--ga-price-face, linear-gradient(180deg, #fff 0%, var(--ga-accent) 100%))',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {tier.priceOnRequest ? 'Auf Anfrage' : `${tier.priceString} €`}
                  {tier.priceOnRequest ? null : (
                  <span
                    className="ml-2 text-[11px] tracking-[.14em]"
                    style={{
                      fontFamily: GA_MONO,
                      color: GA_TITAN,
                      backgroundImage: 'none',
                      WebkitTextFillColor: GA_TITAN,
                    }}
                  >
                    / MONAT
                  </span>
                  )}
                </h3>

                <p className="mt-3 text-[14px] leading-[1.6]" style={{ color: GA_MUTED }}>
                  {tier.tagline}
                </p>

                {/* `flex-1` statt `mt-auto`: Sonst rutscht die Trennlinie bei
                    kurzen Taglines dicht an den Text, und die drei Karten
                    zeigen sie auf drei verschiedenen Höhen. */}
                <ul
                  className="mt-5 flex flex-1 flex-col gap-2.5 border-t pt-[18px]"
                  style={{ borderColor: GA_LINE_SOFT }}
                >
                  {tier.bullets.slice(0, 4).map((bullet) => (
                    <li
                      key={bullet}
                      className="flex gap-2.5 text-[13px] leading-[1.5]"
                      style={{ color: GA_MUTED }}
                    >
                      <span style={{ color: 'var(--ga-vip)' }} aria-hidden="true">
                        +
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={tier.cta.href.startsWith('/') ? tier.cta.href : `/checkout/${tier.id}`}
                  className="mt-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-3.5 text-[13px] font-semibold transition hover:brightness-[1.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)]"
                  style={
                    featured
                      ? {
                          backgroundImage: 'var(--ga-pill-face)',
                          color: 'var(--ga-pill-ink)',
                          boxShadow: 'var(--ga-pill-shadow)',
                        }
                      : {
                          // Akzent statt Ghost-Kante: Agency trägt damit seine
                          // Gold-Stufe auch auf dem Button, Starter bleibt Cyan.
                          backgroundColor: 'var(--ga-ghost-face)',
                          color: 'var(--ga-accent-lite)',
                          border: '1px solid var(--ga-accent-border)',
                        }
                  }
                >
                  {tier.cta.label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 text-[13px] transition hover:opacity-90"
            style={{ color: 'var(--ga-accent)' }}
          >
            Alle Preise und Module
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
