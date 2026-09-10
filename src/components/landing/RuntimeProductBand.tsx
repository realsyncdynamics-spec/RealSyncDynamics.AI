import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CTA } from '../../content/runtimeVocab';
import {
  RUNTIME_BAND_NOTE,
  RUNTIME_CONTROL_LOOP,
  RUNTIME_DOMAINS,
  RUNTIME_PRODUCT,
} from '../../content/runtimeProduct';
import {
  LANDING_ACCENT,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_SERIF,
} from './landing-theme';

/**
 * Product pointer on the company homepage.
 *
 * Job: name the product, point to `/runtime`. Not a second product page.
 * Ergänzung zur eingefrorenen Startseite (CLAUDE.md §10.2).
 */
export function RuntimeProductBand() {
  return (
    <section
      id="runtime"
      aria-labelledby="runtime-product-heading"
      className="border-y border-white/10 bg-white/[.02] py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="max-w-3xl">
          <p className="font-mono text-[10px] tracking-[.25em]" style={{ color: LANDING_ACCENT }}>
            {RUNTIME_PRODUCT.eyebrow}
          </p>
          <h2
            id="runtime-product-heading"
            className="mt-3 text-4xl tracking-tight sm:text-5xl"
            style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}
          >
            {RUNTIME_PRODUCT.name}.{' '}
            <span style={{ color: LANDING_ACCENT }}>Das Enterprise-Produkt.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/45">{RUNTIME_PRODUCT.problem}</p>
          <p className="mt-3 leading-relaxed text-white/55">{RUNTIME_PRODUCT.subheadline}</p>
        </div>

        <ol className="mt-8 flex flex-wrap gap-2">
          {RUNTIME_CONTROL_LOOP.map((step, i) => (
            <li
              key={step.id}
              className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.14em] text-white/60"
            >
              {String(i + 1).padStart(2, '0')} {step.label}
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap gap-2">
          {RUNTIME_DOMAINS.map((domain) => (
            <span
              key={domain.id}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55"
            >
              {domain.title}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to="/runtime"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition"
            style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
          >
            {RUNTIME_PRODUCT.exploreCta}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to={RUNTIME_PRODUCT.enterpriseHref}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-medium text-white/80 transition hover:bg-white/5"
          >
            {CTA.enterprise}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-white/35">{RUNTIME_BAND_NOTE}</p>
      </div>
    </section>
  );
}
