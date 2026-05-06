import { Link } from 'react-router-dom';

const processors = [
  {
    name: 'Supabase Inc.',
    location: 'USA (EU-Server: Frankfurt)',
    purpose: 'Datenbank, Authentifizierung, Datenspeicherung',
    legal: 'SCC (Art. 46 DSGVO)',
    link: 'https://supabase.com/privacy',
  },
  {
    name: 'Vercel Inc.',
    location: 'USA (EU-CDN verfügbar)',
    purpose: 'Hosting, Edge-Funktionen, Deployment',
    legal: 'SCC (Art. 46 DSGVO)',
    link: 'https://vercel.com/legal/privacy-policy',
  },
  {
    name: 'Cloudflare Inc.',
    location: 'USA (globales CDN)',
    purpose: 'DDoS-Schutz, CDN, DNS',
    legal: 'SCC (Art. 46 DSGVO)',
    link: 'https://www.cloudflare.com/privacypolicy/',
  },
  {
    name: 'Google LLC (Workspace)',
    location: 'USA (EU-Region verfügbar)',
    purpose: 'E-Mail, Kalender, interne Kommunikation',
    legal: 'SCC (Art. 46 DSGVO)',
    link: 'https://policies.google.com/privacy',
  },
  {
    name: 'Stripe Inc.',
    location: 'USA (EU-Entity: Stripe Payments Europe)',
    purpose: 'Zahlungsabwicklung',
    legal: 'SCC (Art. 46 DSGVO)',
    link: 'https://stripe.com/de/privacy',
  },
  {
    name: 'Resend Inc.',
    location: 'USA',
    purpose: 'Transaktionale E-Mails',
    legal: 'SCC (Art. 46 DSGVO)',
    link: 'https://resend.com/legal/privacy-policy',
  },
];

export default function SubProcessors() {
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
      <main className="mx-auto max-w-5xl px-6 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-security-400">
          Rechtliches
        </p>
        <h1 className="mb-4 text-4xl font-bold text-titanium-100">Sub-Prozessoren</h1>
        <p className="mb-4 text-titanium-400">
          Gemäß Art. 13 und 14 DSGVO informieren wir Sie über alle Dritten, denen wir
          personenbezogene Daten im Rahmen unserer Leistungserbringung übermitteln.
        </p>
        <p className="mb-12 text-sm text-titanium-500">Stand: Januar 2025 — wird bei Änderungen aktualisiert.</p>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-titanium-900 text-left text-titanium-500">
                <th className="pb-4 pr-6 font-semibold">Anbieter</th>
                <th className="pb-4 pr-6 font-semibold">Standort</th>
                <th className="pb-4 pr-6 font-semibold">Zweck</th>
                <th className="pb-4 pr-6 font-semibold">Rechtsgrundlage</th>
                <th className="pb-4 font-semibold">Datenschutz</th>
              </tr>
            </thead>
            <tbody>
              {processors.map((p) => (
                <tr
                  key={p.name}
                  className="border-b border-titanium-900 hover:bg-obsidian-900 transition-colors"
                >
                  <td className="py-4 pr-6 font-medium text-titanium-100">{p.name}</td>
                  <td className="py-4 pr-6 text-titanium-400">{p.location}</td>
                  <td className="py-4 pr-6 text-titanium-400">{p.purpose}</td>
                  <td className="py-4 pr-6 text-security-400">{p.legal}</td>
                  <td className="py-4">
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-titanium-400 underline hover:text-titanium-100 transition-colors"
                    >
                      Policy
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-16 border border-titanium-900 bg-obsidian-900 p-8">
          <h3 className="mb-3 text-base font-semibold text-titanium-100">
            Fragen zu unseren Sub-Prozessoren?
          </h3>
          <p className="mb-6 text-sm text-titanium-400">
            Bei Fragen zur Datenverarbeitung wenden Sie sich an datenschutz@realsyncdynamics.ai
          </p>
          <Link
            to="/legal/privacy"
            className="inline-block border border-titanium-900 px-6 py-3 text-titanium-300 hover:border-security-500 hover:text-titanium-100 transition-colors"
          >
            Zur Datenschutzerklärung
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
