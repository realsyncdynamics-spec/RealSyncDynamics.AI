/**
 * Gold Europe landing, connected to the existing audit, auth and billing routes.
 */
import { type PointerEvent as ReactPointerEvent } from 'react';
import '../../styles/governance-landing-polish.css';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import { HeroTitanium } from '../../components/landing/HeroTitanium';
import { GovernanceStatusBar } from '../../components/landing/GovernanceStatusBar';
import { GovernanceLoopBand } from '../../components/landing/GovernanceLoopBand';
import { GovernanceFooter } from '../../components/landing/GovernanceFooter';
import { RegulatoryTicker } from '../../components/landing/RegulatoryTicker';
import { WorkspacePreviewSection } from '../../components/landing/WorkspacePreviewSection';
import { GovernanceToolsSection } from '../../components/landing/GovernanceToolsSection';
import { PlatformCapabilitiesSection } from '../../components/landing/PlatformCapabilitiesSection';
import { RuntimeLayersSection } from '../../components/landing/RuntimeLayersSection';
import { EvidenceTrustSection } from '../../components/landing/EvidenceTrustSection';
import { GovernancePricingSection } from '../../components/landing/GovernancePricingSection';
import { LandingRoadmapSection } from '../../components/landing/LandingRoadmapSection';
import { GovernanceEnterpriseSection } from '../../components/landing/GovernanceEnterpriseSection';
import { GovernanceAiHeader } from '../../components/landing/GovernanceAiHeader';
import { SectionEyebrow, SectionHeading } from '../../components/landing/GovernanceSectionChrome';
import {
  GA_DISPLAY,
  GA_LINE_SOFT,
  GA_MONO,
  GA_MUTED,
  GA_PILL_GHOST,
  GA_PILL_PRIMARY,
  GA_SILVER,
} from '../../components/landing/governance-ai-theme';
import { POLICY_PACKS } from '../../components/landing/policy-packs';
import { CONTINUOUS_COMPLIANCE_NARRATIVE } from '../../components/governance-frontend/hero-content';
import { CTA } from '../../content/runtimeVocab';
import { PUBLIC_CTA } from '../../config/public-nav';

function trackCardSheen(event: ReactPointerEvent<HTMLDivElement>) {
  const card = (event.target as HTMLElement).closest?.('.ga-card');
  if (!(card instanceof HTMLElement)) return;
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--ga-mx', `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
  card.style.setProperty('--ga-my', `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
}

export function DesignGovernanceAiLanding() {
  return (
    <div
      data-landing-mode="gold"
      className="ga-context ga-gold-reference relative min-h-screen antialiased"
      style={{ backgroundColor: 'var(--ga-void)', color: 'var(--ga-text)' }}
      onPointerMove={trackCardSheen}
    >
      <SEOHead
        title="RealSyncDynamics.AI — AI Compliance Operations OS for Europe"
        description="EU AI Act, DSGVO, ISO 42001 und interne Richtlinien in einer kontinuierlichen Governance-Schicht über KI-Systeme, Daten und Anbieter."
        canonical="/"
        ogTitle="AI Compliance Operations OS for Europe"
        ogDescription="RealSyncDynamics.AI verbindet Governance, Evidence und kontrollierte KI-Ausführung in einer EU-nativen Operations-Schicht."
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <GovernanceStatusBar />
        <GovernanceAiHeader />
        <HeroTitanium sectionId="overview" />
        <RegulatoryTicker />
        <GovernanceLoopBand />
        <WorkspacePreviewSection />
        <GovernanceToolsSection />
        <PlatformCapabilitiesSection />
        <RuntimeLayersSection />
        <EvidenceTrustSection />
        <GovernancePricingSection />
        <LandingRoadmapSection />
        <GovernanceEnterpriseSection />

        <section
          id="next"
          className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(60px,6vw,92px)]"
          style={{ borderColor: GA_LINE_SOFT }}
          aria-labelledby="next-heading"
        >
          <div className="mx-auto w-full max-w-[780px] text-center">
            <SectionEyebrow>ONE GOVERNANCE PLANE</SectionEyebrow>
            <span id="next-heading">
              <SectionHeading centered>Governance statt Checkliste.</SectionHeading>
            </span>
            <p className="mx-auto mt-4 max-w-[46rem] text-pretty leading-[1.7]" style={{ color: GA_MUTED }}>
              {CONTINUOUS_COMPLIANCE_NARRATIVE}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {POLICY_PACKS.map((pack) => (
                <span
                  key={pack.label}
                  className={`whitespace-nowrap rounded border px-3 py-[7px] text-[11px] tracking-[.14em] ${
                    pack.next ? 'border-dashed' : ''
                  }`}
                  style={{
                    fontFamily: GA_MONO,
                    borderColor: GA_LINE_SOFT,
                    color: pack.next ? 'var(--ga-titan)' : GA_SILVER,
                  }}
                >
                  {pack.label}
                </span>
              ))}
            </div>
            <div className="mt-[34px] flex flex-wrap justify-center gap-3.5">
              <Link
                to={PUBLIC_CTA.to}
                className={`${GA_PILL_PRIMARY} ga-pill-sheen`}
                style={{
                  fontFamily: GA_DISPLAY,
                  backgroundImage: 'var(--ga-pill-face)',
                  color: 'var(--ga-pill-ink)',
                  boxShadow: 'var(--ga-pill-shadow)',
                }}
              >
                {CTA.startFreeAudit}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#pricing" className={GA_PILL_GHOST} style={{ fontFamily: GA_DISPLAY }}>
                Preise ansehen
              </a>
            </div>
          </div>
        </section>

        <GovernanceFooter />
      </div>
    </div>
  );
}
