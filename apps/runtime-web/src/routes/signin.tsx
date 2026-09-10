import { createFileRoute } from "@tanstack/react-router";
import { DemoForm } from "@/components/forms/demo-form";
import { PageHero } from "@/components/layout/page-hero";
import { AppLink } from "@/components/ui/app-link";

export const Route = createFileRoute("/signin")({
  component: SignInPage,
  head: () => ({
    meta: [{ title: "Anmelden — RealSync Runtime" }],
  }),
});

function SignInPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Mandantenzugang"
        title="An der Runtime anmelden"
        copy="Enterprise-SSO wird je Mandant bereitgestellt. Diese Vorschau legt keine Konten an."
        image="/images/console.jpg"
      />
      <section className="px-5 py-16 md:px-8 lg:px-12">
        <div className="mx-auto max-w-md">
          <DemoForm intent="signin" />
          <p className="mt-6 text-center text-sm text-muted">
            Noch kein Mandant?{" "}
            <AppLink to="/demo" className="text-fg">
              Angebot anfragen
            </AppLink>
          </p>
        </div>
      </section>
    </main>
  );
}
