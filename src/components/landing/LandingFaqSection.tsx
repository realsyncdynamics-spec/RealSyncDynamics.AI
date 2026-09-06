/**
 * Häufige Fragen auf der Startseite.
 *
 * ## Warum es diesen Abschnitt gibt
 *
 * Die Startseite beantwortete keine der Fragen, die vor einem Kauf gestellt
 * werden — Datenstandort, Abgrenzung zum Consent-Banner, Verbindlichkeit der
 * Aussagen, Kündbarkeit. Ergänzung nach `CLAUDE.md` §10.2, mit den
 * vorhandenen Klassen und Tokens.
 *
 * ## Die Regel, die hier härter gilt als anderswo
 *
 * Eine FAQ ist die Stelle, an der eine Zusage am ehesten unbemerkt zu weit
 * geht: Sie klingt sachlich, wird selten gegengelesen und landet trotzdem im
 * Suchindex. Jede Antwort unten ist deshalb an einer Stelle im Repository
 * belegt, und die Stelle steht als Kommentar daneben. Was nicht belegbar
 * war, ist nicht formuliert worden — insbesondere gibt es hier **keine**
 * Aussage zu Verfügbarkeit, Reaktionszeit oder Sicherung. Der Betrieb läuft
 * heute auf einem Supabase-Tarif ohne tägliche Backups, ohne
 * Point-in-Time-Recovery und ohne SLA (CLAUDE.md §5); eine Zusage dazu wäre
 * ungedeckt.
 *
 * Die Frage nach der Rechtsberatung wird bewusst mit „nein" beantwortet.
 * Ein Governance-Produkt, das sich als Rechtsberatung anbieten lässt,
 * verkauft eine Haftung, die es nicht trägt.
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { PLANS } from '../../config/pricing';

/** Aus der SSoT gelesen, nicht hingeschrieben — wie in `PricingPage`. */
const TRIAL_DAYS: number = PLANS.find(plan => plan.trialDays > 0)?.trialDays ?? 14;

interface FaqEntry {
  question: string;
  answer: string;
}

const FAQ: readonly FaqEntry[] = [
  {
    question: 'Brauche ich ein Konto, um zu starten?',
    // Belegt: MainLanding-Hero („kein Account nötig") und /audit als
    // kanonischer Einstieg (Freigabe 2026-08-23, CLAUDE.md §10).
    answer:
      'Nein. Der Scan Ihrer Domain läuft ohne Registrierung — Sie geben die Adresse ein und bekommen Governance Score, Top-Risiken und eine Einschätzung. Ein Konto brauchen Sie erst, wenn der Befund dauerhaft überwacht und als Nachweis aufbewahrt werden soll.',
  },
  {
    question: 'Wo werden meine Daten verarbeitet?',
    // Belegt: CLAUDE.md §2 — Supabase Cloud, Region eu-central-1
    // (Frankfurt); Ollama als EU-lokaler Fallback für Modellaufrufe.
    answer:
      'In der EU. Datenbank und Anwendungsdienste laufen in Frankfurt (eu-central-1). Für Modellaufrufe steht neben den externen Anbietern ein EU-lokales Modell bereit; jeder externe Aufruf wird protokolliert und ist im Prüfpfad sichtbar.',
  },
  {
    question: 'Ist das nicht einfach ein Consent-Banner?',
    // Belegt: Modulliste in src/config/platform-capabilities.ts — der Scan
    // ist eine von neun Fähigkeiten, das Banner selbst ist keine davon.
    answer:
      'Nein, und ein Banner ist auch nicht Teil des Produkts. Ein Consent-Tool holt eine Einwilligung ein. Diese Plattform prüft, ob die Einwilligung technisch überhaupt wirkt, bewertet die KI-Systeme dahinter, setzt Richtlinien durch und hält jede Prüfung und Entscheidung als Nachweis fest.',
  },
  {
    question: 'Was genau ist der Prüfpfad wert?',
    // Belegt: packages/evidence-chain (Hash-Kette), Provenance/C2PA mit
    // Ed25519, Export als PDF und JSON (CLAUDE.md §1, §5).
    answer:
      'Jeder Lauf, jede Entscheidung und jede Änderung wird in einer Hash-Kette abgelegt: Ein nachträglich verändertes Glied bricht die Kette nachweisbar. Inhalte lassen sich zusätzlich signieren. Den gesamten Stand exportieren Sie als PDF oder JSON — für interne Kontrollen und für externe Prüfer.',
  },
  {
    question: 'Ersetzt das eine Rechtsberatung?',
    answer:
      'Nein. Die Plattform stellt fest, was technisch der Fall ist, ordnet es den Anforderungen aus DSGVO und EU AI Act zu und dokumentiert es nachvollziehbar. Die rechtliche Bewertung des Einzelfalls bleibt bei Ihrem Datenschutzbeauftragten oder Ihrer Kanzlei — sie bekommen von uns die Faktenlage, auf der sie arbeiten können.',
  },
  {
    question: 'Wie lange binde ich mich?',
    // Belegt: CheckoutPage („monatlich kündbar ohne Bindung oder
    // Kündigungsfrist"), PricingPage; TRIAL_DAYS aus der SSoT.
    answer:
      `Starter und Growth können Sie ${TRIAL_DAYS} Tage kostenlos testen; danach läuft das Abo monatlich und ist monatlich kündbar, ohne Mindestlaufzeit und ohne Kündigungsfrist. Enterprise läuft über einen Vertrag mit individuell vereinbartem Umfang.`,
  },
];

export function LandingFaqSection() {
  return (
    <section id="faq" className="border-t border-white/10 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div>
            <p className="font-mono text-[10px] tracking-[.25em] text-champagne">HÄUFIGE FRAGEN</p>
            <h2 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl font-serif">
              Bevor Sie <span className="text-champagne">anfangen.</span>
            </h2>
            <p className="mt-5 leading-relaxed text-white/55">
              Was hier nicht steht, beantworten wir direkt — ohne Verkaufsgespräch.
            </p>
            <Link
              to="/contact-sales?intent=faq&source=landing-faq"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-champagne"
            >
              Frage stellen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <dl className="space-y-3">
            {FAQ.map(entry => (
              <div
                key={entry.question}
                data-reveal
                data-reveal-group="faq"
                className="surface-panel rounded-2xl p-6"
              >
                <dt className="font-semibold">{entry.question}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-white/55">{entry.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
