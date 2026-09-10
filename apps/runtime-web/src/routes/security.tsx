import { createFileRoute } from "@tanstack/react-router";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";
import { SecuritySection } from "@/components/sections/security-section";

export const Route = createFileRoute("/security")({
  component: SecurityPage,
  head: () => ({
    meta: [{ title: "Sicherheit — RealSync Runtime" }],
  }),
});

function SecurityPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Sicherheit"
        title="Mandantentrennung, Nachweisintegrität, menschliche Gates."
        copy="Die Control Plane ist selbst ein gesteuertes System. Unbelegbare Compliance-Siegel zeigen wir nicht."
        image="/images/infra.jpg"
      />
      <SecuritySection />
      <CtaBanner />
    </main>
  );
}
