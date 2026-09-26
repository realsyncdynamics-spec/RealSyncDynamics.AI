/**
 * Production landing `/` — Europe screenshot hero on the Governance OS landing.
 * Structure: Hero (Europa-Karte, Cyan) → Ticker → Problem → Module → Evidence Flow
 * → EU-Trust → Audiences → Preise → CTA → Footer.
 *
 * Ein zweifarbiger Hell/Dunkel-Umschalter ändert ausschließlich die Farb- und
 * Bildtönung; `.rs-handoff` mappt die `--ga-*`-Tokens der Folgesektionen.
 * Die ältere Titan-Referenz bleibt unter `/design/titan` erreichbar.
 */
import { type PointerEvent as ReactPointerEvent } from 'react';
import '../../styles/governance-landing-polish.css';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import { GovernanceOsHero } from '../../components/landing/GovernanceOsHero';
import { ReferenceModeSwitch, useReferenceMode } from '../../components/landing/ReferenceModeSwitch';
import { GovernanceFooter } from '../../components/landing/GovernanceFooter';
import { RegulatoryTicker } from '../../components/landing/RegulatoryTicker';
import { HomepageBriefSections } from '../../components/landing/HomepageBriefSections';
import { GovernancePricingSection } from '../../components/landing/GovernancePricingSection';
import { SectionEyebrow, SectionHeading } from '../../components/landing/GovernanceSectionChrome';
import {
  GA_SANS,
  GA_LINE_SOFT,
  GA_MUTED,
  GA_PILL_GHOST,
  GA_PILL_PRIMARY,
} from '../../components/landing/governance-ai-theme';
import {
  BRAND_VALUE_PROPOSITION,
  HERO_AUDIT_TRAIL_CTA_LABEL,
  HERO_SCAN_CTA_LABEL,
} from '../../components/governance-frontend/hero-content';
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
  const { mode, setMode } = useReferenceMode();
  return (
    <div
      className="ga-context ga-landing-modes rs-handoff landing-context relative min-h-screen antialiased"
      data-landing-mode={mode === 'light' ? 'light' : 'cyan'}
      data-hero-visual="europe-reference"
      style={{ backgroundColor: 'var(--ga-void)', color: 'var(--ga-text)' }}
      onPointerMove={trackCardSheen}
    >
      <SEOHead title={SEO_CONFIG['/'].title} description={SEO_CONFIG['/'].description} canonical="/" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <GovernanceOsHero modeSwitch={<ReferenceModeSwitch mode={mode} onChange={setMode} />} />
        <RegulatoryTicker />
        <HomepageBriefSections />
        <GovernancePricingSection />

        <section
          id="next"
          className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(60px,6vw,92px)]"
          style={{ borderColor: GA_LINE_SOFT }}
          aria-labelledby="next-heading"
        >
          <div className="mx-auto w-full max-w-[780px] text-center">
            <SectionEyebrow>STARTEN</SectionEyebrow>
            <span id="next-heading">
              <SectionHeading centered>Kontrollierbar. Nachweisbar. Auditbereit.</SectionHeading>
            </span>
            <p className="mx-auto mt-4 max-w-[46rem] text-pretty leading-[1.7]" style={{ color: GA_MUTED }}>
              {BRAND_VALUE_PROPOSITION}
            </p>
            <div className="mt-[34px] flex flex-wrap justify-center gap-3.5">
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
              <a href="#audit-trail" className={GA_PILL_GHOST} style={{ fontFamily: GA_SANS }}>
                {HERO_AUDIT_TRAIL_CTA_LABEL}
              </a>
            </div>
          </div>
        </section>

        <GovernanceFooter />
      </div>
    </div>
  );
}
