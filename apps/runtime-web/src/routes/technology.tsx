import { createFileRoute } from "@tanstack/react-router";
import { EdgeArchitecture } from "@/components/architecture/edge-architecture";
import { ConnectorGrid } from "@/components/connectors/connector-grid";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";
import { RuntimeDiagram } from "@/components/runtime/runtime-diagram";
import { engines } from "@/data/runtime";

export const Route = createFileRoute("/technology")({
  component: TechnologyPage,
  head: () => ({
    meta: [{ title: "Technologie — RealSync Runtime" }],
  }),
});

function TechnologyPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Technologie"
        title="Die Engines der Runtime"
        copy="Event, Policy, Risk, Decision, Control, Evidence und Automation — eine Architektur für KI, Software und industrielle Systeme."
        image="/images/infra.jpg"
      />
      <section className="px-5 py-16 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-2">
          {engines.map((e) => (
            <article
              key={e.id}
              id={e.id}
              className="rounded-lg bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{e.id}</p>
              <h2 className="mt-2 text-xl font-medium text-fg">{e.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{e.copy}</p>
            </article>
          ))}
        </div>
      </section>
      <RuntimeDiagram />
      <EdgeArchitecture />
      <section id="api" className="px-5 py-16 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <article className="rounded-lg bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
            <h2 className="text-xl font-medium text-fg">API</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Control-Plane-API für Ereignisse, Policy-Versionen, Entscheidungen und Nachweis-Export.
              Authentifiziert, gescopt, rate-limitiert. Vertrag wird mit dem Mandanten-Onboarding
              veröffentlicht.
            </p>
          </article>
          <article id="sdk" className="rounded-lg bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
            <h2 className="text-xl font-medium text-fg">SDK</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Governance in Dienste und Agent-Runtimes einbetten. Das SDK sendet Ereignisse und
              empfängt autorisierte Aktionen — es umgeht die Decision Engine nicht.
            </p>
          </article>
        </div>
      </section>
      <ConnectorGrid />
      <CtaBanner />
    </main>
  );
}
