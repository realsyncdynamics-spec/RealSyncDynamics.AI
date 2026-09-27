/**
 * Sektion „Evidence & Trust" — der Nachweisteil der Governance-AI-Vorschau.
 *
 * Vier Flächen, auf die sich die Seite beim Wort nehmen lässt: Datenschutz,
 * AI Act, Export und Code. Bewusst ohne Zahlen — was hier steht, muss auch
 * ohne Mandant und ohne Scan stimmen.
 *
 * Der Anker `#evidence` bedient den gleichnamigen Eintrag aus
 * `PUBLIC_PRIMARY_NAV`.
 */
import { Code2, FileCheck2, Lock, ShieldCheck } from 'lucide-react';
import {
  GA_DISPLAY,
  GA_LINE_SOFT,
  GA_MUTED,
  GA_TEXT,
} from './governance-ai-theme';
import { SectionEyebrow, SectionHeading, SectionIndex } from './GovernanceSectionChrome';

const ITEMS = [
  {
    Icon: ShieldCheck,
    title: 'DSGVO',
    text: 'Verarbeitung, Risiko, Policy und Nachweis im laufenden Governance-Prozess.',
  },
  {
    Icon: Lock,
    title: 'EU AI Act',
    text: 'Risikoklassifikation, Transparenz und Dokumentation für KI-Systeme.',
  },
  {
    Icon: FileCheck2,
    title: 'Nachweis-Export',
    text: 'Prüfungen und Entscheidungen als auditfähiger Export — für interne Kontrollen und externe Prüfer.',
  },
  {
    Icon: Code2,
    title: 'Code Compliance',
    text: 'Claude Code prüft und unterstützt konkrete technische Remediation.',
  },
] as const;

export function EvidenceTrustSection() {
  return (
    <section
      id="evidence"
      className="ga-band relative z-[1] border-t px-[4vw] py-[clamp(60px,6vw,92px)]"
      style={{ borderColor: GA_LINE_SOFT }}
      aria-labelledby="evidence-heading"
    >
      <div className="mx-auto w-full max-w-[1500px]">
        <SectionIndex number="05" label="EVIDENCE" />
        <SectionEyebrow>EVIDENCE &amp; TRUST</SectionEyebrow>
        <span id="evidence-heading">
          <SectionHeading accent="beweisen lässt.">Compliance, die sich</SectionHeading>
        </span>
        <p className="mt-4 max-w-[660px] text-pretty leading-[1.7]" style={{ color: GA_MUTED }}>
          PDFs, Logs, Zeitstempel und nachvollziehbare Prüfpfade. Jede Prüfung, jede Entscheidung
          und jede Änderung landet in derselben Governance-Historie.
        </p>

        <div className="mt-[38px] grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ Icon, title, text }) => (
            <article key={title} className="ga-card ga-glass flex flex-col p-6">
              <Icon
                className="h-[22px] w-[22px]"
                strokeWidth={2}
                style={{ color: 'var(--ga-accent)' }}
                aria-hidden="true"
              />
              <h3
                className="mt-4 text-[18px] font-medium tracking-[-.01em]"
                style={{ fontFamily: GA_DISPLAY, color: GA_TEXT }}
              >
                {title}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-pretty" style={{ color: GA_MUTED }}>
                {text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
