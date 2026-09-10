import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/layout/section";
import { packPrices, pricingTiers } from "@/data/pricing";
import { cn } from "@/lib/utils";

export function PricingSection() {
  return (
    <section id="pricing" className="px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Produktverkauf</Eyebrow>
        <h2 className="max-w-xl text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
          RealSync Runtime kaufen.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Das Unternehmen heißt RealSync Dynamics AI. Dieses Produkt heißt RealSync Runtime — die
          Governance- und Control-Runtime im Ökosystem. Richtpreise, Angebot nach Review.
        </p>
        <ul className="mt-10 grid gap-4 lg:grid-cols-3">
          {pricingTiers.map((t) => (
            <li
              key={t.id}
              className={cn(
                "flex flex-col rounded-xl bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]",
                t.featured && "shadow-[0_0_0_1px_rgba(62,200,224,0.45)]",
              )}
            >
              {t.featured ? (
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                  Empfohlen
                </p>
              ) : (
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
                  Paket
                </p>
              )}
              <h3 className="text-xl font-medium text-fg">{t.name}</h3>
              <p className="mt-3 font-mono text-2xl tabular-nums text-fg">
                {t.price}
                <span className="ml-1 text-sm text-muted">{t.period}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t.pitch}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-fg/90">
                {t.features.map((f) => (
                  <li key={f} className="border-t border-border pt-2 first:border-0 first:pt-0">
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-subtle">{t.note}</p>
              <Button className="mt-5 w-full" variant={t.featured ? "primary" : "outline"} asChild>
                <AppLink to="/demo">{t.cta}</AppLink>
              </Button>
            </li>
          ))}
        </ul>

        <h3 className="mt-16 text-lg font-medium text-fg">Domain Packs als Erweiterungen</h3>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {packPrices.map((p) => (
            <li key={p.id}>
              <AppLink
                to={p.href}
                className="block rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
              >
                <p className="text-sm text-fg">{p.name}</p>
                <p className="mt-1 font-mono text-xs text-accent">{p.price}</p>
              </AppLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
