import { Link } from 'react-router-dom';

const tiers = [
  { name: 'Bronze Partner', rev: '< 50k EUR/Monat', commission: '15%', support: 'E-Mail Support', highlight: false },
  { name: 'Silver Partner', rev: '50k - 200k EUR/Monat', commission: '20%', support: 'Priority Support + Slack', highlight: true },
  { name: 'Gold Partner', rev: '> 200k EUR/Monat', commission: '25%', support: 'Dedicated Partner Manager', highlight: false },
];

const benefits = [
  { title: 'Co-Marketing', desc: 'Gemeinsame Kampagnen, Co-Branding und Feature in unserem Partner-Verzeichnis.' },
  { title: 'Technische Integration', desc: 'API-Zugang, White-Label-Option und Sandbox-Umgebung fuer Ihre Entwickler.' },
  { title: 'Revenue Share', desc: 'Monatliche Auszahlung auf Basis verifizierter Netto-ARR Ihrer vermittelten Kunden.' },
  { title: 'Training', desc: 'Exklusive Schulungen, Zertifikate und Zugang zu internen Produktroadmaps.' },
];

export function Agencies() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="sticky top-0 z-50 border-b border-titanium-900 bg-obsidian-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-titanium-100">
            RealSync<span className="text-security-400">Dynamics</span>.AI
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-titanium-300 md:flex">
            <Link to="/agencies" className="text-security-400">Agenturen</Link>
            <Link to="/pricing" className="hover:text-titanium-100">Preise</Link>
            <Link to="/dashboard" className="hover:text-titanium-100">Login</Link>
            <Link to="/contact-sales" className="bg-security-500 px-4 py-2 text-obsidian-950 font-semibold hover:bg-security-400">Demo buchen</Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-titanium-900 py-24 text-center">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-security-400">Partnerprogramm</p>
          <h1 className="mb-6 text-5xl font-bold text-titanium-100">Wachsen Sie gemeinsam mit RealSyncDynamics.AI</h1>
          <p className="mb-10 text-xl text-titanium-400">Als zertifizierter Partner erhalten Sie exklusive Provisionen, Marketing-Support und technischen Zugang.</p>
          <Link to="/contact-sales?source=agencies_hero" className="inline-block bg-security-500 px-8 py-4 text-obsidian-950 font-bold hover:bg-security-400">Partnerschaft anfragen</Link>
        </div>
      </section>

      <section className="border-b border-titanium-900 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-titanium-100">Was Sie als Partner erhalten</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div key={b.title} className="border border-titanium-900 bg-obsidian-900 p-6">
                <h3 className="mb-3 text-lg font-semibold text-security-400">{b.title}</h3>
                <p className="text-sm text-titanium-400">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-titanium-900 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-titanium-100">Partner-Stufen</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {tiers.map((t) => (
              <div key={t.name} className={['border p-8 flex flex-col gap-4', t.highlight ? 'border-security-500 bg-obsidian-900' : 'border-titanium-900 bg-obsidian-950'].join(' ')}>
                {t.highlight && <span className="text-xs font-bold uppercase tracking-widest text-security-400">Empfohlen</span>}
                <h3 className="text-xl font-bold text-titanium-100">{t.name}</h3>
                <p className="text-sm text-titanium-400">Umsatz: {t.rev}</p>
                <p className="text-3xl font-bold text-security-400">{t.commission}</p>
                <p className="text-sm text-titanium-400">{t.support}</p>
                <Link to="/contact-sales?source=agencies_tier" className="mt-auto block bg-security-500 py-3 text-center text-obsidian-950 font-semibold hover:bg-security-400">Jetzt bewerben</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="mb-6 text-3xl font-bold text-titanium-100">Bereit, Partner zu werden?</h2>
          <Link to="/contact-sales?source=agencies_cta" className="inline-block bg-security-500 px-8 py-4 text-obsidian-950 font-bold hover:bg-security-400">Jetzt Kontakt aufnehmen</Link>
        </div>
      </section>

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
