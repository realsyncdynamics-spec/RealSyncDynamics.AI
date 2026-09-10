import { createFileRoute } from "@tanstack/react-router";
import { CtaBanner } from "@/components/cta/cta-banner";
import { IndustryGrid } from "@/components/industries/industry-grid";
import { PageHero } from "@/components/layout/page-hero";
import { RuntimeDiagram } from "@/components/runtime/runtime-diagram";

export const Route = createFileRoute("/industries/")({
  component: IndustriesPage,
  head: () => ({
    meta: [{ title: "Branchen — RealSync Runtime" }],
  }),
});

function IndustriesPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Branchen"
        title="Eine Architektur. Jeder Sektor."
        copy="Jede Branchenseite nutzt dieselbe RealSync Runtime. Wir forken das Produkt nicht je Vertikale."
        image="/images/cta-command.jpg"
      />
      <IndustryGrid />
      <RuntimeDiagram />
      <CtaBanner />
    </main>
  );
}
