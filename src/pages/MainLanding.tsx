import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { EnterpriseAccessSection } from '../components/landing/EnterpriseAccessSection';
import { EuropeReliefBackdrop } from '../components/landing/EuropeReliefBackdrop';
import { GovernanceFooter } from '../components/landing/GovernanceFooter';
import { GovernanceLoopBand } from '../components/landing/GovernanceLoopBand';
import { OsEntryLink } from '../components/landing/OsEntryLink';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';
import { LandingPricingSection } from '../components/landing/LandingPricingSection';
import { LandingRoadmapSection } from '../components/landing/LandingRoadmapSection';
import { PlatformCapabilitiesSection } from '../components/landing/PlatformCapabilitiesSection';
import { PublicDarkHeader } from '../components/landing/PublicDarkHeader';
import { RegulatoryTicker } from '../components/landing/RegulatoryTicker';
import { RuntimeLayersSection } from '../components/landing/RuntimeLayersSection';
import { SectionEyebrow, SectionHeading } from '../components/landing/GovernanceSectionChrome';
import { WorkspacePreviewSection } from '../components/landing/WorkspacePreviewSection';
import {
  GA_DISPLAY, GA_GOLD_FACE, GA_GOLD_FACE_SHADOW, GA_GOLD_TEXT,
  GA_H1, GA_LEDE, GA_LINE_SOFT, GA_MONO, GA_MUTED,
  GA_PILL_GHOST, GA_SANS, GA_SILVER_TEXT, GA_TEXT, GA_VOID,
} from '../components/landing/governance-ai-theme';
import {
  CONTINUOUS_COMPLIANCE_NARRATIVE, HERO_DASHBOARD_CTA_LABEL,
  HERO_HEADLINE, HERO_OPERATING_LOOP, HERO_SCAN_CTA_LABEL, HERO_SUBLINE,
} from '../components/governance-frontend/hero-content';

/**
 * Startseite — „The Governance AI", Titan-Variante.
 *
 * Aufbau von oben:
 *   Header · Hero · Ticker · Governance-Loop
 *   01 Workspace · 02 Runtime · 03 Module · Kanäle
 *   04 Tarife · 05 Status · Enterprise · Abschluss · Footer
 *
 * Der Hero führt über genau einen Einstieg zum Scan: die Gold-Pill als Link
 * auf `/audit` (`id="scan"`, `data-hero-cta`).
 */

export function MainLanding() {
  return (
    <div
      className="landing-context relative min-h-screen antialiased"
      style={{
        backgroundColor: GA_VOID,
        color: GA_TEXT,
        fontFamily: GA_SANS,
        fontFeatureSettings: '"ss01", "cv11"',
      }}
    >
      <SEOHead
        title="RealSyncDynamics.AI — AI Compliance Operations OS for Europe"
        description="AI Compliance Operations OS for Europe. Governance OS für DSGVO und EU AI Act — Discover, Classify, Enforce, Prove."
        canonical="/"
        ogTitle="AI Compliance Operations OS for Europe"
        ogDescription="RealSyncDynamics.AI — AI Compliance Operations OS for Europe. Free Audit starten. Continuous evidence."
      />

      <EuropeReliefBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col">
        <PublicDarkHeader tone="titan" />

        <main className="mx-auto flex w-full max-w-[1500px] flex-1 items-center overflow-x-clip px-[4vw] pb-[clamp(40px,5vw,80px)] pt-[clamp(48px,7vw,108px)]">
          <div className="relative max-w-[640px]">
            <h1
              className="m-0 max-w-[22ch] text-balance leading-[.98] tracking-[-.045em]"
              style={{
                fontFamily: GA_DISPLAY,
                fontWeight: 600,
                fontSize: GA_H1,
                backgroundImage: GA_SILVER_TEXT,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 6px 18px rgba(0,0,0,.55))',
              }}
            >
              {HERO_HEADLINE.map((segments, line) => (
                <span key={line} className="block">
                  {segments.map((segment, index) =>
                    segment.accent ? (
                      <em
                        key={index}
                        className="not-italic"
                        style={{
                          backgroundImage: GA_GOLD_TEXT,
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          color: 'transparent',
                        }}
                      >
                        {segment.text}
                      </em>
                    ) : (
                      <span key={index}>{segment.text}</span>
                    ),
                  )}
                </span>
              ))}
            </h1>

            <p
              className="mt-[26px] text-[11.5px] uppercase tracking-[.3em]"
              style={{ fontFamily: GA_MONO, color: '#ffffff' }}
            >
              {HERO_OPERATING_LOOP}
            </p>

            <p
              className="mt-5 max-w-[36rem] text-pretty leading-[1.5] tracking-[-.01em]"
              style={{ fontSize: GA_LEDE, color: '#ffffff' }}
            >
              {HERO_SUBLINE}
            </p>

            {/* CTA-Paar des Designs: Goldsiegel-Pill + Glas-Pill. `id="scan"`
                und `data-hero-cta` sind der Kontrakt — der kanonische
                Scan-Einstieg ist ein Link auf `/audit`. */}
            <div className="mt-[34px] flex w-full flex-col gap-3.5 sm:flex-row sm:items-center">
              <Link
                to="/audit"
                id="scan"
                data-hero-cta
                className="ga-pill-sheen relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-[28px] py-[15px] text-[14px] font-semibold transition hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6c98a]"
                style={{ background: GA_GOLD_FACE, color: '#14100b', boxShadow: GA_GOLD_FACE_SHADOW }}
              >
                {HERO_SCAN_CTA_LABEL}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <OsEntryLink to="/app" data-hero-cta className={GA_PILL_GHOST}>
                {HERO_DASHBOARD_CTA_LABEL}
              </OsEntryLink>
            </div>
          </div>
        </main>

        <RegulatoryTicker />
        <GovernanceLoopBand />

        <WorkspacePreviewSection />
        <RuntimeLayersSection />
        <PlatformCapabilitiesSection />
        <LandingRoadmapSection />
        <LandingChannelTools />
        <LandingPricingSection />
        <EnterpriseAccessSection />

        <section
          id="next"
          className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(60px,6vw,92px)]"
          style={{ borderColor: GA_LINE_SOFT }}
        >
          <div className="mx-auto max-w-[780px] text-center">
            <SectionEyebrow>NÄCHSTER SCHRITT</SectionEyebrow>
            <SectionHeading centered>Scan. Dashboard. Evidence.</SectionHeading>
            <p
              className="mx-auto mt-4 max-w-[660px] text-pretty text-[14px] leading-[1.7]"
              style={{ color: GA_MUTED }}
            >
              {CONTINUOUS_COMPLIANCE_NARRATIVE} Der Free Audit ist der Einstieg — danach Governance
              Activation und Workspace.
            </p>
            <div className="mt-[34px] flex flex-wrap justify-center gap-3.5">
              <Link
                to="/audit"
                className="ga-pill-sheen relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-[28px] py-[15px] text-[14px] font-semibold transition hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6c98a]"
                style={{ background: GA_GOLD_FACE, color: '#14100b', boxShadow: GA_GOLD_FACE_SHADOW }}
              >
                {HERO_SCAN_CTA_LABEL}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/app" className={GA_PILL_GHOST}>
                {HERO_DASHBOARD_CTA_LABEL}
              </Link>
              <Link to="/evidence" className={GA_PILL_GHOST}>
                Evidence-Preview
              </Link>
            </div>
          </div>
        </section>

        <GovernanceFooter />
      </div>
    </div>
  );
}
