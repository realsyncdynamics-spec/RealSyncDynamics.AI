import { createFileRoute } from "@tanstack/react-router";
import { ConnectorGrid } from "@/components/connectors/connector-grid";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";

export const Route = createFileRoute("/connectors")({
  component: ConnectorsPage,
  head: () => ({
    meta: [{ title: "Konnektoren — RealSync Runtime" }],
  }),
});

function ConnectorsPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Infrastruktur"
        title="Binden Sie die Systeme an, die Sie schon betreiben."
        copy="Verfügbar, in Kürze oder Custom. Eine native Integration behaupten wir nur, wo der Status „Verfügbar“ steht."
        image="/images/infra.jpg"
      />
      <ConnectorGrid />
      <CtaBanner />
    </main>
  );
}
