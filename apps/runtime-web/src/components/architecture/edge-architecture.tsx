import { Eyebrow } from "@/components/layout/section";
import { edgeFlow } from "@/data/content";

export function EdgeArchitecture() {
  return (
    <section id="edge" className="border-y border-border bg-panel px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
        <div>
          <Eyebrow>Edge Runtime</Eyebrow>
          <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
            Intelligenz dort, wo sie zählt.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Für latenzsensible und industrielle Umgebungen kann RealSync Runtime die Verarbeitung nah
            am Quellsystem platzieren. Lokale Policy, lokale Entscheidung, gepufferter Sync, zentrale
            Governance.
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-2 text-sm text-muted">
            {[
              "Resilienz",
              "Lokale Verarbeitung",
              "Geringere Latenz",
              "Offline-Puffer",
              "Kontrollierte Synchronisation",
              "Zentrale Governance",
            ].map((t) => (
              <li key={t} className="rounded-md bg-elevated px-3 py-2 text-fg/90">
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-subtle">
            RealSync Runtime beansprucht keine Zertifizierung für sicherheitskritische Steuerung.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
          <img
            src="/images/edge-floor.jpg"
            alt="Edge-Rechnerschrank auf einem Industriehallenboden"
            width={1792}
            height={1008}
            loading="lazy"
            className="aspect-16/10 w-full object-cover"
          />
          <ol className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
            {edgeFlow.map((s, i) => (
              <li key={s.id} className="bg-surface px-4 py-4">
                <p className="font-mono text-[10px] text-accent">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-1 text-sm text-fg">{s.label}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
