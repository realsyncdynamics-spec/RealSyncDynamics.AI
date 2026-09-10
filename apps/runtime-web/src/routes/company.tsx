import { createFileRoute } from "@tanstack/react-router";
import { CtaBanner } from "@/components/cta/cta-banner";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { company } from "@/data/content";

export const Route = createFileRoute("/company")({
  component: CompanyPage,
  head: () => ({
    meta: [{ title: "Unternehmen — RealSync Dynamics AI" }],
  }),
});

function CompanyPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Unternehmen"
        title="RealSync Dynamics AI ist das Ökosystem. Runtime ist das Produkt."
        copy={company.statement}
        image="/images/cta-command.jpg"
      />
      <Section>
        <div className="mb-10 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">Unternehmen</p>
            <h2 className="mt-2 text-xl font-medium text-fg">RealSync Dynamics AI</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Die Firma. Marke, Vertragspartner, Ökosystem. Hier entstehen weitere Produkte — Voice,
              Governance OS, Connectoren — ohne die Runtime zu ersetzen.
            </p>
          </article>
          <article className="rounded-xl bg-surface p-6 shadow-[0_0_0_1px_rgba(62,200,224,0.35)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Produkt</p>
            <h2 className="mt-2 text-xl font-medium text-fg">RealSync Runtime</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Die Governance- und Control-Runtime, die Sie hier sehen. Verkauft in Core, Domain Packs
              und Enterprise.
            </p>
            <Button className="mt-5" asChild>
              <AppLink to="/pricing">Pakete ansehen</AppLink>
            </Button>
          </article>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {company.principles.map((p) => (
            <li
              key={p.title}
              className="rounded-xl bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
            >
              <h2 className="text-lg font-medium text-fg">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.copy}</p>
            </li>
          ))}
        </ul>
      </Section>
      <CtaBanner />
    </main>
  );
}
