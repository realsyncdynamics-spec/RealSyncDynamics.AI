import { Gauge, AlertTriangle, FileCheck2, Compass, FlaskConical } from 'lucide-react';

// ResultsIn30SecondsSection — direkt unter dem Hero. Beantwortet die wichtigste
// Conversion-Frage: „Was bekomme ich, wenn ich jetzt scanne?". Vier kompakte
// Cards mit dem, was nach dem ersten Lauf sichtbar wird — als Vorschau, klar
// als Beispieldaten markiert.
//
// Hard-edge industrial: keine abgerundeten Ecken, mono-eyebrow, kein
// Marketing-Glanz. Tonalität: präzise, Enterprise-tauglich, keine Garantien.

interface ResultCard {
  step:     string;
  icon:     React.ReactNode;
  title:    string;
  body:     string;
}

const CARDS: readonly ResultCard[] = [
  {
    step:  '01',
    icon:  <Gauge className="h-5 w-5" />,
    title: 'Compliance-Score',
    body:  'Erster Risikoindikator für Website, Tracker und AI-Nutzung — eine Zahl, an der DSB, CTO und Procurement gleich lesen können.',
  },
  {
    step:  '02',
    icon:  <AlertTriangle className="h-5 w-5" />,
    title: 'Top-3 Risiken',
    body:  'Priorisierte Befunde statt langer Checklisten — was zuerst angefasst werden sollte, mit Paragraphenbezug und Severity.',
  },
  {
    step:  '03',
    icon:  <FileCheck2 className="h-5 w-5" />,
    title: 'Evidence-Preview',
    body:  'Erste technische Nachweise mit Zeitstempel und Event-Kontext — kryptographisch versiegelt, replaybar.',
  },
  {
    step:  '04',
    icon:  <Compass className="h-5 w-5" />,
    title: 'Nächster Schritt',
    body:  'Konkrete Handlungsempfehlung für DSB, CTO oder Agentur — kein generischer Report, sondern ein anschlussfähiger Plan.',
  },
];

export function ResultsIn30SecondsSection() {
  return (
    <section
      aria-label="Ergebnis in 30 Sekunden"
      className="bg-obsidian-950 border-b border-titanium-900 py-16 sm:py-20 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            Ergebnis · 30 Sekunden
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            Was Sie in den ersten 30 Sekunden sehen.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Kein 40-seitiges PDF, sondern vier konkrete Ankerpunkte —
            damit DSB-, CTO- und Procurement-Teams sofort weiterarbeiten können.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900 border border-titanium-900">
          {CARDS.map((c) => (
            <article
              key={c.step}
              className="bg-obsidian-950 p-5 sm:p-6 flex flex-col"
            >
              <header className="flex items-center gap-2.5 mb-4">
                <span className="inline-flex w-9 h-9 items-center justify-center bg-obsidian-900 border border-titanium-800 text-cyan-300">
                  {c.icon}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">
                  {c.step}
                </span>
              </header>

              <h3 className="font-display font-semibold text-base text-titanium-50 mb-2 leading-snug">
                {c.title}
              </h3>

              <p className="text-titanium-400 text-sm leading-relaxed flex-1">
                {c.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 border border-titanium-900 bg-obsidian-900/60">
          <FlaskConical className="h-3 w-3 text-titanium-500 shrink-0" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">
            Beispielhafte Vorschau · Demo-Daten · echte Befunde nach Audit-Start
          </span>
        </div>
      </div>
    </section>
  );
}
