import { createFileRoute } from "@tanstack/react-router";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";
import { ComplianceSection } from "@/components/sections/compliance-section";

export const Route = createFileRoute("/compliance")({
  component: CompliancePage,
  head: () => ({
    meta: [{ title: "Compliance — RealSync Runtime" }],
  }),
});

function CompliancePage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Compliance"
        title="Regeln werden maschinenlesbare Controls."
        copy="KI-Verordnung, DSGVO, ISO-42001-Abbildungen und interne Policy kompilieren in denselben Auswertungspfad. Keine rechtliche Zertifizierung wird behauptet."
        image="/images/console.jpg"
      />
      <ComplianceSection />
      <CtaBanner />
    </main>
  );
}
