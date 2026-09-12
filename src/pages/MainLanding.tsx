import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  LANDING_META,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SANS,
  LANDING_SERIF,
  LANDING_TEXT,
} from '../components/landing/landing-theme';
import {
  CONTINUOUS_COMPLIANCE_NARRATIVE,
  HERO_EN_KICKER,
  HERO_EU_LINE,
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
  HERO_OUTCOMES,
  HERO_SCAN_CTA_LABEL,
  HERO_SCAN_CTA_LONG,
  HERO_SCAN_CTA_PROMISE,
  HERO_SCAN_PROMISE_LINE,
  HERO_SUBLINE,
  SCAN_FUNNEL_MESSAGE,
} from '../components/governance-frontend/hero-content';
import { PLATFORM_LIVE_ITEMS } from '../product/implementation-status';
import { useStagedReveal } from '../hooks/useStagedReveal';

// Registry referenced so claim/wiring tests stay honest (Proof uses PLATFORM_LIVE_ITEMS in spine).
void PLATFORM_LIVE_ITEMS;

export function MainLanding() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const revealRoot = useStagedReveal<HTMLElement>();

  const startScan = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    // Acquisition only — kanonisch `/audit` (CLAUDE.md §10). Produkt = Activation + OS.
    navigate(value ? `/audit?domain=${encodeURIComponent(value)}` : '/audit');
  };

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
        title="RealSyncDynamics.AI — AI Governance Runtime"
        description={`${CONTINUOUS_COMPLIANCE_NARRATIVE} ${HERO_SUBLINE}`}
        canonical="/"
        ogTitle={HERO_EN_KICKER}
        ogDescription={CONTINUOUS_COMPLIANCE_NARRATIVE}
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
          className="relative isolate min-h-[min(92vh,900px)] overflow-hidden border-b border-[#d0c3a4]/10 lg:min-h-[min(90vh,860px)]"
        >
          <div className="absolute inset-0 -z-10">
            <HeroEarthBackdrop />
          </div>

          <div className="relative mx-auto flex max-w-[880px] flex-col items-center px-[4vw] pb-[44px] pt-[28px] text-center pointer-events-none lg:pb-[48px] lg:pt-[32px]">
            <div
              className="inline-block rounded-full border px-[12px] py-[7px] font-medium tracking-[.22em]"
              style={{
                fontFamily: LANDING_MONO,
                fontSize: LANDING_META,
                color: LANDING_ACCENT,
                borderColor: `${LANDING_ACCENT}47`,
              }}
            >
              AI GOVERNANCE OPERATING SYSTEM
            </div>

            <p
              className="mt-3.5 tracking-[.14em]"
              style={{ fontFamily: LANDING_MONO, fontSize: LANDING_EYEBROW, color: '#b8ad91' }}
            >
              {HERO_EN_KICKER}
            </p>

            <h1
              className="relative mt-[12px] mb-3 w-full max-w-[38ch] leading-[1.06] tracking-[-.03em] lg:mt-[14px] lg:mb-3.5"
              style={{ fontFamily: LANDING_SERIF, fontWeight: 600, fontSize: LANDING_H1 }}
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
                        className="hero-shine-accent"
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
              className="mb-2.5 tracking-[.12em] lg:mb-3"
              style={{ fontFamily: LANDING_MONO, fontSize: LANDING_EYEBROW, color: '#b8ad91' }}
            >
              {HERO_OPERATING_LOOP}
            </p>

            <p
              className="mb-2.5 max-w-[560px] font-medium leading-[1.45]"
              style={{ color: '#efe8dc', fontSize: LANDING_BODY }}
            >
              {SCAN_FUNNEL_MESSAGE}
            </p>

            <p
              className="max-w-[560px] leading-[1.55]"
              style={{ color: 'rgba(246,242,233,0.88)', fontSize: LANDING_BODY }}
            >
              {HERO_SUBLINE}
            </p>

            <ul className="my-[16px] w-full max-w-[580px] space-y-2.5 text-left lg:my-[18px]">
              {HERO_OUTCOMES.map((outcome) => (
                <li
                  key={outcome}
                  className="flex gap-2.5 leading-snug"
                  style={{ color: '#d6cfbf', fontSize: LANDING_BODY }}
                >
                  <span style={{ color: LANDING_ACCENT }} aria-hidden>
                    —
                  </span>
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>

            <p
              className="mb-5 max-w-[540px] leading-relaxed"
              style={{ fontFamily: LANDING_MONO, fontSize: LANDING_EYEBROW, color: '#8f8772' }}
            >
              {HERO_EU_LINE}
            </p>

            <form id="scan" onSubmit={startScan} className="pointer-events-auto w-full max-w-[660px]">
              <p
                className="mb-2.5 px-1 leading-snug"
                style={{ color: '#efe8dc', fontSize: LANDING_BODY }}
              >
                {HERO_SCAN_PROMISE_LINE}
              </p>
              <div
                className="flex flex-col gap-0 rounded-full border p-1.5 sm:flex-row sm:items-stretch"
                style={{
                  borderColor: 'rgba(208,195,164,0.24)',
                  backgroundColor: 'rgba(4,6,10,0.78)',
                }}
              >
                <input
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  type="url"
                  placeholder="Ihre Website –"
                  aria-label="Ihre Website"
                  className="min-w-0 flex-1 bg-transparent px-5 py-3.5 text-center text-[#f6f2e9] outline-none placeholder:text-[#a3a3aa]/70 focus-visible:ring-2 focus-visible:ring-[#d0c3a4]/45 sm:rounded-full sm:text-left lg:py-4"
                  style={{ fontSize: LANDING_BODY }}
                />
                <button
                  type="submit"
                  data-hero-cta
                  className="inline-flex items-center justify-center gap-2 rounded-full px-[22px] py-[13px] text-[14px] font-semibold shadow-[0_0_0_1px_rgba(208,195,164,0.35)] transition hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c3a4] lg:py-[14px]"
                  style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
                >
                  {HERO_SCAN_CTA_LABEL} <span aria-hidden="true">→</span>
                </button>
              </div>
              <p
                className="mt-2.5 px-1 leading-snug"
                style={{ color: '#efe8dc', fontSize: LANDING_EYEBROW }}
              >
                {HERO_SCAN_CTA_PROMISE}
              </p>
              <p
                className="mt-1.5 px-1 tracking-[.08em]"
                style={{ fontFamily: LANDING_MONO, fontSize: LANDING_META, color: '#6e7077' }}
              >
                Acquisition-Scan · kein Account fürs erste Ergebnis · Produkt = Activation + OS
              </p>
            </form>

            <div className="pointer-events-auto mt-5 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center lg:mt-6">
              <OsEntryLink
                to="/app/evidence"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-[22px] py-[12px] text-[14px] font-medium transition hover:bg-[#d0c3a4]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c3a4]/60"
                style={{ borderColor: `${LANDING_ACCENT}80`, color: '#efe8dc' }}
              >
                Evidence-Preview <span aria-hidden="true">→</span>
              </OsEntryLink>
              <OsEntryLink
                to="/app/activation"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-[22px] py-[12px] text-[14px] font-medium transition hover:bg-[#d0c3a4]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c3a4]/60"
                style={{ borderColor: `${LANDING_ACCENT}55`, color: '#c4b796' }}
              >
                Guided Activation <span aria-hidden="true">→</span>
              </OsEntryLink>
            </div>
          </div>
        </section>

        <LandingOsSpine />

        <LandingPricingSection />

        <LandingRoadmapSection />

        {/* Three CTA levels — never a generic demo booking as primary */}
        <section className="border-t border-[#d0c3a4]/10 bg-black/85 py-[64px] lg:py-[72px]">
          <div className="mx-auto max-w-3xl px-[4vw] text-center">
            <p
              className="text-[10px] tracking-[.25em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              DREI EINSTIEGE
            </p>
            <h2
              className="hero-shine mt-4 tracking-tight"
              style={{ fontFamily: LANDING_SERIF, fontWeight: 500, fontSize: LANDING_H2 }}
            >
              Scan. Evidence. Enterprise.
            </h2>
            <p
              className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed"
              style={{ color: 'rgba(246,242,233,0.78)' }}
            >
              {CONTINUOUS_COMPLIANCE_NARRATIVE} Der Free-Scan ist Acquisition — danach Governance
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
                to="/app/evidence"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 font-medium transition hover:bg-[#d0c3a4]/10"
                style={{ borderColor: `${LANDING_ACCENT}80`, color: '#efe8dc' }}
              >
                Evidence-Preview / Beispiel-Report
              </OsEntryLink>
              <Link
                to="/contact-sales?source=landing-cta&intent=enterprise"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 font-medium transition hover:bg-[#d0c3a4]/10"
                style={{ borderColor: `${LANDING_ACCENT}80`, color: '#efe8dc' }}
              >
                Enterprise / Guided Activation
              </Link>
            </div>
            <p className="mt-4 text-[11px]" style={{ color: LANDING_MUTED }}>
              Guided Activation auch über{' '}
              <OsEntryLink to="/app/activation" className="underline decoration-[#d0c3a4]/40">
                /app/activation
              </OsEntryLink>
              {' '}
              — Primär-CTA ist nie eine generische Demo-Buchung.
            </p>
            <p className="mt-2 text-[11px]" style={{ color: LANDING_MUTED }}>
              <Link to="/faq" className="underline decoration-[#d0c3a4]/40 underline-offset-2">
                FAQ
              </Link>
              {' · '}
              <Link to="/#pricing" className="underline decoration-[#d0c3a4]/40 underline-offset-2">
                Preise
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer
        className="relative z-10 flex flex-col items-center justify-center gap-4 border-t border-[#d0c3a4]/12 px-[4vw] py-[28px] text-[11px] sm:flex-row sm:justify-between"
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
