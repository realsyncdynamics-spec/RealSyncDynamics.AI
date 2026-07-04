import type { FaqEntry } from '../../lib/useJsonLd';

/**
 * Reusable FAQ section used by the SEO money pages.
 *
 * The same entries can be passed to useJsonLd + faqPageLd() to emit a
 * FAQPage structured-data block alongside the rendered UI.
 *
 * Default set covers the six baseline questions any compliance-curious
 * visitor will ask. Pages can pass their own `entries` to override.
 */

export const DEFAULT_COMPLIANCE_FAQ: FaqEntry[] = [
  {
    question: 'Wie funktioniert der Audit?',
    answer:
      'Sie geben eine URL und Ihre E-Mail-Adresse ein. Der Audit lädt die Seite technisch und prüft anhand einer Heuristik mögliche Risiken bei Tracking, Cookies, externen Diensten und Pflichtangaben. Sie erhalten den strukturierten Report per E-Mail.',
  },
  {
    question: 'Was wird technisch geprüft?',
    answer:
      'Pre-Consent-Tracking-Indikatoren, gefundene Drittanbieter-Skripte, Cookie-Verhalten, Pflichtangaben (Impressum, Datenschutz), Security-Header sowie ausgewählte AI-Act-relevante Hinweise. Eine vollständige Liste der geprüften Punkte steht in der Methodik.',
  },
  {
    question: 'Was ist Pre-Consent Tracking?',
    answer:
      'Pre-Consent Tracking bezeichnet das Laden von Tracking-Diensten (z. B. Analytics, Pixel, externe Skripte) bevor die Nutzerin oder der Nutzer eine wirksame Einwilligung erteilt hat. Je nach Konfiguration und Rechtsgrundlage kann das ein DSGVO-/TDDDG-Risiko darstellen.',
  },
  {
    question: 'Ersetzt der Audit eine Rechtsberatung?',
    answer:
      'Nein. Der Audit ersetzt keine individuelle Rechtsberatung und keine vollständige technische Prüfung. Er unterstützt bei der technischen Vorprüfung und Priorisierung möglicher Risiken.',
  },
  {
    question: 'Was bedeutet Continuous Compliance?',
    answer:
      'Continuous Compliance steht für die laufende technische Überwachung von Websites und Tracking-Stacks. Statt einer einmaligen Momentaufnahme entsteht eine nachvollziehbare Audit-Historie, die Veränderungen bei Trackern, externen Diensten und Consent-Konfigurationen sichtbar macht.',
  },
  {
    question: 'Wie geht es nach dem Audit weiter?',
    answer:
      'Sie erhalten einen Report mit priorisierten Hinweisen. Optional können Sie kontinuierliches Monitoring aktivieren, einen Fix-Call zur technischen Einordnung buchen oder das DSGVO-Fix-Paket Light für die Umsetzung anfragen.',
  },
];

interface Props {
  entries?: FaqEntry[];
  title?: string;
  eyebrow?: string;
}

export function ComplianceFAQ({
  entries = DEFAULT_COMPLIANCE_FAQ,
  title = 'Häufige Fragen',
  eyebrow = 'FAQ',
}: Props) {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            {eyebrow}
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 tracking-tight leading-tight">
            {title}
          </h2>
        </div>

        <div className="space-y-3">
          {entries.map((f) => (
            <details
              key={f.question}
              className="group bg-obsidian-900/60 border border-silver-700/30 rounded-none open:border-titanium-200/40"
            >
              <summary className="cursor-pointer list-none px-5 py-4 flex items-start justify-between gap-4">
                <span className="font-display font-bold text-titanium-50 text-sm sm:text-base leading-snug">
                  {f.question}
                </span>
                <span className="text-titanium-400 text-lg leading-none transition-transform group-open:rotate-45 select-none">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 text-sm text-silver-300 leading-relaxed">
                {f.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
