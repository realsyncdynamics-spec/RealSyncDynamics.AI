import { ArrowRight } from "lucide-react";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { brand } from "@/data/site";

const nodes = ["KI", "AGENTEN", "SOFTWARE", "INDUSTRIE", "DATEN", "MASCHINEN"];

export function Hero() {
  return (
    <section className="relative isolate min-h-[92dvh] overflow-hidden">
      <img
        src="/images/hero.jpg"
        alt="Leitstand, der industrielle Fertigung, Server und KI-Infrastruktur verbindet"
        width={1792}
        height={1008}
        className="absolute inset-0 size-full object-cover"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/55 via-bg/70 to-bg" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#08090b_78%)]" />

      <div className="relative mx-auto flex min-h-[92dvh] max-w-6xl flex-col justify-end px-5 pb-16 pt-28 md:px-8 md:pb-20 lg:px-12">
        <div className="stagger-in max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
            {brand.productOf}
          </p>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted md:text-base">
            {brand.problem}
          </p>
          <h1 className="mt-4 whitespace-pre-line text-4xl font-medium leading-[1.05] tracking-[-0.04em] text-fg sm:text-5xl md:text-6xl lg:text-[4.4rem]">
            {brand.headline}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
            {brand.subheadline}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <AppLink to="/platform">
                {brand.ctaPrimary}
                <ArrowRight className="size-4" />
              </AppLink>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <AppLink to="/pricing">{brand.ctaSecondary}</AppLink>
            </Button>
          </div>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.22em] text-subtle">
            {brand.trust.join("  ·  ")}
          </p>
        </div>

        <div className="mt-14 hidden items-center gap-6 md:flex" aria-hidden="true">
          <div className="relative flex size-28 shrink-0 items-center justify-center rounded-full shadow-[0_0_0_1px_rgba(62,200,224,0.35),0_0_40px_-10px_rgba(62,200,224,0.5)]">
            <span className="absolute inset-2 rounded-full border border-accent/20" />
            <span className="px-2 text-center font-mono text-[9px] uppercase leading-tight tracking-[0.16em] text-accent">
              RealSync
              <br />
              Runtime
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {nodes.map((n) => (
              <span
                key={n}
                className="rounded-sm px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted shadow-[0_0_0_1px_rgba(238,234,226,0.12)]"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
