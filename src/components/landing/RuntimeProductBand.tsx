import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CTA } from '../../content/runtimeVocab';
import {
  RUNTIME_CONTROL_LOOP,
  RUNTIME_DOMAINS,
  RUNTIME_PRODUCT,
  RUNTIME_SKU_DISCLAIMER,
} from '../../content/runtimeProduct';
import {
  LANDING_ACCENT,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_SERIF,
} from './landing-theme';

/**
 * Product band on the company homepage.
 *
 * Ergänzung zur eingefrorenen Startseite (CLAUDE.md §10.2): neue Sektion,
 * vorhandene Tokens. Kein Eingriff in den Scan-Trichter, keine Preise aus
 * dem Self-Service, kein Demo-/Pilot-CTA.
 */
export function RuntimeProductBand() {
  return (
    <section
      id="runtime"
      aria-labelledby="runtime-product-heading"
      className="border-y border-white/10 bg-white/[.02] py-20 md:py-28"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[10px] tracking-[.25em]" style={{ color: LANDING_ACCENT }}>
            {RUNTIME_PRODUCT.eyebrow}
          </p>
          <h2
            id="runtime-product-heading"
            className="mt-3 text-4xl tracking-tight sm:text-5xl"
            style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}
          >
            {RUNTIME_PRODUCT.name}.{' '}
            <span style={{ color: LANDING_ACCENT }}>Control Plane im Ökosystem.</span>
          </h2>
          <p className="mt-5 leading-relaxed text-white/55">{RUNTIME_PRODUCT.subheadline}</p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[.18em] text-white/35">
            {RUNTIME_PRODUCT.productOf}
          </p>
        </div>

        <ol className="mb-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3 lg:grid-cols-9">
          {RUNTIME_CONTROL_LOOP.map((step, i) => (
            <li key={step.id} className="bg-[rgb(3,7,18)] px-3 py-4">
              <p className="font-mono text-[9px] tracking-[.16em] text-white/35">
                {String(i + 1).padStart(2, '0')}
              </p>
              <p className="mt-1 text-sm font-medium text-white/85">{step.label}</p>
            </li>
          ))}
        </ol>

        <div className="grid gap-4 md:grid-cols-3">
          {RUNTIME_DOMAINS.map((domain) => (
            <article key={domain.id} className="surface-panel rounded-2xl p-6">
              <p className="font-mono text-[9px] tracking-[.18em]" style={{ color: LANDING_ACCENT }}>
                {domain.eyebrow}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{domain.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{domain.statement}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to="/runtime"
            className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition"
            style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
          >
            {RUNTIME_PRODUCT.exploreCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to={RUNTIME_PRODUCT.enterpriseHref}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-medium text-white/80 transition hover:bg-white/5"
          >
            {CTA.enterprise}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-white/35">
          {RUNTIME_SKU_DISCLAIMER}
        </p>
      </div>
    </section>
  );
}
