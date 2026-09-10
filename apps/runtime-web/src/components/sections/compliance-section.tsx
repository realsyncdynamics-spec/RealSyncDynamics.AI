import { Eyebrow } from "@/components/layout/section";
import { AppLink } from "@/components/ui/app-link";
import { complianceItems } from "@/data/content";

export function ComplianceSection() {
  return (
    <section id="compliance" className="px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Compliance</Eyebrow>
        <h2 className="max-w-xl text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
          Compliance wird ein ausführbares System.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Regeln werden maschinenlesbare Controls statt statischer Dokumente. Compliance ist eine
          Fähigkeit der Runtime — nicht das Produkt selbst. Keine rechtliche Zertifizierung wird
          behauptet.
        </p>
        <ul className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {complianceItems.map((c) => (
            <li
              key={c.name}
              className="rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
            >
              <p className="text-sm font-medium text-fg">{c.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.copy}</p>
            </li>
          ))}
        </ul>
        <AppLink to="/compliance" className="mt-8 inline-block text-sm text-fg">
          Wie Controls auf Pflichten abgebildet werden →
        </AppLink>
      </div>
    </section>
  );
}
