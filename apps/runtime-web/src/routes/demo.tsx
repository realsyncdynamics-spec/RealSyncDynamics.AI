import { createFileRoute } from "@tanstack/react-router";
import { DemoForm } from "@/components/forms/demo-form";
import { PageHero } from "@/components/layout/page-hero";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
  head: () => ({
    meta: [{ title: "Angebot anfragen — RealSync Runtime" }],
  }),
});

function DemoPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Enterprise"
        title="Architektur-Review anfragen"
        copy="Sagen Sie uns, welche Systeme unter Governance stehen sollen. Wir legen KI, Software und industrielle Bestände auf RealSync Runtime."
        image="/images/cta-command.jpg"
      />
      <section className="px-5 py-16 md:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <DemoForm />
          <div className="text-sm leading-relaxed text-muted">
            <p>
              Ein Architektur-Review umfasst Ereignisquellen, Policy-Scope, Risikodimensionen,
              menschliche Gates und Nachweis-Export. Es ist keine Produkttour eines Chatbots.
            </p>
            <p className="mt-4">Typische Teilnehmende: CISO, Head of AI, OT/IT-Betrieb, Compliance.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
