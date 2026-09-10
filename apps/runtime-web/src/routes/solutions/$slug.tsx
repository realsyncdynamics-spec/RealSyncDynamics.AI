import { createFileRoute, notFound } from "@tanstack/react-router";
import { ConnectorGrid } from "@/components/connectors/connector-grid";
import { CtaBanner } from "@/components/cta/cta-banner";
import { EvidenceTimeline } from "@/components/evidence/evidence-timeline";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { domains } from "@/data/content";

export const Route = createFileRoute("/solutions/$slug")({
  component: SolutionPage,
  loader: ({ params }) => {
    const domain = domains.find((d) => d.slug === params.slug);
    if (!domain) throw notFound();
    return domain;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Lösungen"} — RealSync Runtime` }],
  }),
});

function SolutionPage() {
  const domain = Route.useLoaderData();
  return (
    <main id="main">
      <PageHero
        eyebrow="Lösungen"
        title={domain.title}
        copy={domain.statement}
        image={domain.image}
      />
      <Section>
        <h2 className="text-2xl font-medium text-fg">Fähigkeiten</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {domain.capabilities.map((c) => (
            <li
              key={c}
              className="rounded-lg bg-surface px-4 py-4 text-sm text-fg shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
            >
              {c}
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
          Dieses Domain Pack erweitert dieselbe RealSync Runtime. Es führt keine zweite
          Produktarchitektur ein. Beobachten, bewerten, steuern, nachweisen — angewandt auf{" "}
          {domain.title}.
        </p>
      </Section>
      <EvidenceTimeline />
      <ConnectorGrid />
      <CtaBanner />
    </main>
  );
}
