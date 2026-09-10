import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHero } from "@/components/layout/page-hero";
import { Section } from "@/components/layout/section";

const pages: Record<string, { title: string; body: string[] }> = {
  privacy: {
    title: "Datenschutz",
    body: [
      "Diese Marketing-Vorschau läuft in Ihrem Browser. Formulare zur Angebotsanfrage werden in localStorage auf diesem Gerät gespeichert und in dieser Umgebung nicht an ein RealSync-Backend übertragen.",
      "Ein produktiver Einsatz von RealSync Runtime verarbeitet Mandantenereignisse vertraglich, mit Zweckbindung und Tenant-Isolation, wie auf der Sicherheitsseite beschrieben.",
      "Es werden keine Tracking-Pixel oder Werbe-IDs Dritter auf dieser Site genutzt, über den Plattform-Host hinaus.",
    ],
  },
  imprint: {
    title: "Impressum",
    body: [
      "RealSync Dynamics AI — Unternehmen. RealSync Runtime — Produkt (Governance- und Control-Runtime).",
      "Domain: realsyncdynamicsai.de",
      "Diese Vorschau ist ein architektonisches Frontend. Handelsregisterangaben stehen auf der Produktivdomain nach Eintragung.",
    ],
  },
};

export const Route = createFileRoute("/legal/$slug")({
  component: LegalPage,
  loader: ({ params }) => {
    const page = pages[params.slug];
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Rechtliches"} — RealSync Runtime` }],
  }),
});

function LegalPage() {
  const page = Route.useLoaderData();
  return (
    <main id="main">
      <PageHero eyebrow="Rechtliches" title={page.title} copy="Klartext-Hinweise für diese Vorschau." />
      <Section>
        <div className="max-w-2xl space-y-4 text-sm leading-relaxed text-muted">
          {page.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Section>
    </main>
  );
}
