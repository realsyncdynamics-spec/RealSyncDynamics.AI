import { useCallback } from 'react';
import { SEOHead } from '../components/SEOHead';
import { useLandingMode } from '../components/landing/landing-mode';
import { LandingV2Header, type Lv2Theme } from '../components/landing/v2/LandingV2Header';
import { HeroV2 } from '../components/landing/v2/HeroV2';
import {
  AiActTimeline,
  EuNativeGrid,
  EvidenceChainPreview,
  FrameworkStrip,
  LifecycleGrid,
} from '../components/landing/v2/LandingV2Sections';
import { PricingV2 } from '../components/landing/v2/PricingV2';
import { FinalCta, LandingFaq, LandingV2Footer } from '../components/landing/v2/LandingV2Footer';
import '../styles/landing-v2.css';

/**
 * Landing v2 — „AI Compliance Operations OS for Europe“ (Claude-Design-Handoff,
 * `design_handoff_landing_v2/README.md`).
 *
 * Sektionsreihenfolge laut Handoff: Hero · Framework-Leiste · EU AI Act ·
 * Lifecycle · Evidence Vault · EU-native · Preise · FAQ · CTA · Footer.
 * Flows sind Routen der bestehenden Runtime (`/audit`, `/checkout/:planKey`,
 * `/contact-sales`, `/login`, `/demo-tour`) — keine zweite Checkout-Logik.
 * Hell/Dunkel nutzt den vorhandenen Landing-Mode-Speicher (`rsd-landing-mode`).
 */
export function LandingV2() {
  const { mode, setMode } = useLandingMode();
  const theme: Lv2Theme = mode === 'light' ? 'light' : 'dark';
  const setTheme = useCallback(
    (next: Lv2Theme) => setMode(next === 'light' ? 'light' : 'gold'),
    [setMode],
  );

  return (
    <div className="lv2" data-lv2-theme={theme} data-landing-mode={mode}>
      <SEOHead />
      <LandingV2Header theme={theme} onThemeChange={setTheme} />
      <main>
        <HeroV2 />
        <FrameworkStrip />
        <AiActTimeline />
        <LifecycleGrid />
        <EvidenceChainPreview />
        <EuNativeGrid />
        <PricingV2 />
        <LandingFaq />
        <FinalCta />
      </main>
      <LandingV2Footer />
    </div>
  );
}
