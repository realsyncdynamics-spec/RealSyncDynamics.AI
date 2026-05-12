const cases = [
  {
    title: 'HR-SaaS mit KI-Matching',
    intro:
      'Eine HR-Plattform nutzt KI, um Bewerbungen automatisch zu matchen, und betreibt mehrere Marketing-Landingpages.',
    points: [
      'RealSync erkennt US-Tracking-Tools, die vor Einwilligung feuern.',
      'Der Matching-Workflow wird als AI-Act-relevant markiert.',
      'Agenten schlagen CMP-Anpassung, Datenschutzhinweise und AI-Usecase-Dokumentation vor.',
      'Logging- und Human-Oversight-Pflichten werden als To-dos sichtbar.',
    ],
  },
  {
    title: 'Telemedizin-Startup mit Triage-KI',
    intro:
      'Ein Telemedizin-Anbieter sammelt Gesundheitsdaten über Online-Formulare und nutzt KI zur Triage von Anfragen.',
    points: [
      'RealSync kartiert Website, Formulare, Datenflüsse und angebundene KI-APIs.',
      'Der KI-Usecase wird als potenzieller Hochrisiko-Fall nach EU AI Act bewertet.',
      'Das System liefert eine technische Basis für Risikoanalyse und Dokumentation.',
      'Laufendes Monitoring erkennt Änderungen an Formularen, Trackern und KI-Workflows.',
    ],
  },
];

export function GovernanceMiniCasesSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-3">
            Realitäts-Check
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            Zwei typische Szenarien aus der Praxis.
          </h2>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
            So verbindet RealSyncDynamics.AI Website-Compliance, AI-Act-Governance und laufendes
            Monitoring in konkreten operativen Situationen.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {cases.map((c) => (
            <article key={c.title} className="bg-obsidian-900/60 border border-silver-700/30 p-6">
              <h3 className="font-display font-bold text-2xl text-titanium-50">{c.title}</h3>
              <p className="mt-3 text-sm text-silver-300 leading-relaxed">{c.intro}</p>
              <div className="mt-5 space-y-3">
                {c.points.map((p) => (
                  <div
                    key={p}
                    className="border border-silver-700/30 bg-obsidian-950/60 p-4 text-sm text-silver-300 leading-relaxed"
                  >
                    {p}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
