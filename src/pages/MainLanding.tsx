import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { EnterpriseAccessSection } from '../components/landing/EnterpriseAccessSection';
import { EuropeReliefBackdrop } from '../components/landing/EuropeReliefBackdrop';
import { GovernanceFooter } from '../components/landing/GovernanceFooter';
import { GovernanceLoopBand } from '../components/landing/GovernanceLoopBand';
import { GovernanceStatusBar } from '../components/landing/GovernanceStatusBar';
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
import { prefersReducedMotion } from '../components/landing/prefers-reduced-motion';
import { useGaTheme } from '../components/landing/use-ga-theme';
import {
  GA_DISPLAY,
  GA_GOLD_FACE,
  GA_GOLD_FACE_SHADOW,
  GA_GOLD_LITE,
  GA_GOLD_TEXT,
  GA_GREEN,
  GA_H1,
  GA_LEDE,
  GA_LINE,
  GA_LINE_SOFT,
  GA_MONO,
  GA_MUTED,
  GA_PILL_GHOST,
  GA_SANS,
  GA_SILVER,
  GA_SILVER_TEXT,
  GA_TEXT,
  GA_TITAN,
  GA_VOID,
} from '../components/landing/governance-ai-theme';
import {
  CONTINUOUS_COMPLIANCE_NARRATIVE,
  HERO_DASHBOARD_CTA_LABEL,
  HERO_EU_LINE,
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
  HERO_SCAN_CTA_LABEL,
  HERO_SUBLINE,
  HERO_VALUE_SUBLINE,
} from '../components/governance-frontend/hero-content';

// PLATFORM_LIVE_ITEMS / implementation-status — rendered by PlatformCapabilitiesSection

const HERO_PROOF_CHIPS = ['EVIDENCE-CHAIN', 'AI-ACT-KLASSIFIKATION', 'PROVENANCE · C2PA'] as const;

const POLICY_PACKS: readonly (readonly [string, boolean])[] = [
  ['DSGVO', true],
  ['EU AI ACT', true],
  ['ISO 27001', true],
  ['NIS2', true],
  ['TISAX', false],
  ['DORA', false],
];

const HEX = '0123456789abcdef';
const randomHex = (length: number) =>
  Array.from({ length }, () => HEX[Math.floor(Math.random() * 16)]).join('');

function useEvidenceSeal() {
  const [seal, setSeal] = useState({ age: 4, height: 1284, hash: `0x${randomHex(4)}…${randomHex(4)}` });
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const interval = window.setInterval(() => {
      setSeal((current) => {
        const age = current.age + 1;
        if (age <= 14 + Math.random() * 10) return { ...current, age };
        return { age: 0, height: current.height + 1, hash: `0x${randomHex(4)}…${randomHex(4)}` };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);
  return seal;
}

export function MainLanding() {
  const { theme, setTheme } = useGaTheme();
  const seal = useEvidenceSeal();

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const onMove = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.('.ga-card') as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--ga-mx', `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
      target.style.setProperty('--ga-my', `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <div
      className="landing-context relative min-h-screen antialiased"
      data-ga-theme={theme}
      data-landing-variant={theme === 'night' ? 'screen-2-nacht' : 'screen-1-titan'}
      style={{ backgroundColor: GA_VOID, color: GA_TEXT, fontFamily: GA_SANS, fontFeatureSettings: '"ss01", "cv11"' }}
    >
      <SEOHead
        title="RealSyncDynamics.AI — AI Compliance Operations OS for Europe"
        description="AI Compliance Operations OS for Europe. Governance OS fuer DSGVO und EU AI Act."
        canonical="/"
        ogTitle="AI Compliance Operations OS for Europe"
        ogDescription="RealSyncDynamics.AI — Free Audit starten. Continuous evidence."
      />
      <EuropeReliefBackdrop theme={theme} />
      <div className="relative z-10 flex min-h-screen flex-col">
        <GovernanceStatusBar theme={theme} onThemeChange={setTheme} />
        <PublicDarkHeader tone={theme === 'night' ? 'default' : 'titan'} />
        <main className="mx-auto flex w-full max-w-[1500px] flex-1 items-center overflow-x-clip px-[4vw] pb-[clamp(40px,5vw,80px)] pt-[clamp(48px,7vw,108px)]">
          <div className="relative max-w-[640px]">
            <h1
              className="m-0 max-w-[22ch] text-balance leading-[.98]"
              style={{
                fontFamily: GA_DISPLAY,
                fontWeight: 'var(--ga-h1-weight)' as unknown as number,
                letterSpacing: 'var(--ga-h1-tracking)',
                fontSize: GA_H1,
                backgroundImage: GA_SILVER_TEXT,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {HERO_HEADLINE.map((segments, line) => (
                <span key={line} className="block">
                  {segments.map((segment, index) =>
                    segment.accent ? (
                      <em key={index} className="not-italic" style={{ backgroundImage: GA_GOLD_TEXT, backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                        {segment.text}
                      </em>
                    ) : (
                      <span key={index}>{segment.text}</span>
                    ),
                  )}
                </span>
              ))}
            </h1>
            <p className="mt-[26px] text-[11.5px] uppercase tracking-[.3em]" style={{ fontFamily: GA_MONO, color: '#c2c8d0' }}>
              {HERO_OPERATING_LOOP}
            </p>
            <p className="mt-5 max-w-[36rem] text-pretty leading-[1.5]" style={{ fontSize: GA_LEDE, color: '#d3d9e1' }}>
              {HERO_SUBLINE}
            </p>
            <p className="mt-3 text-[15px] font-medium" style={{ color: GA_GOLD_LITE }}>{HERO_VALUE_SUBLINE}</p>
            <p className="mt-3 max-w-[36rem] text-[13.5px] leading-[1.6]" style={{ color: GA_MUTED }}>{HERO_EU_LINE}</p>
            <div className="mt-[34px] flex w-full flex-col gap-3.5 sm:flex-row sm:items-center">
              <Link to="/audit" id="scan" data-hero-cta className="ga-pill-sheen relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-[28px] py-[15px] text-[14px] font-semibold" style={{ background: GA_GOLD_FACE, color: '#14100b', boxShadow: GA_GOLD_FACE_SHADOW }}>
                {HERO_SCAN_CTA_LABEL}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <OsEntryLink to="/app" data-hero-cta className={GA_PILL_GHOST}>
                {HERO_DASHBOARD_CTA_LABEL}
              </OsEntryLink>
            </div>
            <div className="mt-[30px] flex flex-wrap gap-2.5">
              {HERO_PROOF_CHIPS.map((chip) => (
                <span key={chip} className="flex items-center gap-2.5 rounded-full border px-3.5 py-[7px] text-[11px]" style={{ borderColor: GA_LINE_SOFT, fontFamily: GA_MONO, color: GA_MUTED }}>
                  <i className="h-[5px] w-[5px] rounded-full not-italic" style={{ backgroundColor: GA_GREEN }} aria-hidden="true" />
                  {chip}
                </span>
              ))}
            </div>
            <p className="mt-7 text-[11px] tracking-[.12em]" style={{ fontFamily: GA_MONO, color: GA_TITAN }}>
              LETZTER NACHWEIS VERANKERT <b style={{ color: GA_GOLD_LITE }}>vor {seal.age} s</b>
            </p>
            <div className="mt-[34px] flex flex-wrap gap-2 border-t pt-[22px]" style={{ borderColor: GA_LINE_SOFT }}>
              {POLICY_PACKS.map(([name, live]) => (
                <span key={name} className="rounded border px-3 py-[7px] text-[11px]" style={{ fontFamily: GA_MONO, borderColor: GA_LINE, borderStyle: live ? 'solid' : 'dashed', color: live ? GA_SILVER : GA_TITAN }}>
                  {name}
                </span>
              ))}
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
        <section id="next" className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(60px,6vw,92px)]" style={{ borderColor: GA_LINE_SOFT }}>
          <div className="mx-auto max-w-[780px] text-center">
            <SectionEyebrow>NAECHSTER SCHRITT</SectionEyebrow>
            <SectionHeading centered>Scan. Dashboard. Evidence.</SectionHeading>
            <p className="mx-auto mt-4 max-w-[660px] text-[14px] leading-[1.7]" style={{ color: GA_MUTED }}>
              {CONTINUOUS_COMPLIANCE_NARRATIVE}
            </p>
            <div className="mt-[34px] flex flex-wrap justify-center gap-3.5">
              <Link to="/audit" className="ga-pill-sheen rounded-full px-[28px] py-[15px] text-[14px] font-semibold" style={{ background: GA_GOLD_FACE, color: '#14100b', boxShadow: GA_GOLD_FACE_SHADOW }}>
                {HERO_SCAN_CTA_LABEL}
              </Link>
              <Link to="/app" className={GA_PILL_GHOST}>{HERO_DASHBOARD_CTA_LABEL}</Link>
            </div>
          </div>
        </section>
        <GovernanceFooter />
      </div>
    </div>
  );
}
