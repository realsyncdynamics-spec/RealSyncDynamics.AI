import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { getPlansByFeature, type PricingPlan } from '../../content/pricingContent';
import { LANDING_ACCENT, LANDING_BUTTON_TEXT, LANDING_LINE, LANDING_MONO } from './landing-theme';

/**
 * Drei Feature-Anker unter der Hero-Headline — klickbare Karten statt
 * Text-Tags. Jede Karte trägt ein Plan-Badge und einen Tooltip
 * („Enthalten ab …") und führt auf die Plan-Detailseite.
 *
 * Der Einstiegsplan wird aus `pricingContent` abgeleitet, nicht getippt:
 * verschiebt sich ein Modul im Katalog, folgt das Badge automatisch.
 */
type Anchor = {
  readonly label: string;
  readonly featureSlug: string;
  readonly text: string;
};

const ANCHORS: readonly Anchor[] = [
  {
    label: 'EVIDENCE-CHAIN',
    featureSlug: 'evidence-vault',
    text: 'Jede Prüfung, Entscheidung und Änderung landet zeitgestempelt in einer Governance-Historie.',
  },
  {
    label: 'AI-ACT-KLASSIFIKATION',
    featureSlug: 'ai-risk-register',
    text: 'Risikoklasse, Transparenzpflichten und Dokumentation je KI-System — zentral geführt.',
  },
  {
    label: 'PROVENANCE C2PA',
    featureSlug: 'c2pa-herkunftsnachweis',
    text: 'Inhalte signieren und ihre Herkunft überprüfbar machen — Ed25519, Content Credentials.',
  },
];

/** Monatliche Kaufpläne aufsteigend — der erste Treffer ist der Einstiegsplan. */
const PLAN_ORDER = ['starter', 'growth', 'agency', 'enterprise'] as const;

function entryPlan(featureSlug: string): PricingPlan | undefined {
  const plans = getPlansByFeature(featureSlug);
  for (const slug of PLAN_ORDER) {
    const hit = plans.find((plan) => plan.slug === slug);
    if (hit) return hit;
  }
  return undefined;
}

export function HeroFeatureAnchors() {
  return (
    <ul
      className="my-[38px] mb-[26px] grid gap-0 border-y sm:grid-cols-3"
      style={{ borderColor: LANDING_LINE }}
      aria-label="Kernmodule und Plan-Zuordnung"
    >
      {ANCHORS.map((anchor, i) => {
        const plan = entryPlan(anchor.featureSlug);
        const exclusive = plan !== undefined && plan.slug !== PLAN_ORDER[0];
        const tooltipId = `hero-anchor-tip-${anchor.featureSlug}`;

        return (
          <li
            key={anchor.featureSlug}
            className={`relative ${i > 0 ? 'sm:border-l' : ''}`}
            style={{ borderColor: LANDING_LINE }}
          >
            <Link
              to={plan ? `/pricing/${plan.slug}` : '/pricing'}
              aria-describedby={plan ? tooltipId : undefined}
              className={`group block h-full py-[18px] pr-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e4cfa2]/50 ${i > 0 ? 'sm:pl-5' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <b
                  className="text-[8px] font-medium tracking-[.18em]"
                  style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                >
                  {anchor.label}
                </b>
                {plan && (
                  <span
                    className="shrink-0 rounded-full border px-1.5 py-[3px] text-[7px] tracking-[.16em] transition group-hover:brightness-110"
                    style={{
                      fontFamily: LANDING_MONO,
                      borderColor: exclusive ? LANDING_ACCENT : `${LANDING_ACCENT}55`,
                      backgroundColor: exclusive ? LANDING_ACCENT : 'transparent',
                      color: exclusive ? LANDING_BUTTON_TEXT : `${LANDING_ACCENT}cc`,
                    }}
                  >
                    {exclusive ? `${plan.name.toUpperCase()} +` : 'INKLUSIVE'}
                  </span>
                )}
              </div>
              <p className="mt-2.5 text-[11px] leading-[1.6]" style={{ color: '#b5b5bc' }}>
                {anchor.text}
              </p>
              <span
                className="mt-3 inline-flex items-center gap-1 text-[8px] tracking-[.16em] text-white/40 transition group-hover:text-white/80"
                style={{ fontFamily: LANDING_MONO }}
              >
                PLAN ANSEHEN
                <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>

              {plan && (
                <span
                  id={tooltipId}
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-max max-w-[240px] rounded-md border px-3 py-2 text-[10px] leading-snug opacity-0 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.95)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  style={{
                    borderColor: `${LANDING_ACCENT}40`,
                    backgroundColor: '#0b0e14',
                    color: '#e8dfd2',
                  }}
                >
                  Enthalten ab <b style={{ color: LANDING_ACCENT }}>{plan.name}</b> · {plan.priceString}{' '}
                  {plan.interval}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
