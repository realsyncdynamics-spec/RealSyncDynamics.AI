/**
 * Production landing `/` — Governance OS (Enterprise Control Plane).
 *
 * Kategorie: AI Governance OS, nicht EU-AI-Act-Software. Die Seite ist eine
 * geführte Produktdemonstration:
 * Hero → 01–07 System-Story → Signature Pipeline → Architektur (Agenten)
 * → Provider → Control Room (Beispiel) → Nutzen → Executive → Prinzipien
 * → Governance-Check → Plattform-Preise → Conversion → Footer.
 *
 * Palette und Tokens: `.ga-context.rs-handoff` in `index.css` (nur `/`),
 * Sektionsstile in `styles/governance-os-landing.css`. Kein Farbmodus-
 * Umschalter; die Titan-Referenz lebt unter `/design/titan`.
 */
import { type PointerEvent as ReactPointerEvent } from 'react';
import '../../styles/governance-landing-polish.css';
import '../../styles/governance-os-landing.css';
import { Link } from 'react-router-dom';
import { CTA } from '../../content/runtimeVocab';
import { ArrowRight } from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import { GovernanceOsHero } from '../../components/landing/GovernanceOsHero';
import { GovernanceFooter } from '../../components/landing/GovernanceFooter';
import { GovernanceSystemStory } from '../../components/landing/GovernanceSystemStory';
import { GovernancePipelineDemo } from '../../components/landing/GovernancePipelineDemo';
import { GovernanceControlRoom } from '../../components/landing/GovernanceControlRoom';
import { GovernanceSelfCheck } from '../../components/landing/GovernanceSelfCheck';
import {
  ArchitectureSection,
  ExecutiveSection,
  PrinciplesSection,
  ProvidersSection,
  ValueSection,
} from '../../components/landing/HomepageBriefSections';
import { GovernancePricingSection } from '../../components/landing/GovernancePricingSection';
import { GA_PILL_GHOST, GA_PILL_PRIMARY, GA_SANS } from '../../components/landing/governance-ai-theme';
import { HERO_SCAN_CTA_LABEL } from '../../components/governance-frontend/hero-content';
import { SEO_CONFIG } from '../../config/seo';
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
      className="rs-paper ga-context rs-handoff landing-context relative min-h-screen antialiased"
      data-hero-visual="europe-map-v2"
      style={{ backgroundColor: 'var(--ga-void)', color: 'var(--ga-text)' }}
      onPointerMove={trackCardSheen}
    >
      <SEOHead title={SEO_CONFIG['/'].title} description={SEO_CONFIG['/'].description} canonical="/" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <GovernanceOsHero />
        <GovernanceSystemStory />
        <GovernancePipelineDemo />
        <ArchitectureSection />
        <ProvidersSection />
        <GovernanceControlRoom />
        <ValueSection />
        <ExecutiveSection />
        <PrinciplesSection />
        <GovernanceSelfCheck />
        <GovernancePricingSection />

        <section id="next" className="os-section" aria-labelledby="next-heading">
          <div className="os-inner text-center">
            <h2 id="next-heading" className="os-display" style={{ fontSize: 'clamp(36px, 5vw, 84px)' }}>
              <span>Ihre KI-Landschaft wächst.</span>
              <span className="os-dim">Ihre Governance sollte mithalten.</span>
            </h2>
            <p className="os-lede" style={{ marginInline: 'auto' }}>
              Machen Sie sichtbar, welche KI eingesetzt wird, welche Regeln gelten und welche Aktionen tatsächlich
              ausgeführt wurden.
            </p>
            <div className="mt-[40px] flex flex-wrap justify-center gap-3.5">
              <Link
                to={PUBLIC_CTA.to}
                className={`${GA_PILL_PRIMARY} ga-pill-sheen`}
                style={{
                  fontFamily: GA_SANS,
                  backgroundImage: 'var(--ga-pill-face)',
                  color: 'var(--ga-pill-ink)',
                  boxShadow: 'var(--ga-pill-shadow)',
                }}
              >
                {HERO_SCAN_CTA_LABEL}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/contact-sales?tier=enterprise&source=home-cta" className={GA_PILL_GHOST} style={{ fontFamily: GA_SANS }}>
                {CTA.enterprise}
              </Link>
            </div>
          </div>
        </section>

        <GovernanceFooter />
      </div>
    </div>
  );
}
