import { Link } from "@tanstack/react-router";
import { Eyebrow } from "@/components/layout/section";
import { industries } from "@/data/content";

export function IndustryGrid() {
  return (
    <section id="industries" className="px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Branchen</Eyebrow>
        <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
          Dieselbe Runtime. Jeder Sektor.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Branchenseiten nutzen dieselbe Governance-Architektur. Wir erfinden kein eigenes Produkt
          je Vertikale.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((ind) => (
            <li key={ind.slug}>
              <Link
                to="/industries/$slug"
                params={{ slug: ind.slug }}
                className="block h-full rounded-lg bg-surface p-5 shadow-[0_0_0_1px_rgba(238,234,226,0.08)] transition-[box-shadow] duration-150 hover:shadow-[0_0_0_1px_rgba(238,234,226,0.18)]"
              >
                <p className="text-sm font-medium text-fg">{ind.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{ind.copy}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
