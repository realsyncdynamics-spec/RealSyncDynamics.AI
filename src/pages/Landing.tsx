/**
 * Landing — die runtime-narrative Startseite, jetzt in 10 Sektionen.
 *
 *   Hero · Outcomes · Personas · Live-Scan · Runtime-Feed · AI-Act-Sequenz
 *     · Governance-Agents · Vergleich · Trust · Runtime-Activation
 *
 * Sektions-Logik:
 *   01-02  Was sich konkret ändert + für wen        (Conversion-Hebel)
 *   03-04  Wie es technisch läuft                   (Vertrauen via Substanz)
 *   05     AI-Act-Sequenz                           (Annex-III narrativ entpackt)
 *   06     Governance-Agents (vier laufende)        (Personifizierte Runtime)
 *   07     Vergleichstabelle                        (Burggraben sichtbar)
 *   08     Trust + Hosting + Zertifikate            (transparente Lücken)
 *   09     Runtime-Activation (CTA-Endgame)         (Conversion)
 *
 * Alles darüber hinaus hat eine eigene Surface — /runtime, /ai-act,
 * /docs, /evidence, /pricing — die Homepage verkauft die Narrative.
 */

import { Navbar } from '../components/Navbar';
import { HeroSection } from '../components/sections/HeroSection';
import { RuntimeCanvasSection } from '../components/sections/RuntimeCanvasSection';
import { OutcomeBulletsSection } from '../components/sections/OutcomeBulletsSection';
import { PersonaCardsSection } from '../components/sections/PersonaCardsSection';
import { LiveScanCanvasSection } from '../components/sections/LiveScanCanvasSection';
import { GlobalRuntimeFeedSection } from '../components/sections/GlobalRuntimeFeedSection';
import { AiActSequenceSection } from '../components/sections/AiActSequenceSection';
import { GovernanceAgentsSection } from '../components/sections/GovernanceAgentsSection';
import { ComparisonTableSection } from '../components/sections/ComparisonTableSection';
import { TrustCertificationsSection } from '../components/sections/TrustCertificationsSection';
import { RuntimeActivationSection } from '../components/sections/RuntimeActivationSection';
import { BrandMarkSection } from '../components/sections/BrandMarkSection';

export function Landing() {
  return (
    <>
      <Navbar />
      <HeroSection />
      {/* Phase 2 (Hostinger-Pattern): Runtime-Canvas direkt nach der Hero —
          SVG-Governance-Graph + scrollendes Terminal-Feed. Demo-Daten. */}
      <RuntimeCanvasSection />
      <OutcomeBulletsSection />
      <PersonaCardsSection />
      <LiveScanCanvasSection />
      <GlobalRuntimeFeedSection />
      <AiActSequenceSection />
      <GovernanceAgentsSection />
      <ComparisonTableSection />
      <TrustCertificationsSection />
      <RuntimeActivationSection />
      <BrandMarkSection />
    </>
  );
}
