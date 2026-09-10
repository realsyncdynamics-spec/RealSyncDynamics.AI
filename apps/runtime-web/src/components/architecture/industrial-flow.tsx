import { Eyebrow } from "@/components/layout/section";
import { industrialFlow } from "@/data/content";

export function IndustrialFlow() {
  return (
    <section id="industrial" className="relative overflow-hidden px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <img
        src="/images/domain-industrial.jpg"
        alt=""
        width={1792}
        height={1008}
        loading="lazy"
        className="absolute inset-0 size-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/92 to-bg/80" />
      <div className="relative mx-auto max-w-6xl">
        <Eyebrow>Industrieller Maßstab</Eyebrow>
        <h2 className="max-w-xl text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
          Von KI-Governance zu Industrial Intelligence
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Dieselbe Runtime kann digitale Systeme und physische Operationen steuern. Architektur und
          Fähigkeit — kein Anspruch auf sicherheitskritische Anlagensteuerung.
        </p>
        <ol className="mt-10 grid gap-2 md:grid-cols-5">
          {industrialFlow.map((step, i) => (
            <li
              key={step.id}
              className="relative rounded-lg bg-surface/80 p-4 shadow-[0_0_0_1px_rgba(238,234,226,0.08)] backdrop-blur-sm"
            >
              <p className="font-mono text-[10px] text-accent">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-3 text-sm leading-snug text-fg">{step.label}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-subtle">
          Photorealistische Bilder stehen für industrielle Umgebungen (Glas- und Faserproduktion) und
          zeigen keine benannte Kundenanlage. RealSync Runtime beansprucht derzeit keine zertifizierte
          Steuerung industrieller Maschinen.
        </p>
      </div>
    </section>
  );
}
