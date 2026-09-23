import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  checkoutHrefForPlan,
  planById,
  tierById,
  type PricingTier,
} from '../../config/pricing';
import { EuropeNetworkHero } from './EuropeNetworkHero';
import {
  HERO_HEADLINE,
  HERO_INFRA_LINES,
  HERO_OPERATING_LOOP,
  HERO_PLAN_ANCHOR_FREE,
} from '../governance-frontend/hero-content';
import {
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SANS,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';
import {
  MODE_ACCENT,
  MODE_BUTTON_INK,
  MODE_GLOW,
  MODE_PILL_FACE,
  modeAccent,
} from './landing-mode';
import { PUBLIC_CTA } from '../../config/public-nav';

const PLAN_ANCHORS = ['starter', 'growth', 'agency'] as const;
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

  const paid = tiers.map((tier) => ({
    key: tier.id,
    name: tier.name,
    price: tier.priceOnRequest ? null : `${tier.priceEur}€`,
    to: checkoutHrefForPlan(tier.plan, { interval: 'month', source: 'hero' }),
    featured: tier.id === FEATURED_PLAN,
  }));

  const enterprise = planById('enterprise');
  return [
    ...paid,
    {
      key: 'enterprise',
      name: enterprise?.name ?? 'Enterprise',
      price: null,
      to: enterprise
        ? checkoutHrefForPlan(enterprise, { interval: 'month', source: 'hero' })
        : '/contact-sales?source=hero&intent=enterprise',
      featured: false,
    },
  ];
}

export function HeroTitanium() {
  const chips = planChips();

  return (
    <section
      id="product"
      className="relative min-h-[min(100svh,920px)] overflow-hidden border-b border-white/[0.05]"
      style={
        {
          '--landing-ring': MODE_ACCENT,
          '--landing-ring-soft': modeAccent(60),
        } as CSSProperties
      }
    >
      <EuropeNetworkHero />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[48%]"
        style={{
          background:
            `radial-gradient(110% 90% at 18% 0%, ${modeAccent(7)} 0%, rgba(255,255,255,0.03) 34%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[min(100svh,920px)] max-w-[1320px] flex-col justify-center px-[4.5vw] pb-20 pt-28 sm:pb-24 sm:pt-32">
        <div className="max-w-[56rem]">
          <h1
            className="leading-[0.93] tracking-[-0.028em]"
            style={{
              fontFamily: LANDING_SERIF,
              fontWeight: 400,
              fontSize: 'clamp(2.7rem, 0.8rem + 5.4vw, 5.35rem)',
            }}
          >
            {HERO_HEADLINE.map((segments, line) => (
              <span
                key={line}
                className={line === 1 ? 'mt-[0.04em] block whitespace-nowrap' : 'block'}
              >
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
            className="mt-8 text-[clamp(0.72rem,0.66rem+0.28vw,0.84rem)] font-medium uppercase tracking-[0.24em]"
            style={{ fontFamily: LANDING_MONO, color: MODE_ACCENT }}
          >
            {HERO_OPERATING_LOOP}
          </p>

          <div
            className="mt-7 max-w-[40rem] space-y-1.5 text-[clamp(0.98rem,0.9rem+0.28vw,1.12rem)] leading-relaxed"
            style={{ fontFamily: LANDING_SANS, color: LANDING_MUTED }}
          >
            {HERO_INFRA_LINES.map((line) => (
              <p key={line.join('·')}>{line.join(' · ')}</p>
            ))}
          </div>

          <ul className="mt-11 flex flex-wrap items-stretch gap-2.5" aria-label="Pläne">
            <li>
              <Link
                id="audit-cta"
                data-hero-cta="audit"
                to={PUBLIC_CTA.to}
                className="flex h-full min-w-[9.25rem] items-center justify-center rounded-xl px-6 py-[1.15rem] text-[0.92rem] font-semibold tracking-[-0.01em] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring)]"
                style={{
                  backgroundImage: MODE_PILL_FACE,
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
                  className="flex h-full min-w-[7.1rem] flex-col items-center justify-center rounded-xl border px-5 py-3 text-center transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring-soft)]"
                  style={{
                    backgroundColor: chip.featured ? 'rgba(8,8,10,0.78)' : 'rgba(255,255,255,0.03)',
                    borderColor: chip.featured ? MODE_ACCENT : 'rgba(255,255,255,0.10)',
                    boxShadow: chip.featured ? MODE_GLOW : undefined,
                  }}
                >
                  <span
                    className="text-[0.78rem] uppercase tracking-[0.14em]"
                    style={{
                      fontFamily: LANDING_MONO,
                      color: chip.price ? LANDING_MUTED : LANDING_TEXT,
                    }}
                  >
                    {chip.name}
                  </span>
                  {chip.price ? (
                    <span
                      className="mt-1 text-[1.12rem] font-medium leading-none"
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
