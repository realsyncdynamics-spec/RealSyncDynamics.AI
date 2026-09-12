import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { LandingPricingSection } from '../components/landing/LandingPricingSection';
import { LandingRoadmapSection } from '../components/landing/LandingRoadmapSection';
import { LandingOsSpine } from '../components/landing/LandingOsSpine';
import { PublicDarkHeader } from '../components/landing/PublicDarkHeader';
import { HeroEarthBackdrop } from '../components/landing/HeroEarthBackdrop';
import { OsEntryLink } from '../components/landing/OsEntryLink';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BODY,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_EYEBROW,
  LANDING_H1,
  LANDING_H2,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SANS,
  LANDING_SERIF,
  LANDING_TEXT,
} from '../components/landing/landing-theme';
import {
  CONTINUOUS_COMPLIANCE_NARRATIVE,
  HERO_DASHBOARD_CTA_LABEL,
  HERO_EN_KICKER,
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
  HERO_SCAN_CTA_LABEL,
  HERO_SCAN_CTA_LONG,
  HERO_SUBLINE,
} from '../components/governance-frontend/hero-content';
import { PLATFORM_LIVE_ITEMS } from '../product/implementation-status';
import { useStagedReveal } from '../hooks/useStagedReveal';

// Registry referenced so claim/wiring tests stay honest (Proof uses PLATFORM_LIVE_ITEMS in spine).
void PLATFORM_LIVE_ITEMS;

export function MainLanding() {
  const revealRoot = useStagedReveal<HTMLElement>();

  return (
    <div
      className="landing-context relative min-h-screen antialiased"
      style={{
        backgroundColor: LANDING_BG,
        color: LANDING_TEXT,
        fontFamily: LANDING_SANS,
        backgroundImage: 'radial-gradient(circle at 70% 15%, #0c121c 0, #02040a 34%, #010308 100%)',
      }}
    >
      <SEOHead
        title="RealSyncDynamics.AI — AI Compliance Operations OS for Europe"
        description={HERO_SUBLINE}
        canonical="/"
        ogTitle={HERO_EN_KICKER}
        ogDescription={HERO_SUBLINE}
      />

      <div
        className="pointer-events-none fixed right-[-18vw] top-[10vh] h-[40vw] w-[40vw] rounded-full opacity-[0.07] blur-[100px]"
        style={{ background: '#9a8b6a' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed left-[-25vw] top-[45vh] h-[40vw] w-[40vw] rounded-full opacity-[0.07] blur-[100px]"
        style={{ background: '#1a4a62' }}
        aria-hidden="true"
      />

      <PublicDarkHeader />

      <main ref={revealRoot} className="relative z-10">
        <section
          id="product"
          className="relative isolate min-h-[min(92vh,900px)] overflow-hidden border-b border-[#e4cfa2]/10 lg:min-h-[min(90vh,860px)]"
        >
          {/* Full-bleed Sovereign Night Earth — world globe, not Europe panel */}
          <div className="absolute inset-0 -z-10">
            <HeroEarthBackdrop />
          </div>

          <div className="relative mx-auto flex max-w-[920px] flex-col items-center px-[4vw] pb-[48px] pt-[36px] text-center pointer-events-none lg:pb-[56px] lg:pt-[44px]">
            <h1
              className="relative w-full max-w-[22ch] leading-[1.05] tracking-[-0.035em] sm:max-w-none"
              style={{
                fontFamily: LANDING_SANS,
                fontWeight: 650,
                fontSize: LANDING_H1,
                color: LANDING_TEXT,
              }}
            >
              <span className="hero-shine-glow" aria-hidden="true">
                {HERO_HEADLINE.map((segments, line) => (
                  <span key={`glow-${line}`} className="block">
                    {segments.map((segment) => segment.text).join('')}
                  </span>
                ))}
              </span>
              {HERO_HEADLINE.map((segments, line) => (
                <span key={line} className="block">
                  {segments.map((segment, i) =>
                    segment.accent ? (
                      <em
                        key={i}
                        className="hero-shine-accent not-italic"
                        style={{ color: LANDING_ACCENT, fontStyle: 'normal' }}
                      >
                        {segment.text}
                      </em>
                    ) : (
                      <span key={i} className="hero-shine">
                        {segment.text}
                      </span>
                    ),
                  )}
                </span>
              ))}
            </h1>

            <p
              className="mt-5 tracking-[0.18em]"
              style={{
                fontFamily: LANDING_MONO,
                fontSize: LANDING_EYEBROW,
                color: '#9a9178',
                textTransform: 'uppercase',
              }}
            >
              {HERO_OPERATING_LOOP}
            </p>

            <p
              className="mt-5 max-w-[34rem] leading-[1.55]"
              style={{ color: 'rgba(246,242,233,0.82)', fontSize: LANDING_BODY }}
            >
              {HERO_SUBLINE}
            </p>

            <div className="pointer-events-auto mt-8 flex w-full max-w-[520px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-3.5">
              <Link
                to="/audit"
                id="scan"
                data-hero-cta
                className="inline-flex items-center justify-center gap-2 rounded-full px-[26px] py-[14px] text-[14px] font-semibold shadow-[0_0_0_1px_rgba(228,207,162,0.35)] transition hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]"
                style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
              >
                {HERO_SCAN_CTA_LABEL} <span aria-hidden="true">→</span>
              </Link>
              <OsEntryLink
                to="/app"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-[24px] py-[13px] text-[14px] font-medium transition hover:bg-[#e4cfa2]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]/60"
                style={{
                  borderColor: 'rgba(242,238,230,0.45)',
                  backgroundColor: 'rgba(8,10,14,0.55)',
                  color: LANDING_TEXT,
                }}
              >
                {HERO_DASHBOARD_CTA_LABEL}
              </OsEntryLink>
            </div>
          </div>
        </section>

        <LandingOsSpine />

        <LandingPricingSection />

        <LandingRoadmapSection />

        <section className="border-t border-[#e4cfa2]/10 bg-black/80 py-[64px] lg:py-[72px]">
          <div className="mx-auto max-w-3xl px-[4vw] text-center">
            <p
              className="text-[10px] tracking-[.25em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              NÄCHSTER SCHRITT
            </p>
            <h2
              className="hero-shine mt-4 tracking-tight"
              style={{ fontFamily: LANDING_SERIF, fontWeight: 500, fontSize: LANDING_H2 }}
            >
              Scan. Dashboard. Evidence.
            </h2>
            <p
              className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed"
              style={{ color: 'rgba(246,242,233,0.72)' }}
            >
              {CONTINUOUS_COMPLIANCE_NARRATIVE} Der Free Audit ist Acquisition — danach Governance
              Activation und Workspace.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/audit"
                className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-semibold transition hover:brightness-105"
                style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
              >
                {HERO_SCAN_CTA_LONG} <ArrowRight className="h-4 w-4" />
              </Link>
              <OsEntryLink
                to="/app"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 font-medium transition hover:bg-[#e4cfa2]/10"
                style={{ borderColor: `${LANDING_ACCENT}80`, color: '#e8dfd2' }}
              >
                {HERO_DASHBOARD_CTA_LABEL}
              </OsEntryLink>
              <OsEntryLink
                to="/app/evidence"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 font-medium transition hover:bg-[#e4cfa2]/10"
                style={{ borderColor: `${LANDING_ACCENT}80`, color: '#e8dfd2' }}
              >
                Evidence-Preview
              </OsEntryLink>
            </div>
            <p className="mt-4 text-[11px]" style={{ color: LANDING_MUTED }}>
              <Link to="/faq" className="underline decoration-[#e4cfa2]/40 underline-offset-2">
                FAQ
              </Link>
              {' · '}
              <Link to="/#pricing" className="underline decoration-[#e4cfa2]/40 underline-offset-2">
                Preise
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer
        className="relative z-10 flex flex-col items-center justify-center gap-4 border-t border-[#e4cfa2]/12 px-[4vw] py-[28px] text-[11px] sm:flex-row sm:justify-between"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        <span>© 2026 RealSync Dynamics.AI</span>
        <nav aria-label="Rechtliches" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {[
            { label: 'Impressum', to: '/impressum' },
            { label: 'AGB', to: '/agb' },
            { label: 'Datenschutz', to: '/datenschutz' },
            { label: 'Widerruf', to: '/legal/widerruf' },
            { label: 'Kontakt', to: '/kontakt' },
            { label: 'Roadmap', to: '/roadmap' },
          ].map((item, idx, arr) => (
            <span key={item.to} className="inline-flex items-center gap-x-3">
              <Link to={item.to} className="hover:text-[#f6f2e9]">
                {item.label}
              </Link>
              {idx < arr.length - 1 && (
                <span aria-hidden="true" className="text-[#9a9aa1]/55">
                  |
                </span>
              )}
            </span>
          ))}
        </nav>
      </footer>
    </div>
  );
}
