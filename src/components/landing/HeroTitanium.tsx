import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { tierById, type PricingTier } from '../../config/pricing';
import { EuropeNetworkHero } from './EuropeNetworkHero';
import {
  HERO_HEADLINE,
  HERO_INFRA_LINES,
  HERO_OPERATING_LOOP,
  HERO_PLAN_ANCHOR_FREE,
} from '../governance-frontend/hero-content';
import {
  LANDING_ACCENT,
  LANDING_BUTTON,
  LANDING_CTA_GLOW,
  LANDING_BUTTON_TEXT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SANS,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Hero der Startseite — Umsetzung des Titan-Entwurfs.
 *
 * Reihenfolge wie im Entwurf: H1 (Serif, Akzent auf dem Europa-Teil) →
 * Operating Loop (Mono, Gold) → zwei Infrastrukturzeilen → Plan-Anker.
 *
 * Preise stammen aus `config/pricing` (`tierById`), nie aus dieser Datei:
 * Der Entwurf zeigt 79/249/699, die SSoT liefert dieselben Werte, und bei
 * einer Preisaenderung wandert der Hero mit, statt zu luegen.
 */

/** Plan-Anker unter den Infrastrukturzeilen. `null` = kein Preis (Entwurf). */
const PLAN_ANCHORS = ['starter', 'growth', 'agency'] as const;

/** Der im Entwurf hervorgehobene Plan. */
const FEATURED_PLAN = 'growth';

type PlanChip = {
  key: string;
  name: string;
  price: string | null;
  to: string;
  featured: boolean;
};

function planChips(): PlanChip[] {
  const tiers = PLAN_ANCHORS.map((id) => tierById(id)).filter(
    (t): t is PricingTier => Boolean(t),
  );

  return [
    ...tiers.map((tier) => ({
      key: tier.id,
      name: tier.name,
      price: `${tier.priceEur}€`,
      to: `/checkout/${tier.id}?source=hero`,
      featured: tier.id === FEATURED_PLAN,
    })),
    {
      key: 'enterprise',
      name: 'Enterprise',
      price: null,
      to: '/contact-sales?source=hero',
      featured: false,
    },
  ];
}

export function HeroTitanium() {
  const chips = planChips();

  return (
    /* Fokusring folgt dem Landing-Akzent statt einem festen Wert. Tailwind
       kann keine JS-Konstante lesen, deshalb der Umweg ueber zwei CSS-
       Variablen: Wer `LANDING_ACCENT` aendert, aendert den Ring mit. */
    <section
      id="product"
      className="relative min-h-[min(100svh,880px)] overflow-hidden border-b border-white/[0.06]"
      style={
        {
          '--landing-ring': LANDING_ACCENT,
          '--landing-ring-soft': `${LANDING_ACCENT}99`,
        } as CSSProperties
      }
    >
      <EuropeNetworkHero />

      {/* Lichtstreif oben links — gebuerstetes Titan des Entwurfs. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[42%]"
        style={{
          background:
            'radial-gradient(120% 100% at 22% 0%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 38%, transparent 72%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[min(100svh,880px)] max-w-[1280px] flex-col justify-center px-[4vw] pb-16 pt-28 sm:pb-20 sm:pt-32">
        <div className="max-w-[46rem]">
          <h1
            className="leading-[0.94] tracking-[-0.02em]"
            style={{
              fontFamily: LANDING_SERIF,
              fontWeight: 400,
              fontSize: 'clamp(2.75rem, 1.1rem + 5.6vw, 5.5rem)',
            }}
          >
            {HERO_HEADLINE.map((segments, line) => (
              <span key={line} className="block">
                {segments.map((segment, i) => (
                  <span
                    key={i}
                    style={{ color: segment.accent ? LANDING_ACCENT : LANDING_TEXT }}
                  >
                    {i > 0 ? ' ' : ''}
                    {segment.text}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p
            className="mt-7 text-[clamp(0.75rem,0.68rem+0.3vw,0.9rem)] font-medium uppercase tracking-[0.2em]"
            style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
          >
            {HERO_OPERATING_LOOP}
          </p>

          <div
            className="mt-7 space-y-1.5 text-[clamp(0.95rem,0.9rem+0.3vw,1.15rem)]"
            style={{ fontFamily: LANDING_SANS, color: LANDING_MUTED }}
          >
            {HERO_INFRA_LINES.map((line) => (
              <p key={line.join('·')}>{line.join(' · ')}</p>
            ))}
          </div>

          <ul className="mt-10 flex flex-wrap items-stretch gap-3" aria-label="Pläne">
            <li>
              <Link
                id="audit-cta"
                data-hero-cta="audit"
                to="/audit"
                className="flex h-full min-w-[9.5rem] items-center justify-center rounded-xl px-6 py-5 text-[0.95rem] font-semibold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring)]"
                style={{
                  backgroundColor: LANDING_BUTTON,
                  color: LANDING_BUTTON_TEXT,
                  boxShadow: LANDING_CTA_GLOW,
                }}
              >
                {HERO_PLAN_ANCHOR_FREE}
              </Link>
            </li>

            {chips.map((chip) => (
              <li key={chip.key}>
                <Link
                  to={chip.to}
                  data-plan-anchor={chip.key}
                  className="flex h-full min-w-[7.25rem] flex-col items-center justify-center rounded-xl border px-5 py-3.5 text-center transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring-soft)]"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderColor: chip.featured
                      ? LANDING_ACCENT
                      : 'rgba(255,255,255,0.12)',
                    boxShadow: chip.featured
                      ? LANDING_CTA_GLOW
                      : undefined,
                  }}
                >
                  <span
                    className="text-[0.9rem] leading-tight"
                    style={{ color: chip.price ? LANDING_MUTED : LANDING_TEXT }}
                  >
                    {chip.name}
                  </span>
                  {chip.price ? (
                    <span
                      className="mt-0.5 text-[1.15rem] font-medium leading-tight"
                      style={{ color: chip.featured ? LANDING_ACCENT : LANDING_TEXT }}
                    >
                      {chip.price}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
