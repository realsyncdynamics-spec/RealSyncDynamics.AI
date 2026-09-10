import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/layout/section";
import { AppLink } from "@/components/ui/app-link";
import { domains } from "@/data/content";

export function DomainCards() {
  return (
    <section id="domains" className="border-y border-border bg-panel px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Drei Domänen</Eyebrow>
        <h2 className="max-w-xl text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
          Eine Runtime. Drei Welten.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          KI, Software und industrielle Operationen sind Domänenanwendungen derselben Control Plane —
          nicht drei Produkte.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {domains.map((d) => (
            <article
              key={d.slug}
              className="group flex flex-col overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
            >
              <div className="relative aspect-16/10 overflow-hidden">
                <img
                  src={d.image}
                  alt=""
                  width={1792}
                  height={1008}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                <p className="absolute bottom-3 left-4 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                  {d.eyebrow}
                </p>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-xl font-medium text-fg">{d.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{d.statement}</p>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {d.capabilities.map((c) => (
                    <li
                      key={c}
                      className="rounded-sm px-2 py-0.5 text-[11px] text-muted shadow-[0_0_0_1px_rgba(238,234,226,0.1)]"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
                <AppLink to={d.cta.href} className="mt-6 inline-flex items-center gap-2 text-sm text-fg">
                  {d.cta.label}
                  <ArrowRight className="size-4" />
                </AppLink>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
