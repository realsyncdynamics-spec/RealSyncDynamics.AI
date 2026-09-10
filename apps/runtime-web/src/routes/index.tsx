import { createFileRoute } from "@tanstack/react-router";
import { IndustrialFlow } from "@/components/architecture/industrial-flow";
import { EdgeArchitecture } from "@/components/architecture/edge-architecture";
import { ConnectorGrid } from "@/components/connectors/connector-grid";
import { CopilotPanel } from "@/components/copilot/copilot-panel";
import { CtaBanner } from "@/components/cta/cta-banner";
import { DashboardPreview } from "@/components/dashboard/dashboard-preview";
import { EvidenceTimeline } from "@/components/evidence/evidence-timeline";
import { Hero } from "@/components/hero/hero";
import { IndustryGrid } from "@/components/industries/industry-grid";
import { PricingSection } from "@/components/pricing/pricing-section";
import { RiskPanel } from "@/components/risk/risk-panel";
import { ControlLoop } from "@/components/runtime/control-loop";
import { LiveSimulation } from "@/components/runtime/live-simulation";
import { RuntimeDiagram } from "@/components/runtime/runtime-diagram";
import { ComplianceSection } from "@/components/sections/compliance-section";
import { SecuritySection } from "@/components/sections/security-section";
import { DomainCards } from "@/components/solutions/domain-cards";
import { DomainPackOrbit } from "@/components/solutions/domain-pack";
import { UseCaseGrid } from "@/components/use-cases/use-case-grid";
import { brand } from "@/data/site";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "RealSync Runtime — Governance- und Control-Runtime" },
      { name: "description", content: brand.subheadline },
    ],
  }),
});

function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: brand.product,
    brand: { "@type": "Brand", name: brand.company },
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "de",
    url: `https://${brand.domain}`,
    description: brand.tagline,
    offers: { "@type": "Offer", availability: "https://schema.org/OnlineOnly", priceCurrency: "EUR" },
  };

  return (
    <main id="main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero />
      <RuntimeDiagram />
      <ControlLoop />
      <LiveSimulation />
      <DomainCards />
      <IndustrialFlow />
      <DomainPackOrbit />
      <PricingSection />
      <ConnectorGrid />
      <EdgeArchitecture />
      <EvidenceTimeline />
      <RiskPanel />
      <CopilotPanel />
      <SecuritySection />
      <ComplianceSection />
      <DashboardPreview />
      <IndustryGrid />
      <UseCaseGrid />
      <CtaBanner />
    </main>
  );
}
