import { createFileRoute } from "@tanstack/react-router";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { resources } from "@/data/content";

export const Route = createFileRoute("/resources")({
  component: ResourcesPage,
  head: () => ({
    meta: [{ title: "Ressourcen — RealSync Runtime" }],
  }),
});

function ResourcesPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Ressourcen"
        title="Architektur, kein Content-Marketing."
        copy="Kurze Briefings zur Runtime, zur Steuerschleife und dazu, wie industrielle und KI-Governance eine Ebene teilen."
        image="/images/console.jpg"
      />
      <Section>
        <ul className="grid gap-4 md:grid-cols-2">
          {resources.map((r) => (
            <li
              key={r.title}
              className="rounded-xl bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
            >
              <Badge>{r.kind}</Badge>
              <h2 className="mt-3 text-xl font-medium text-fg">{r.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{r.copy}</p>
            </li>
          ))}
        </ul>
      </Section>
      <CtaBanner />
    </main>
  );
}
