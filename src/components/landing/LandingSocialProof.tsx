import { getPlanBySlug } from '../../content/pricingContent';
import { LANDING_ACCENT, LANDING_MONO, LANDING_MUTED, LANDING_TEXT } from './landing-theme';

/**
 * Vertrauenszeile direkt unter dem Hero (über dem Fold auf grossen Screens).
 *
 * Bewusst keine erfundenen Kundenlogos und keine erfundenen Zähler: Die
 * „Logos" sind die Frameworks, gegen die geprüft wird; die Kennzahlen
 * beschreiben den Scan selbst (Dimensionen, Dauer, Hosting, Preis) — alles
 * Aussagen, die auf `/audit` und der Preisseite ebenso stehen.
 */
const FRAMEWORKS = ['DSGVO', 'EU AI Act', 'ISO 27001', 'WCAG', 'C2PA'] as const;

const STARTER_NAME = getPlanBySlug('starter')?.name ?? 'Starter';

const METRICS: readonly { value: string; label: string; detail: string }[] = [
  {
    value: '5',
    label: 'Prüfdimensionen in einem Scan',
    detail: 'DSGVO · EU AI Act · Sicherheit · Barrierefreiheit · SEO',
  },
  {
    value: '~2 Min.',
    label: 'bis zum ersten Ergebnis',
    detail: 'Kein Account, keine Kreditkarte',
  },
  {
    value: 'EU',
    label: 'Hosting und Verarbeitung',
    detail: 'Daten bleiben in Frankfurt',
  },
  {
    value: '0 €',
    label: 'für den Governance Scan',
    detail: `Tiefenanalyse ab ${STARTER_NAME}`,
  },
];

export function LandingSocialProof() {
  return (
    <section
      id="social-proof"
      className="border-b border-[#d0c3a4]/10 bg-white/[.015] py-8 lg:py-9"
      aria-label="Vertrauen und Kennzahlen"
    >
      <div className="mx-auto grid max-w-[1500px] gap-8 px-[4vw] lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-12">
        <div>
          <p
            className="text-[9px] tracking-[.22em]"
            style={{ fontFamily: LANDING_MONO, color: `${LANDING_ACCENT}cc` }}
          >
            GEBAUT FÜR COMPLIANCE-TEAMS · AUSGERICHTET AN
          </p>
          <ul className="mt-4 flex flex-wrap gap-2.5" aria-label="Frameworks und Standards">
            {FRAMEWORKS.map((name) => (
              <li
                key={name}
                className="surface-panel rounded-md px-3.5 py-2 text-[11px] font-semibold tracking-[.08em] transition hover:brightness-125"
                style={{ fontFamily: LANDING_MONO, color: '#d9d2c4' }}
              >
                {name}
              </li>
            ))}
          </ul>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
          {METRICS.map((metric) => (
            <div key={metric.label} className="border-l pl-4" style={{ borderColor: `${LANDING_ACCENT}40` }}>
              <dd
                className="text-[22px] leading-none tracking-tight"
                style={{ fontFamily: LANDING_MONO, color: LANDING_TEXT }}
              >
                {metric.value}
              </dd>
              <dt className="mt-1.5 text-[11px] font-medium" style={{ color: '#d9d2c4' }}>
                {metric.label}
              </dt>
              <p className="mt-1 text-[10px] leading-snug" style={{ color: LANDING_MUTED }}>
                {metric.detail}
              </p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
