import { createFileRoute, notFound } from "@tanstack/react-router";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";
import { RuntimeDiagram } from "@/components/runtime/runtime-diagram";
import { UseCaseGrid } from "@/components/use-cases/use-case-grid";
import { industries } from "@/data/content";

export const Route = createFileRoute("/industries/$slug")({
  component: IndustryPage,
  loader: ({ params }) => {
    const item = industries.find((i) => i.slug === params.slug);
    if (!item) throw notFound();
    return item;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Branche"} — RealSync Runtime` }],
  }),
});

function IndustryPage() {
  const item = Route.useLoaderData();
  return (
    <main id="main">
      <PageHero
        eyebrow="Branche"
        title={item.title}
        copy={item.copy}
        image="/images/domain-industrial.jpg"
      />
      <section className="px-5 py-16 md:px-8 lg:px-12">
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted">
          {item.title} läuft auf derselben Steuerschleife wie jede andere Domäne: beobachten,
          verstehen, bewerten, entscheiden, freigeben, handeln, prüfen, nachweisen, lernen.
          Sektorspezifische Packs docken Policy und Konnektoren an. Sie ersetzen die Runtime nicht.
        </p>
      </section>
      <RuntimeDiagram />
      <UseCaseGrid />
      <CtaBanner />
    </main>
  );
}
