import { Eyebrow } from "@/components/layout/section";
import { useCases } from "@/data/content";

export function UseCaseGrid() {
  return (
    <section id="usecases" className="border-y border-border bg-panel px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Anwendungsfälle</Eyebrow>
        <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
          Was müssen Sie steuern?
        </h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((u) => (
            <li
              key={u.title}
              className="rounded-lg bg-surface p-5 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
            >
              <p className="text-sm font-medium text-fg">{u.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{u.copy}</p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
                Beobachten · Bewerten · Steuern · Nachweis
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
