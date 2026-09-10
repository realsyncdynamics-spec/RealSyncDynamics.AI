import { createFileRoute } from "@tanstack/react-router";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";
import { PricingSection } from "@/components/pricing/pricing-section";
import { DomainPackOrbit } from "@/components/solutions/domain-pack";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [{ title: "Pakete & Preise — RealSync Runtime" }],
  }),
});

function PricingPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Ein Produkt von RealSync Dynamics AI"
        title="RealSync Runtime erwerben"
        copy="Runtime Core, Domain Packs und Enterprise. Dieselbe Control Plane — modular verkauft, nicht als drei Produkte gebaut."
        image="/images/cta-command.jpg"
      />
      <PricingSection />
      <DomainPackOrbit />
      <CtaBanner />
    </main>
  );
}
