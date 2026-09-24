import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { EuropeNetworkHero } from './EuropeNetworkHero';
import {
  HERO_DASHBOARD_CTA_LABEL,
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
  HERO_SCAN_CTA_LABEL,
  HERO_SUBLINE,
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

export function HeroTitanium() {
  return (
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

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[42%]"
        style={{
          background:
            'radial-gradient(120% 100% at 22% 0%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 38%, transparent 72%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[min(100svh,880px)] max-w-[1280px] flex-col justify-center px-[4vw] pb-16 pt-28 sm:pb-20 sm:pt-32">
        <div className="max-w-[54rem]">
          <h1
            className="leading-[0.98] tracking-[-0.02em]"
            style={{
              fontFamily: LANDING_SERIF,
              fontWeight: 400,
              fontSize: 'clamp(2.2rem, 0.75rem + 4.2vw, 4.35rem)',
            }}
          >
            {HERO_HEADLINE.map((segments, line) => (
              <span key={line} className={line > 0 ? 'mt-[0.08em] block' : 'block'}>
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
            className="mt-7 max-w-[42rem] text-pretty text-[clamp(1rem,0.92rem+0.35vw,1.2rem)] leading-[1.65]"
            style={{ fontFamily: LANDING_SANS, color: LANDING_MUTED }}
          >
            {HERO_SUBLINE}
          </p>

          <p
            className="mt-6 text-[clamp(0.75rem,0.68rem+0.3vw,0.9rem)] font-medium uppercase tracking-[0.2em]"
            style={{ fontFamily: LANDING_MONO, color: MODE_ACCENT }}
          >
            {HERO_OPERATING_LOOP}
          </p>

          <div className="mt-10 flex flex-wrap items-stretch gap-3" role="group" aria-label="Hero-Aktionen">
            <Link
              id="audit-cta"
              data-hero-cta="audit"
              data-testid="hero-primary-cta"
              to="/audit"
              className="inline-flex min-h-[3.25rem] min-w-[12rem] items-center justify-center rounded-2xl px-6 py-4 text-[0.95rem] font-semibold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring)]"
              style={{
                backgroundImage: MODE_PILL_FACE,
                color: MODE_BUTTON_INK,
                boxShadow: MODE_GLOW,
              }}
            >
              {HERO_SCAN_CTA_LABEL}
            </Link>
            <a
              href="#audit-trail"
              data-hero-cta="audit-trail"
              data-testid="hero-secondary-cta"
              className="inline-flex min-h-[3.25rem] min-w-[12rem] items-center justify-center rounded-2xl border px-6 py-4 text-[0.95rem] font-semibold transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ring-soft)]"
              style={{
                borderColor: 'rgba(228,207,162,0.45)',
                color: LANDING_TEXT,
                backgroundColor: 'rgba(255,255,255,0.04)',
              }}
            >
              {HERO_DASHBOARD_CTA_LABEL}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
