import { CheckCircle2 } from 'lucide-react';

// OutcomeBulletsSection — die konkreten Outcomes oberhalb von Architektur-Tiefe.
// Adressiert: „Outcomes expliziter machen" aus dem Analyse-Punkt 2.
// Position: direkt nach dem Hero, BEVOR die technische Tiefe (LiveScanCanvas)
// kommt — damit der Visitor zuerst sieht was sich für ihn ändert, dann wie.

interface Outcome {
  before: string;
  after:  string;
}

const OUTCOMES: readonly Outcome[] = [
  {
    before: 'Manuell Excel-Listen für Cookie-Banner pflegen, Pre-Consent-Tracker übersehen.',
    after:  'Pre-Consent-Tracking wird automatisch erkannt, priorisiert und mit Paragraphenbezug dokumentiert.',
  },
  {
    before: 'Tagelang Audit-Pakete zusammenstellen vor jedem Vendor-Review oder DSB-Anfrage.',
    after:  'Audit-Bundles in Minuten exportierbar — gehasht, signiert, mit Evidence-Chain.',
  },
  {
    before: 'Vor jeder AI-Act-Anfrage neu nachforschen, welche KI-Endpunkte wo laufen.',
    after:  'AI-Usecase-Inventar bleibt immer aktuell — Annex-III-Klassifikation + Risk-Profile pro Endpunkt.',
  },
  {
    before: 'PDFs in Mailboxen suchen, Screenshots beifügen, Datenschutzhinweise vergleichen.',
    after:  'Jede Änderung kryptographisch versiegelt (SHA-256 + Ed25519), Evidence-Bundle on-demand.',
  },
];

export function OutcomeBulletsSection() {
  return (
    <section
      aria-label="Outcomes"
      className="bg-obsidian-950 border-b border-titanium-900 py-20 sm:py-24 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            01 · was sich konkret ändert
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            Was die Runtime Ihnen abnimmt.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Nicht „ein weiteres Dashboard". Vier Aufgaben, die heute Wochen kosten,
            laufen ab der ersten Minute selbständig.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-titanium-900">
          {OUTCOMES.map((o, i) => (
            <article
              key={i}
              className="bg-obsidian-950 p-6 sm:p-7"
            >
              <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-3">
                vorher
              </div>
              <p className="text-titanium-400 text-sm leading-relaxed mb-5 line-through decoration-titanium-700/60">
                {o.before}
              </p>
              <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 mb-3">
                mit RealSync
              </div>
              <p className="text-titanium-50 text-base leading-relaxed flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{o.after}</span>
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
