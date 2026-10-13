import { useCallback, type ReactNode } from 'react';
import { SEOHead } from '../components/SEOHead';
import { readStored, useLandingMode } from '../components/landing/landing-mode';
import { BETA } from '../config/beta';
import { LandingV2Header, type Lv2Theme } from '../components/landing/v2/LandingV2Header';
import {
  AiActTimeline,
  EuNativeGrid,
  FrameworkStrip,
  LifecycleGrid,
} from '../components/landing/v2/LandingV2Sections';
import { PricingV2 } from '../components/landing/v2/PricingV2';
import { FinalCta, LandingFaq, LandingV2Footer } from '../components/landing/v2/LandingV2Footer';
import { GovernanceControlRoom } from '../components/landing/GovernanceControlRoom';
import { GovernanceSelfCheck } from '../components/landing/GovernanceSelfCheck';
import { HeroV5 } from '../components/landing/v5/HeroV5';
import { BetaRibbon, V5BetaProgram, V5Loop, V5Roadmap } from '../components/landing/v5/V5Sections';
import { EvidenceEngine } from '../components/landing/v5/EvidenceEngine';
import '../styles/governance-os-landing.css';
import '../styles/landing-v2.css';
import '../styles/landing-v5.css';

/**
 * Landing v5 — Zusammenführung (Owner, 13.10.2026):
 *  - Hero, Buttons, Flows, Design: Landing v2
 *  - Texte: Live-Landing v4 (i18n `v4Hero*`, LOOP_NODES)
 *  - Evidence: EvidenceEngine (ersetzt EvidenceChainPreview)
 *  - three.js-Hero, Beta-Testphase, Roadmap aus SSoT
 *
 * Nichts überschrieben: v4 bleibt unter /design/landing-v4, v2 unter /design/landing-v2.
 */
function Embed({ children }: { children: ReactNode }) {
  return <div className="lv2-embed ga-context rs-handoff">{children}</div>;
}

export function LandingV5() {
  const { mode, setMode } = useLandingMode();
  void mode;
  const chosen = typeof window !== 'undefined' ? readStored() : null;
  const theme: Lv2Theme = chosen === 'light' ? 'light' : 'dark';
  const setTheme = useCallback((next: Lv2Theme) => setMode(next === 'light' ? 'light' : 'gold'), [setMode]);

  return (
    <div className="lv2 v5" data-lv2-theme={theme} data-landing-mode={chosen ?? 'gold'} style={{ ['--v5-ribbon-h' as string]: BETA.active ? '40px' : '0px' }}>
      <SEOHead />
      <BetaRibbon source="landing-v5-ribbon" />
      <LandingV2Header theme={theme} onThemeChange={setTheme} />
      <main>
        <HeroV5 />
        <FrameworkStrip />
        <V5Loop />
        <V5BetaProgram />
        <Embed>
          <GovernanceControlRoom />
        </Embed>
        <LifecycleGrid />
        <EvidenceEngine />
        <AiActTimeline />
        <EuNativeGrid />
        <Embed>
          <GovernanceSelfCheck />
        </Embed>
        <PricingV2 />
        <V5Roadmap />
        <LandingFaq />
        <FinalCta />
      </main>
      <LandingV2Footer />
    </div>
  );
}
