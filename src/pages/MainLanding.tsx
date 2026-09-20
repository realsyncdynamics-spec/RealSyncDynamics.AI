import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';
import { LandingPricingSection } from '../components/landing/LandingPricingSection';
import { PublicDarkHeader } from '../components/landing/PublicDarkHeader';
import { HeroTitanium } from '../components/landing/HeroTitanium';
import { LandingModeSwitch } from '../components/landing/LandingModeSwitch';
import { MODE_BG, useLandingMode } from '../components/landing/landing-mode';
import { RuntimePreviewPanel } from '../components/landing/RuntimePreviewPanel';
import { LandingDarkBand } from '../components/landing/LandingDarkBand';
import { GovernanceRuntimeSection } from '../components/landing/GovernanceRuntimeSection';
import { LandingRoadmapSection } from '../components/landing/LandingRoadmapSection';
import { EnterpriseAccessSection } from '../components/landing/EnterpriseAccessSection';
import { PLATFORM_LIVE_ITEMS, STATUS_LABEL } from '../product/implementation-status';
import { useStagedReveal } from '../hooks/useStagedReveal';
import {
  LANDING_ACCENT,
  LANDING_ACCENT_SOFT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SANS,
  LANDING_TEXT,
} from '../components/landing/landing-theme';
import {
  HERO_DASHBOARD_CTA_LABEL,
  HERO_SCAN_CTA_LABEL,
} from '../components/governance-frontend/hero-content';

/**
 * Replit SSOT public `/` — Dark/Gold Europe-network (static), not interactive sphere.
 * KPI strip mirrors Replit chrome as illustrative demo values (not live production metrics).
 */

export function MainLanding() {
  const revealRoot = useStagedReveal<HTMLElement>();
  const { mode, setMode } = useLandingMode();

  return (
    <div
      className="landing-context relative min-h-screen antialiased"
      data-landing-mode={mode}
      style={{
        backgroundColor: MODE_BG,
        color: LANDING_TEXT,
        fontFamily: LANDING_SANS,
      }}
    >
      <SEOHead
        title="RealSyncDynamics.AI — AI Compliance Operations OS für Europa"
        description="AI Compliance Operations OS für Europa. Entdecken. Klassifizieren. Durchsetzen. Beweisen. Free Audit starten."
        canonical="/"
        ogTitle="AI Compliance Operations OS für Europa"
        ogDescription="RealSyncDynamics.AI — Governance-Infrastruktur für Europa. Free Audit starten."
      />

      <PublicDarkHeader overlay modeSwitch={<LandingModeSwitch mode={mode} onChange={setMode} />} />

      <main ref={revealRoot} className="relative z-10">
        <HeroTitanium />

        <RuntimePreviewPanel />

        <LandingChannelTools />

        <LandingDarkBand />

        {/* Live platform modules — registry-backed */}
        <section id="platform" className="border-t border-white/[0.06] py-[72px]">
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <p
              className="text-[10px] tracking-[0.22em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              LIVE MODULE
            </p>
            <h2
              className="mt-3 text-[clamp(1.75rem,1.1rem+2vw,2.5rem)] tracking-[-0.03em]"
              style={{ fontWeight: 600 }}
            >
              Module, die live erreichbar sind.
            </h2>
            <div className="mt-10 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">
              {PLATFORM_LIVE_ITEMS.map((cap) => {
                const body = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold" style={{ color: LANDING_TEXT }}>
                        {cap.name}
                      </h3>
                      <span
                        className="shrink-0 border px-2 py-0.5 text-[8px] tracking-[0.12em]"
                        style={{
                          fontFamily: LANDING_MONO,
                          borderColor: `${LANDING_ACCENT}40`,
                          color: LANDING_ACCENT,
                        }}
                      >
                        {STATUS_LABEL.live}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
                      {cap.description}
                    </p>
                  </>
                );
                return cap.route ? (
                  <Link
                    key={cap.id}
                    to={cap.route}
                    data-reveal
                    data-reveal-group="platform"
                    className="block p-7 transition hover:bg-white/[.03]"
                    style={{ backgroundColor: LANDING_BG }}
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    key={cap.id}
                    data-reveal
                    data-reveal-group="platform"
                    className="p-7"
                    style={{ backgroundColor: LANDING_BG }}
                  >
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="evidence" className="border-t border-white/[0.06] py-[72px]">
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <p
              className="text-[10px] tracking-[0.22em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              EVIDENCE
            </p>
            <h2
              className="mt-3 max-w-xl text-[clamp(1.75rem,1.1rem+2vw,2.5rem)] tracking-[-0.03em]"
              style={{ fontWeight: 600 }}
            >
              Compliance, die sich beweisen lässt.
            </h2>
            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed" style={{ color: LANDING_MUTED }}>
              Prüfungen, Entscheidungen und Änderungen landen in derselben Governance-Historie —
              exportierbar für Aufsicht, Board und Audit.
            </p>
            <Link
              to="/evidence"
              className="mt-7 inline-flex items-center gap-2 text-[13px] font-medium"
              style={{ color: LANDING_ACCENT_SOFT }}
            >
              {HERO_DASHBOARD_CTA_LABEL} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <GovernanceRuntimeSection />

        <LandingRoadmapSection />
        <LandingPricingSection />
        <EnterpriseAccessSection />

        <section className="border-t border-white/[0.06] bg-black/60 py-[80px]">
          <div className="mx-auto max-w-3xl px-[4vw] text-center">
            <h2
              className="text-[clamp(2rem,1.2rem+2.5vw,3rem)] tracking-tight"
              style={{ fontWeight: 600 }}
            >
              Governance statt Checkliste.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: '#c8c4bc' }}>
              Eine Checkliste beruhigt bis zum nächsten Audit. Die Runtime hält den Nachweis, wenn
              Aufsicht, Kunde oder Board fragt.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/audit"
                className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-semibold transition hover:brightness-110"
                style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
              >
                {HERO_SCAN_CTA_LABEL} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-[13px] font-medium"
                style={{ borderColor: `${LANDING_ACCENT}66`, color: LANDING_ACCENT }}
              >
                Preise ansehen
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="relative z-10 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] px-[4vw] py-[28px] text-[9px] sm:flex-row"
        style={{ fontFamily: LANDING_MONO, color: '#62666e' }}
      >
        <span>© 2026 RealSync Dynamics.AI</span>
        <div className="flex gap-5">
          <Link to="/impressum" className="hover:text-[#f2eee6]">
            Impressum
          </Link>
          <Link to="/datenschutz" className="hover:text-[#f2eee6]">
            Datenschutz
          </Link>
          <Link to="/agb" className="hover:text-[#f2eee6]">
            AGB
          </Link>
        </div>
      </footer>
    </div>
  );
}
