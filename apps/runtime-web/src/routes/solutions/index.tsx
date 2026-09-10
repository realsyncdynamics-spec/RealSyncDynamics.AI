import { createFileRoute } from "@tanstack/react-router";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";
import { DomainCards } from "@/components/solutions/domain-cards";

export const Route = createFileRoute("/solutions/")({
  component: SolutionsPage,
  head: () => ({
    meta: [{ title: "Lösungen — RealSync Runtime" }],
  }),
});

function SolutionsPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Lösungen"
        title="Eine Runtime. Drei Welten."
        copy="KI, Software und industrielle Operationen sind Domänenanwendungen derselben Control Plane."
        image="/images/hero.jpg"
      />
      <DomainCards />
      <CtaBanner />
    </main>
  );
}
