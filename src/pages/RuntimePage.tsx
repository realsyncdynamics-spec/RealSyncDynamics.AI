import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';
import {
  ArrowRight,
  Activity,
  ShieldCheck,
  Bot,
  ScrollText,
  FlaskConical,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CTA } from '../content/runtimeVocab';
import {
  RUNTIME_BENEFITS,
  RUNTIME_CONTROL_LOOP,
  RUNTIME_DOMAINS,
  RUNTIME_ENGINES,
  RUNTIME_PRODUCT,
  RUNTIME_SKU_DISCLAIMER,
  RUNTIME_SKUS,
  RUNTIME_SURFACES,
} from '../content/runtimeProduct';

const SURFACE_ICON = {
  cyan: <Activity className="h-4 w-4 text-cyan-300" />,
  amber: <ScrollText className="h-4 w-4 text-amber-300" />,
  violet: <Bot className="h-4 w-4 text-violet-300" />,
  emerald: <ShieldCheck className="h-4 w-4 text-emerald-300" />,
} as const;

/**
 * `/runtime` — Product Surface. Job: Problem → Runtime → Control Loop →
 * Nutzen → Richtpreise → Enterprise-CTA.
 *
 * Operative Demo-Dashboards gehören nach `/governance-runtime`.
 * Scan/Self-Service bleiben auf `/` und `/pricing`.
 */
export function RuntimePage() {
  usePageMeta({
    title: 'RealSync Runtime — Control-Runtime | RealSync Dynamics AI',
    description:
      'RealSync Runtime ist die Control Plane von RealSync Dynamics AI: beobachten, entscheiden, nachweisen. Für KI, Software und Industrie. Richtpreise nach Architektur-Review.',
    url: 'https://RealSyncDynamicsAI.de/runtime',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />
      <main className="pt-14">
        <section className="relative overflow-hidden border-b border-titanium-900 px-4 py-16 sm:px-6 sm:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 20% 0%, rgba(34,211,238,0.08) 0%, transparent 55%)',
            }}
          />
          <div className="relative mx-auto max-w-7xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300">
              {RUNTIME_PRODUCT.productOf}
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-titanium-400 sm:text-base">
              {RUNTIME_PRODUCT.problem}
            </p>
            <h1 className="mt-4 max-w-4xl font-display text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-titanium-50 sm:text-5xl lg:text-6xl">
              Eine Runtime.{' '}
              <span className="text-cyan-300">Steuerung, während das System läuft.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-titanium-300 sm:text-lg">
              {RUNTIME_PRODUCT.subheadline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={RUNTIME_PRODUCT.exploreHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 bg-cyan-400 px-5 py-3 text-sm font-semibold text-obsidian-950 transition-colors hover:bg-cyan-300"
              >
                {RUNTIME_PRODUCT.exploreCta}
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to={RUNTIME_PRODUCT.enterpriseHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-titanium-700 px-5 py-3 text-sm font-semibold text-titanium-100 transition-colors hover:border-titanium-500 hover:bg-obsidian-900"
              >
                {CTA.enterprise}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500">
              {RUNTIME_PRODUCT.trust.join('  ·  ')}
            </p>
          </div>
        </section>

        <section id="loop" className="border-b border-titanium-900 bg-obsidian-900 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-500">
                Control Loop
              </div>
              <h2 className="mb-3 font-display text-3xl font-semibold tracking-tight text-titanium-50 sm:text-4xl">
                Vom Ereignis zum Nachweis.
              </h2>
              <p className="max-w-2xl text-base leading-relaxed text-titanium-300 sm:text-lg">
                Ereignisse treten in eine gesteuerte Schleife ein — und kehren zur Beobachtung zurück.
                Automation bleibt begrenzt. Policy-Änderung bleibt ein gesteuerter Akt.
              </p>
            </div>
            <ol className="grid grid-cols-1 gap-px bg-titanium-900 sm:grid-cols-2 lg:grid-cols-3">
              {RUNTIME_CONTROL_LOOP.map((step, i) => (
                <li key={step.id} className="bg-obsidian-950 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                    {String(i + 1).padStart(2, '0')} · {step.id}
                  </p>
                  <h3 className="mt-2 font-display text-lg font-semibold text-titanium-50">{step.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-titanium-300">{step.copy}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 grid grid-cols-1 gap-px bg-titanium-900 sm:grid-cols-2 lg:grid-cols-3">
              {RUNTIME_ENGINES.map((engine) => (
                <div key={engine.id} className="bg-obsidian-950 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-300">{engine.name}</p>
                  <p className="mt-2 text-xs leading-relaxed text-titanium-400">{engine.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="nutzen" className="border-b border-titanium-900 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-500">
                Nutzen
              </div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-titanium-50 sm:text-4xl">
                Architektur, kein Einzel-Feature.
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-px bg-titanium-900 sm:grid-cols-2">
              {RUNTIME_BENEFITS.map((item) => (
                <article key={item.id} className="bg-obsidian-950 p-6">
                  <h3 className="font-display text-xl font-semibold text-titanium-50">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-titanium-300">{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="domains" className="border-b border-titanium-900 bg-obsidian-900 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-500">
                Drei Domänen · ein Control Loop
              </div>
              <h2 className="mb-3 font-display text-3xl font-semibold tracking-tight text-titanium-50 sm:text-4xl">
                KI, Software, Industrie.
              </h2>
              <p className="max-w-2xl text-base leading-relaxed text-titanium-300 sm:text-lg">
                Dieselbe Runtime, drei Domain Packs. Kein Branchen-Sonderfall.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-px bg-titanium-900 lg:grid-cols-3">
              {RUNTIME_DOMAINS.map((domain) => (
                <article key={domain.id} className="bg-obsidian-950 p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                    {domain.eyebrow}
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-titanium-50">{domain.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-titanium-300">{domain.statement}</p>
                  <ul className="mt-5 space-y-1.5">
                    {domain.capabilities.map((cap) => (
                      <li key={cap} className="font-mono text-[11px] uppercase tracking-wider text-titanium-500">
                        {cap}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className="mt-6 max-w-3xl text-xs leading-relaxed text-titanium-500">
              {RUNTIME_PRODUCT.notSafetyCritical}
            </p>
          </div>
        </section>

        <section id="packs" className="border-b border-titanium-900 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-500">
                Richtpreise · Architektur-Review
              </div>
              <h2 className="mb-3 font-display text-3xl font-semibold tracking-tight text-titanium-50 sm:text-4xl">
                Orientierung, kein Checkout.
              </h2>
              <p className="max-w-2xl text-base leading-relaxed text-titanium-300 sm:text-lg">
                {RUNTIME_SKU_DISCLAIMER}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-px bg-titanium-900 lg:grid-cols-3">
              {RUNTIME_SKUS.map((sku) => (
                <article
                  key={sku.id}
                  className={`flex flex-col bg-obsidian-950 p-6 ${sku.featured ? 'ring-1 ring-inset ring-cyan-400/40' : ''}`}
                >
                  {sku.featured && (
                    <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                      Typisches Paket nach Review
                    </p>
                  )}
                  <h3 className="font-display text-xl font-semibold text-titanium-50">{sku.name}</h3>
                  <p className="mt-3 font-display text-3xl font-semibold text-titanium-50">
                    {sku.price}
                    {sku.period && (
                      <span className="ml-1 font-mono text-sm font-normal text-titanium-500">{sku.period}</span>
                    )}
                  </p>
                  <p className="mt-2 text-sm text-titanium-400">{sku.pitch}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">{sku.note}</p>
                  <ul className="mt-5 flex-1 space-y-2">
                    {sku.features.map((feature) => (
                      <li key={feature} className="text-sm leading-relaxed text-titanium-300">
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={`/contact-sales?intent=${sku.intent}&source=runtime-sku`}
                    className={`mt-6 inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                      sku.featured
                        ? 'bg-cyan-400 text-obsidian-950 hover:bg-cyan-300'
                        : 'border border-titanium-700 text-titanium-100 hover:border-titanium-500'
                    }`}
                  >
                    {CTA.enterprise}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="surfaces" className="border-b border-titanium-900 bg-obsidian-900 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-500">
                <FlaskConical className="h-3 w-3" aria-hidden="true" />
                {RUNTIME_PRODUCT.surfacesEyebrow}
              </div>
              <h2 className="mb-3 font-display text-3xl font-semibold tracking-tight text-titanium-50 sm:text-4xl">
                Operative Vorschau, nicht dieses Produkt.
              </h2>
              <p className="max-w-2xl text-base leading-relaxed text-titanium-300 sm:text-lg">
                {RUNTIME_PRODUCT.surfacesLead} {RUNTIME_PRODUCT.demoLabel}.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-px bg-titanium-900 lg:grid-cols-2">
              {RUNTIME_SURFACES.map((surface) => (
                <SurfaceCard
                  key={surface.to}
                  to={surface.to}
                  icon={SURFACE_ICON[surface.tone]}
                  label={surface.label}
                  title={surface.title}
                  blurb={surface.blurb}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-titanium-50 sm:text-4xl">
              Architektur-Review, kein Checkout.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-titanium-300">
              Scan und Self-Service bleiben auf der Firmenwebsite. RealSync Runtime wird nach Review verbindlich.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                to={RUNTIME_PRODUCT.enterpriseHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 bg-cyan-400 px-6 py-3 text-sm font-semibold text-obsidian-950 transition-colors hover:bg-cyan-300"
              >
                {CTA.enterprise}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-titanium-500">
              {RUNTIME_PRODUCT.notSafetyCritical}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function SurfaceCard({
  to,
  icon,
  label,
  title,
  blurb,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 bg-obsidian-950 p-6 transition-colors hover:bg-obsidian-900"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
          {icon}
          {label}
        </span>
        <ArrowRight className="h-4 w-4 text-titanium-500 transition-all group-hover:translate-x-0.5 group-hover:text-titanium-100" />
      </div>
      <div className="font-display text-xl font-semibold text-titanium-50">{title}</div>
      <p className="text-sm leading-relaxed text-titanium-300">{blurb}</p>
    </Link>
  );
}
