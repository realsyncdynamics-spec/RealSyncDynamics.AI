import { createFileRoute } from "@tanstack/react-router";
import { EdgeArchitecture } from "@/components/architecture/edge-architecture";
import { IndustrialFlow } from "@/components/architecture/industrial-flow";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";

export const Route = createFileRoute("/edge")({
  component: EdgePage,
  head: () => ({
    meta: [{ title: "Edge Runtime — RealSync Runtime" }],
  }),
});

function EdgePage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Edge"
        title="Intelligenz dort, wo sie zählt."
        copy="Lokale Policy, lokale Entscheidung, gepufferter Sync, zentrale Governance. Keine Zertifizierung für sicherheitskritische Steuerung."
        image="/images/edge-floor.jpg"
      />
      <EdgeArchitecture />
      <IndustrialFlow />
      <CtaBanner />
    </main>
  );
}
