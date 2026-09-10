import { Eyebrow } from "@/components/layout/section";
import { AppLink } from "@/components/ui/app-link";
import { securityTopics } from "@/data/content";

export function SecuritySection() {
  return (
    <section id="security" className="border-y border-border bg-panel px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Unternehmenssicherheit</Eyebrow>
        <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
          Sicherheit der Control Plane, keine Badge-Wand.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Isolation, Identität, Nachweisintegrität und menschliche Gates. Wir zeigen keine unbelegbaren
          SOC-2-, ISO- oder DSGVO-Siegel.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {securityTopics.map((t) => (
            <li
              key={t.title}
              className="rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
            >
              <p className="text-sm font-medium text-fg">{t.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t.copy}</p>
            </li>
          ))}
        </ul>
        <AppLink to="/security" className="mt-8 inline-block text-sm text-fg">
          Sicherheitsmodell lesen →
        </AppLink>
      </div>
    </section>
  );
}
