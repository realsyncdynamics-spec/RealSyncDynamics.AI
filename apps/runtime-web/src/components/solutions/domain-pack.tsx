import { Eyebrow } from "@/components/layout/section";
import { domainPacks } from "@/data/content";
import { cn } from "@/lib/utils";

export function DomainPackOrbit() {
  return (
    <section id="packs" className="px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <Eyebrow>Domain Packs</Eyebrow>
          <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
            Einmal gebaut. Überall erweitert.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Packs sind konfigurierbare Erweiterungen derselben Runtime. Sie erzeugen keine zweite
            Produktarchitektur — und sind als Module käuflich.
          </p>
        </div>
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="mx-auto flex size-56 items-center justify-center rounded-full shadow-[0_0_0_1px_rgba(62,200,224,0.35),0_0_80px_-20px_rgba(62,200,224,0.55)]">
            <div className="flex size-40 flex-col items-center justify-center rounded-full bg-elevated text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Core</p>
              <p className="mt-1 text-sm font-medium text-fg">Runtime</p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {domainPacks.map((p, i) => (
              <li
                key={p.id}
                className={cn(
                  "rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]",
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <p className="text-sm font-medium text-fg">{p.name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.copy}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
