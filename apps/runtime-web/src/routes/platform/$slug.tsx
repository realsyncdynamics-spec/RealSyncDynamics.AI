import { createFileRoute, notFound } from "@tanstack/react-router";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";
import { RuntimeDiagram } from "@/components/runtime/runtime-diagram";
import { controlLoop, runtimeLayers } from "@/data/runtime";

const extras = [
  {
    slug: "govern",
    title: "Steuern",
    summary: "Innerhalb autorisierter Kontrollgrenzen entscheiden.",
    detail:
      "Steuern ist die Decision Engine plus menschliche Gates. Policy-Version, Risiko-Snapshot und Akteur-Identität binden jedes Ergebnis, damit es rekonstruierbar bleibt.",
  },
  {
    slug: "enforce",
    title: "Durchsetzen",
    summary: "Nur freigegebene Aktionen ausführen.",
    detail:
      "Durchsetzen ist die Control Engine. Aktionen verlassen dieselbe Ebene, die sie bewertet hat. Automation ist begrenzt; die Runtime beansprucht keine sicherheitskritische Anlagensteuerung.",
  },
  {
    slug: "optimize",
    title: "Optimieren",
    summary: "Aus Ergebnissen lernen, ohne Policy-Drift.",
    detail:
      "Optimierung speist den nächsten Beobachtungszyklus. Policy-Änderung bleibt ein gesteuerter Akt — nie ein implizites Modell-Update.",
  },
];

const layers = [
  ...runtimeLayers.map((l) => ({
    slug: l.id,
    title: l.label,
    summary: l.summary,
    detail: l.detail,
  })),
  ...controlLoop.map((s) => ({
    slug: s.id,
    title: s.label,
    summary: s.copy,
    detail: `${s.copy} Diese Stufe gehört zum Control Loop von RealSync Runtime: beobachten → Nachweis → lernen.`,
  })),
  ...extras,
];

export const Route = createFileRoute("/platform/$slug")({
  component: PlatformLayer,
  loader: ({ params }) => {
    const item = layers.find((l) => l.slug === params.slug);
    if (!item) throw notFound();
    return item;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Plattform"} — RealSync Runtime` }],
  }),
});

function PlatformLayer() {
  const item = Route.useLoaderData();
  return (
    <main id="main">
      <PageHero
        eyebrow="Governance Runtime"
        title={item.title}
        copy={item.summary}
        image="/images/infra.jpg"
      />
      <section className="px-5 py-16 md:px-8 lg:px-12">
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted">{item.detail}</p>
      </section>
      <RuntimeDiagram />
      <CtaBanner />
    </main>
  );
}
