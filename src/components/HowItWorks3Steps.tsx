/**
 * HowItWorks3Steps — „So läuft Ihr Website-Check ab" in drei Schritten.
 *
 * Direkter Anschluss an <TargetAudience>. Bewusst laienfreundlich
 * formuliert: keine Tech-Abkürzungen im Titel-Text, Paragraphen-Refs
 * (Art. 6 DSGVO, § 25 TTDSG) tauchen nur in der Detail-Beschreibung
 * auf — als Trust-Anker, nicht als Hürde.
 *
 * Visuelles Layout: nummerierte Schritte mit Brass-Verbindungslinien
 * (mirrored zur AiCoreVisual + WatchmakerShowcase-Sprache). Mobile:
 * Schritte stacken vertikal mit Brass-Linker-Border.
 */

type Step = {
  n: number;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    title: 'Website-Adresse eingeben',
    body: 'Wir scannen Ihre Website auf Tracking-Tools, Cookies und Sicherheits-Einstellungen. Der Scan läuft automatisch in 30 Sekunden, kein Account nötig.',
  },
  {
    n: 2,
    title: 'Risiken mit Rechtsbezug sehen',
    body: 'Sie erhalten eine Liste möglicher Verstöße — z. B. DSGVO Art. 6 oder § 25 TTDSG — inklusive kurzer Erklärung in Klartext, was das konkret für Ihre Site bedeutet.',
  },
  {
    n: 3,
    title: 'Konkrete Maßnahmen umsetzen',
    body: 'Zu jedem Befund sehen Sie, was Ihr Webmaster oder Ihre Agentur technisch anpassen muss. Auf Wunsch übernehmen wir die Umsetzung als Komplett-Service.',
  },
];

export function HowItWorks3Steps() {
  return (
    <section
      aria-label="So läuft Ihr Website-Check ab"
      className="px-4 sm:px-6 lg:px-8 py-20 sm:py-24 border-t border-titanium-900"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-brass-400 mb-3">
            So läuft Ihr Website-Check ab
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50 tracking-tight">
            In drei Schritten zu klaren Befunden.
          </h2>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-px bg-titanium-900 relative">
          {STEPS.map((s) => (
            <li key={s.n} className="relative flex flex-col bg-obsidian-950 p-6 sm:p-7">
              <div className="flex items-center gap-3 mb-3">
                <span className="shrink-0 w-9 h-9 flex items-center justify-center font-display font-bold text-base bg-brass-500 text-obsidian-950 border-2 border-brass-700">
                  {s.n}
                </span>
                <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg tracking-tight leading-tight">
                  {s.title}
                </h3>
              </div>
              <p className="text-sm text-titanium-400 leading-relaxed">
                {s.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-center text-xs text-titanium-500 max-w-2xl mx-auto">
          Wir erkennen typische Standard-Risiken (Tracking vor Consent, Cookie-Banner-Probleme,
          fehlende AV-Verträge) automatisiert. Spezialfälle und individuelle Ausnahmen müssen
          weiterhin manuell geprüft werden — wir liefern das Radar, nicht den Richter.
        </p>
      </div>
    </section>
  );
}
