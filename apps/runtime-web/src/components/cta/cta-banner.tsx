import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";

export function CtaBanner() {
  return (
    <section className="relative isolate overflow-hidden">
      <img
        src="/images/cta-command.jpg"
        alt="Leitstand mit Blick auf industrielle Infrastruktur"
        width={2128}
        height={912}
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-bg/75" />
      <div className="relative mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32 lg:px-12">
        <h2 className="max-w-xl text-3xl font-medium tracking-[-0.03em] text-fg md:text-5xl">
          Bringen Sie Ihre Systeme unter eine gesteuerte Runtime.
        </h2>
        <p className="mt-4 max-w-lg text-base text-muted">
          RealSync Runtime ist das Produkt. RealSync Dynamics AI ist das Unternehmen. Fordern Sie ein
          Angebot oder ein Architektur-Review an.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <AppLink to="/pricing">Pakete und Preise</AppLink>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <AppLink to="/demo">Architektur-Review anfragen</AppLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
