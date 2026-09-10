import { createFileRoute } from "@tanstack/react-router";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";
import { ControlLoop } from "@/components/runtime/control-loop";
import { RuntimeDiagram } from "@/components/runtime/runtime-diagram";
import { engines } from "@/data/runtime";

export const Route = createFileRoute("/platform/")({
  component: PlatformPage,
  head: () => ({
    meta: [{ title: "Plattform — RealSync Runtime" }],
  }),
});

function PlatformPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Produkt"
        title="Governance Runtime"
        copy="Systeme beobachten, Ereignisse gegen Policies auswerten, Risiko bewerten, gesteuerte Entscheidungen treffen, autorisierte Aktionen ausführen und nachprüfbare Nachweise erzeugen."
        image="/images/infra.jpg"
      />
      <RuntimeDiagram />
      <section className="px-5 pb-20 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-2 lg:grid-cols-3">
          {engines.map((e) => (
            <article
              key={e.id}
              id={e.id}
              className="rounded-lg bg-surface p-5 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{e.id}</p>
              <h2 className="mt-2 text-lg font-medium text-fg">{e.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{e.copy}</p>
            </article>
          ))}
        </div>
      </section>
      <ControlLoop />
      <CtaBanner />
    </main>
  );
}
