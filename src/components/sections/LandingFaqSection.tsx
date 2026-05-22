// LandingFaqSection — kompakter FAQ-Block am Ende der Landing.
// Adressiert die fünf häufigsten Vorab-Fragen, die in Procurement- und
// DSB-Calls regelmäßig auftauchen. Antworten sind bewusst vorsichtig
// formuliert: keine Garantien, keine Rechtsberatung, klare Trennung
// zwischen Demo-Telemetrie und Produktivdaten.

interface FaqEntry {
  q: string;
  a: string;
}

const ENTRIES: readonly FaqEntry[] = [
  {
    q: 'Ist RealSync ein Cookie-Banner?',
    a: 'Nein. RealSync ist keine Consent-Management-Plattform, sondern eine Governance-Runtime zur Überwachung, Erkennung und Nachweisführung.',
  },
  {
    q: 'Ersetzt RealSync einen Datenschutzbeauftragten?',
    a: 'Nein. RealSync unterstützt DSBs und Compliance-Teams mit technischen Befunden, Evidence und Priorisierung. Die rechtliche Bewertung bleibt Aufgabe qualifizierter Personen.',
  },
  {
    q: 'Sind die Runtime-Daten auf der Startseite live?',
    a: 'Öffentliche Demos können simulierte Telemetrie enthalten und werden entsprechend gekennzeichnet. Produktivdaten sind tenant-isoliert und nicht öffentlich sichtbar.',
  },
  {
    q: 'Was ist der Unterschied zu klassischen DSGVO-Scannern?',
    a: 'Klassische Scanner liefern Momentaufnahmen. RealSync ist auf kontinuierliche Runtime-Beobachtung, Event-Historie und überprüfbare Evidence ausgelegt.',
  },
  {
    q: 'Für wen ist RealSync geeignet?',
    a: 'Für Unternehmen, Agenturen und Teams mit mehreren Websites, AI-Systemen oder regelmäßigem Audit- und Nachweisdruck.',
  },
];

export function LandingFaqSection() {
  return (
    <section
      id="faq"
      aria-label="Häufige Fragen"
      className="bg-obsidian-950 border-t border-titanium-900 py-16 sm:py-20 px-4 sm:px-6"
    >
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            FAQ · vor dem Audit
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            Häufige Fragen.
          </h2>
          <p className="text-titanium-300 text-base leading-relaxed">
            Was Procurement, DSBs und Security-Teams typischerweise zuerst klären.
          </p>
        </div>

        <div className="space-y-2.5">
          {ENTRIES.map((f) => (
            <details
              key={f.q}
              className="group bg-obsidian-900/60 border border-titanium-900 open:border-titanium-700/60 transition-colors"
            >
              <summary className="cursor-pointer list-none px-5 py-4 flex items-start justify-between gap-4">
                <span className="font-display font-semibold text-titanium-50 text-sm sm:text-base leading-snug">
                  {f.q}
                </span>
                <span className="text-titanium-400 text-lg leading-none transition-transform group-open:rotate-45 select-none">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 text-sm text-titanium-300 leading-relaxed">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
