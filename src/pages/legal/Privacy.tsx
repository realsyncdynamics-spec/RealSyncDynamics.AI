import { Link } from 'react-router-dom';

const sections = [
  { title: '1. Verantwortlicher', body: 'RealSyncDynamics.AI GmbH, Musterstrasse 1, 10115 Berlin. E-Mail: datenschutz@realsyncdynamics.ai' },
  { title: '2. Erhebung personenbezogener Daten', body: 'Wir erheben Daten wenn Sie unsere Website besuchen, ein Formular ausfullen oder sich registrieren: Name, E-Mail, Unternehmen, Telefonnummer sowie technische Daten.' },
  { title: '3. Zweck der Datenverarbeitung', body: 'Ihre Daten werden fur folgende Zwecke verarbeitet: Bereitstellung und Verbesserung unserer Dienste, Beantwortung von Anfragen und Erfullung vertraglicher Pflichten.' },
  { title: '4. Rechtsgrundlagen', body: 'Die Verarbeitung erfolgt auf Basis von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfullung), Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) und Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).' },
  { title: '5. Weitergabe von Daten', body: 'Wir geben Ihre Daten nicht an Dritte weiter, es sei denn, dies ist zur Vertragserfullung erforderlich oder gesetzlich vorgeschrieben. Sub-Prozessoren sind unter /legal/sub-processors aufgelistet.' },
  { title: '6. Datenspeicherung', body: 'Wir speichern Ihre Daten nur so lange, wie es fur die genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen.' },
  { title: '7. Ihre Rechte', body: 'Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Loschung (Art. 17), Einschrankung (Art. 18), Datenubertragebarkeit (Art. 20) und Widerspruch (Art. 21) DSGVO.' },
  { title: '8. Cookies', body: 'Wir verwenden technisch notwendige Cookies sowie optionale Analyse-Cookies mit Ihrer Einwilligung. Sie konnen Cookies in den Browser-Einstellungen deaktivieren.' },
  { title: '9. Kontakt Datenschutzbeauftragter', body: 'Fragen zum Datenschutz richten Sie an: datenschutz@realsyncdynamics.ai' },
  { title: '10. Beschwerderecht', body: 'Sie haben das Recht, sich bei der Berliner Beauftragten fur Datenschutz und Informationsfreiheit zu beschweren, Friedrichstr. 219, 10969 Berlin.' },
];

export function Privacy() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="sticky top-0 z-50 border-b border-titanium-900 bg-obsidian-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-titanium-100">
            RealSync<span className="text-security-400">Dynamics</span>.AI
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-titanium-300 md:flex">
            <Link to="/agencies" className="hover:text-titanium-100">Agenturen</Link>
            <Link to="/pricing" className="hover:text-titanium-100">Preise</Link>
            <Link to="/dashboard" className="hover:text-titanium-100">Login</Link>
            <Link to="/contact-sales" className="bg-security-500 px-4 py-2 text-obsidian-950 font-semibold hover:bg-security-400">Demo buchen</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-security-400">Rechtliches</p>
        <h1 className="mb-4 text-4xl font-bold text-titanium-100">Datenschutzerklarung</h1>
        <p className="mb-12 text-sm text-titanium-500">Stand: Januar 2025</p>

        <div className="flex flex-col gap-10">
          {sections.map((s) => (
            <div key={s.title} className="border-l-2 border-security-500 pl-6">
              <h2 className="mb-3 text-lg font-semibold text-titanium-100">{s.title}</h2>
              <p className="text-titanium-400 leading-relaxed text-sm">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 border border-titanium-900 bg-obsidian-900 p-8">
          <h3 className="mb-3 text-base font-semibold text-titanium-100">Fragen zum Datenschutz?</h3>
          <p className="mb-6 text-sm text-titanium-400">Unser Datenschutzteam hilft Ihnen gerne weiter.</p>
          <Link to="/contact-sales" className="inline-block bg-security-500 px-6 py-3 text-obsidian-950 font-semibold hover:bg-security-400">Kontakt aufnehmen</Link>
        </div>
      </main>

      <footer className="border-t border-titanium-900 py-10">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between">
          <span className="text-sm text-titanium-500">2025 RealSyncDynamics.AI</span>
          <div className="flex gap-6 text-sm text-titanium-500">
            <Link to="/legal/privacy" className="hover:text-titanium-100">Datenschutz</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-100">Sub-Prozessoren</Link>
            <Link to="/contact-sales" className="hover:text-titanium-100">Kontakt</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
