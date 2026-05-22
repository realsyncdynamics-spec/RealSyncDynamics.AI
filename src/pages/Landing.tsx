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
import { ResultsIn30SecondsSection } from '../components/sections/ResultsIn30SecondsSection';
import { RuntimeCanvasSection } from '../components/sections/RuntimeCanvasSection';
import { OutcomeBulletsSection } from '../components/sections/OutcomeBulletsSection';
import { PersonaCardsSection } from '../components/sections/PersonaCardsSection';
import { LiveScanCanvasSection } from '../components/sections/LiveScanCanvasSection';
import { GlobalRuntimeFeedSection } from '../components/sections/GlobalRuntimeFeedSection';
import { AiActSequenceSection } from '../components/sections/AiActSequenceSection';
import { GovernanceAgentsSection } from '../components/sections/GovernanceAgentsSection';
import { ComparisonTableSection } from '../components/sections/ComparisonTableSection';
import { GovernanceTrustSection } from '../components/sections/GovernanceTrustSection';
import { TrustCertificationsSection } from '../components/sections/TrustCertificationsSection';
import { RuntimeActivationSection } from '../components/sections/RuntimeActivationSection';
import { LandingFaqSection } from '../components/sections/LandingFaqSection';
import { BrandMarkSection } from '../components/sections/BrandMarkSection';

export function Landing() {
  return (
    <>
      <Navbar />
      <HeroSection />
      {/* Conversion-Hardening: Direkt unter dem Hero zeigen, was Visitor in
          den ersten 30 Sekunden bekommen — bevor die technische Tiefe kommt. */}
      <ResultsIn30SecondsSection />
      {/* Phase 2 (Hostinger-Pattern): Runtime-Canvas — SVG-Governance-Graph
          + scrollendes Terminal-Feed. Demo-Daten, klar markiert. */}
      <RuntimeCanvasSection />
      <OutcomeBulletsSection />
      <PersonaCardsSection />
      <LiveScanCanvasSection />
      <GlobalRuntimeFeedSection />
      <AiActSequenceSection />
      <GovernanceAgentsSection />
      <ComparisonTableSection />
      {/* Vorsichtiger Trust-Block — keine Fake-Logos, nur technisch
          verifizierbare Eigenschaften. Steht VOR dem Hosting-/Zert-Block,
          damit Zielgruppen-Fit zuerst klar wird. */}
      <GovernanceTrustSection />
      <TrustCertificationsSection />
      <RuntimeActivationSection />
      <LandingFaqSection />
      <BrandMarkSection />
    </>
  );
}
