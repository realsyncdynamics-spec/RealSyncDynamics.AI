import type { ReactNode } from 'react';
import { SEOHead } from '../components/SEOHead';
import { LandingV4Header } from '../components/landing/v4/LandingV4Header';
import { HeroV4 } from '../components/landing/v4/HeroV4';
import {
  AiActTimeline,
  EuNativeGrid,
  EvidenceChainPreview,
  InfrastructureMirror,
  FrameworkStrip,
  LifecycleGrid,
} from '../components/landing/v2/LandingV2Sections';
import { PricingV2 } from '../components/landing/v2/PricingV2';
import { FinalCta, LandingFaq, LandingV2Footer } from '../components/landing/v2/LandingV2Footer';
import { GovernanceControlRoom } from '../components/landing/GovernanceControlRoom';
import { GovernanceSelfCheck } from '../components/landing/GovernanceSelfCheck';
import { ArchitectureSection } from '../components/landing/HomepageBriefSections';
import '../styles/governance-os-landing.css';
import '../styles/landing-v2.css';
import '../styles/landing-v4.css';

/**
 * Landing v4 — öffentliche Startseite `/` (Claude-Design „realsync-landing-v4“).
 *
 * Neu: Statusleiste, Header und Hero mit Erde. Die Inhaltssektionen darunter
 * sind dieselben Komponenten wie in v2 (Preise aus der Pricing-SSoT, FAQ =
 * JSON-LD-Quelle, Control Room & Governance-Check) — im v4-Farbraum über
 * `.lv4`-Tokens, keine Kopien. Nur Dunkel.
 */
function Embed({ children }: { children: ReactNode }) {
  return <div className="lv2-embed ga-context rs-handoff">{children}</div>;
}

export function LandingV4() {
  return (
    <div className="lv2 lv4" data-lv2-theme="dark">
      <SEOHead />
      <LandingV4Header />
      <main>
        <HeroV4 />
        <FrameworkStrip />
        <AiActTimeline />
        <LifecycleGrid />
        <Embed>
          <GovernanceControlRoom />
        </Embed>
        <EvidenceChainPreview />
        <EuNativeGrid />
        <InfrastructureMirror />
        <Embed>
          <ArchitectureSection />
          <GovernanceSelfCheck />
        </Embed>
        <PricingV2 />
        <LandingFaq />
        <FinalCta />
      </main>
      <LandingV2Footer />
    </div>
  );
}
