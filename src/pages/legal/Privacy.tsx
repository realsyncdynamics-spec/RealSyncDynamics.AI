import { Link } from 'react-router-dom';

const sections = [
  {
    title: '1. Verantwortlicher',
    body: 'Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist: RealSyncDynamics.AI GmbH, Musterstraße 1, 10115 Berlin, Deutschland. E-Mail: datenschutz@realsyncdynamics.ai',
  },
  {
    title: '2. Erhebung und Speicherung personenbezogener Daten',
    body: 'Wir erheben personenbezogene Daten, wenn Sie unsere Website besuchen, ein Formular ausfüllen oder sich für unseren Service registrieren. Dazu gehören: Name, E-Mail-Adresse, Unternehmen, Telefonnummer sowie technische Daten wie IP-Adresse und Browser-Informationen.',
  },
  {
    title: '3. Zweck der Datenverarbeitung',
    body: 'Ihre Daten werden ausschließlich für folgende Zwecke verarbeitet: Bereitstellung und Verbesserung unserer Dienste, Beantwortung von Anfragen, Erfüllung vertraglicher Pflichten sowie — mit Ihrer Einwilligung — für Marketing-Kommunikation.',
  },
  {
    title: '4. Rechtsgrundlagen',
    body: 'Die Verarbeitung erfolgt auf Basis von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung), Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) sowie Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), wo zutreffend.',
  },
  {
    title: '5. Weitergabe von Daten',
    body: 'Wir geben Ihre Daten nicht an Dritte weiter, es sei denn, dies ist zur Vertragserfüllung erforderlich, gesetzlich vorgeschrieben oder Sie haben ausdrücklich eingewilligt. Eine Liste unserer Sub-Prozessoren finden Sie unter /legal/sub-processors.',
  },
  {
    title: '6. Datenspeicherung',
    body: 'Wir speichern Ihre Daten nur so lange, wie es für die genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen. Anschließend werden die Daten sicher gelöscht.',
  },
  {
    title: '7. Ihre Rechte',
    body: 'Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO), Datenübertragbarkeit (Art. 20 DSGVO) sowie Widerspruch (Art. 21 DSGVO). Zur Ausübung Ihrer Rechte wenden Sie sich an datenschutz@realsyncdynamics.ai.',
  },
  {
    title: '8. Cookies',
    body: 'Wir verwenden technisch notwendige Cookies für den Betrieb der Website sowie optionale Analyse-Cookies, sofern Sie eingewilligt haben. Sie können Cookies in Ihren Browser-Einstellungen jederzeit deaktivieren.',
  },
  {
    title: '9. Kontakt zum Datenschutzbeauftragten',
    body: 'Bei Fragen zum Datenschutz wenden Sie sich bitte an: datenschutz@realsyncdynamics.ai',
  },
  {
    title: '10. Beschwerderecht',
    body: 'Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Die zuständige Behörde ist die Berliner Beauftragte für Datenschutz und Informationsfreiheit, Friedrichstr. 219, 10969 Berlin.',
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-titanium-900 bg-obsidian-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-titanium-100">
              RealSync<span className="text-security-400">Dynamics</span>.AI
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-titanium-300 md:flex">
            <Link to="/agencies" className="hover:text-titanium-100 transition-colors">Agenturen</Link>
            <Link to="/pricing" className="hover:text-titanium-100 transition-colors">Preise</Link>
            <Link to="/dashboard" className="hover:text-titanium-100 transition-colors">Login</Link>
            <Link
              to="/contact-sales"
              className="bg-security-500 px-4 py-2 text-obsidian-950 font-semibold hover:bg-security-400 transition-colors"
            >
              Demo buchen
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-security-400">
          Rechtliches
        </p>
        <h1 className="mb-4 text-4xl font-bold text-titanium-100">Datenschutzerklärung</h1>
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
          <h3 className="mb-3 text-base font-semibold text-titanium-100">
            Fragen zum Datenschutz?
          </h3>
          <p className="mb-6 text-sm text-titanium-400">
            Unser Datenschutzteam hilft Ihnen gerne weiter.
          </p>
          <Link
            to="/contact-sales"
            className="inline-block bg-security-500 px-6 py-3 text-obsidian-950 font-semibold hover:bg-security-400 transition-colors"
          >
            Kontakt aufnehmen
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-titanium-900 py-10">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm text-titanium-500">
            © 2025 RealSyncDynamics.AI — Alle Rechte vorbehalten
          </span>
          <div className="flex gap-6 text-sm text-titanium-500">
            <Link to="/legal/privacy" className="hover:text-titanium-100 transition-colors">Datenschutz</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-100 transition-colors">Sub-Prozessoren</Link>
            <Link to="/contact-sales" className="hover:text-titanium-100 transition-colors">Kontakt</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
