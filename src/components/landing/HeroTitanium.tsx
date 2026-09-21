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
  LANDING_BODY,
  LANDING_DISPLAY,
  LANDING_EYEBROW,
  LANDING_EYEBROW_TRACKING,
  LANDING_H1,
  LANDING_H1_LEADING,
  LANDING_H1_TRACKING,
  LANDING_H1_WEIGHT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SANS,
  LANDING_TEXT,
} from './landing-theme';
import { MODE_ACCENT, MODE_BUTTON_INK, MODE_GLOW, MODE_PANEL, modeAccent, modeSteel } from './landing-mode';

/**
 * Hero der Startseite — Enterprise Visual System.
 *
 * Reihenfolge: H1 (Geist 600, Cyan nur auf dem Europa-Teil) → Operating
 * Loop (Systemlabel, Cyan) → zwei Infrastrukturzeilen → Plan-Anker. Genau
 * eine Fläche trägt Cyan als Füllung: der Primär-CTA. Alles andere ist
 * Titan, Stahl und Silber; der hervorgehobene Plan bekommt eine Cyan-Kontur,
 * kein Leuchten.
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
    /* Fokusring folgt dem Farbmodus statt einem festen Wert. Tailwind kann
       keine JS-Konstante lesen, deshalb der Umweg ueber zwei CSS-Variablen.
       Die weiche Variante laeuft ueber `color-mix`, nicht ueber zwei
       angehaengte Hex-Ziffern: an einer CSS-Variablen ergaebe das eine
       ungueltige Farbe — einen unsichtbaren Ring, ohne Fehlermeldung. */
    <section
      id="product"
      className="relative min-h-[min(100svh,880px)] overflow-hidden border-b border-white/[0.06]"
      style={
        {
          '--landing-ring': MODE_ACCENT,
          '--landing-ring-soft': modeAccent(60),
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
            style={{
              fontFamily: LANDING_DISPLAY,
              fontWeight: LANDING_H1_WEIGHT,
              fontSize: LANDING_H1,
              lineHeight: LANDING_H1_LEADING,
              letterSpacing: LANDING_H1_TRACKING,
            }}
          >
            {HERO_HEADLINE.map((segments, line) => (
              <span key={line} className="block">
                {segments.map((segment, i) => (
                  <span
                    key={i}
                    style={{ color: segment.accent ? MODE_ACCENT : LANDING_TEXT }}
                  >
                    {i > 0 ? ' ' : ''}
                    {segment.text}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p
            className="mt-7 font-semibold uppercase"
            style={{
              fontFamily: LANDING_MONO,
              fontSize: LANDING_EYEBROW,
              letterSpacing: LANDING_EYEBROW_TRACKING,
              color: MODE_ACCENT,
            }}
          >
            {HERO_OPERATING_LOOP}
          </p>

          <div
            className="mt-7 space-y-1.5 leading-[1.55]"
            style={{ fontFamily: LANDING_SANS, fontSize: LANDING_BODY, color: LANDING_MUTED }}
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
                className="flex h-full min-w-[9.5rem] items-center justify-center rounded-xl px-6 py-5 text-[0.95rem] font-semibold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rsd-bg)] focus-visible:ring-[var(--landing-ring)]"
                style={{
                  fontFamily: LANDING_SANS,
                  backgroundColor: MODE_ACCENT,
                  color: MODE_BUTTON_INK,
                  boxShadow: MODE_GLOW,
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
                  className="flex h-full min-w-[7.25rem] flex-col items-center justify-center rounded-xl border px-5 py-3.5 text-center transition hover:border-[var(--rsd-steel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring-soft)]"
                  style={{
                    fontFamily: LANDING_SANS,
                    backgroundColor: `color-mix(in srgb, ${MODE_PANEL} 55%, transparent)`,
                    borderColor: chip.featured ? MODE_ACCENT : modeSteel(28),
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
                      style={{ color: chip.featured ? MODE_ACCENT : LANDING_TEXT }}
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
