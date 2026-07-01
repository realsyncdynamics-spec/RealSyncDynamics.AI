import { Link } from 'react-router-dom';
import { ArrowRight, Check, Globe, Users, TrendingUp, Lock } from 'lucide-react';
import { Logo } from '../../components/Logo';

export function AgenciesSolution() {
  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      {/* Top bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-silver-700">
        <Link to="/" className="inline-flex items-center gap-2">
          <Logo size={28} iconOnly />
          <span className="font-display font-bold text-titanium-50">RealSyncDynamics.AI</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-8 text-sm">
          <Link to="/solutions/saas" className="text-silver-300 hover:text-titanium-50">
            SaaS
          </Link>
          <Link to="/solutions/agencies" className="text-silver-300 hover:text-titanium-50">
            Agenturen
          </Link>
          <Link to="/governance-os-pricing" className="text-silver-300 hover:text-titanium-50">
            Preise
          </Link>
          <Link to="/contact-sales" className="surface-mono px-4 py-2 text-sm font-bold">
            Kontakt
          </Link>
        </nav>
      </div>

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-20 flex-1 flex flex-col justify-center">
        <div className="max-w-4xl mx-auto w-full">
          <div className="inline-block px-3 py-1 bg-violet-500 bg-opacity-10 border border-violet-500 text-violet-400 text-xs font-bold rounded-none mb-6">
            ✦ Agenturen & White-Label
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl lg:text-6xl text-titanium-50 tracking-tight leading-[1.05] mb-6">
            Neue Einnahmequelle: Governance für deine Kunden
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mb-8">
            RealSyncDynamics.AI ist die weiße Bluse für deine Agentur: Skaliere dein Governance-Angebot
            ohne komplexe interne Entwicklung. Branding, API, Multi-Tenant — alles ist bereit.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/audit?source=agency-hero"
              className="surface-mono px-6 py-3 font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              Kostenlos auditen <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact-sales?product=agency-white-label"
              className="border border-silver-400 px-6 py-3 font-bold text-sm text-silver-300 hover:text-titanium-50 inline-flex items-center justify-center gap-2"
            >
              Für Agenturen <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Your Situation */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700 bg-obsidian-850">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-10 text-center">
            Typisches Agentur-Szenario
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: 'Du betreust 10-50 Kunden-Websites',
                desc: 'SEO, Web, Performance — aber keine spezialisierten Compliance-Tools',
              },
              {
                icon: TrendingUp,
                title: 'Deine Kunden fragen nach DSGVO-Compliance',
                desc: 'Du weißt, dass Compliance ein Upsell ist, machst aber wenig damit',
              },
              {
                icon: Lock,
                title: 'Die Dokumentation ist manuell',
                desc: 'Excels, PDFs, E-Mail-Attachments — kein System, kein Evidence',
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="border border-silver-700 p-6">
                  <Icon className="h-8 w-8 text-violet-400 mb-4" />
                  <h3 className="font-bold text-titanium-50 mb-2">{item.title}</h3>
                  <p className="text-silver-400 text-sm">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 text-center mb-4">
            RealSyncDynamics.AI für Agenturen
          </h2>
          <p className="text-silver-400 text-center mb-12 max-w-2xl mx-auto">
            Governance-Automatisierung für deine Kunden — ohne Entwicklung, ohne Overhead. <br />
            <strong>White-Label, Multi-Tenant, API-ready.</strong>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: 'White-Label Dashboard',
                desc: 'Dein Logo, deine Farben, deine Domain (z.B. governance.deintagentur.de)',
                icon: Globe,
              },
              {
                title: 'Multi-Kunden-Portal',
                desc: 'Verwalte 10, 50 oder 100 Kunden-Websites aus einer Zentrale',
                icon: Users,
              },
              {
                title: 'Automatische Scans',
                desc: 'Deine Kunden sehen täglich, ob DSGVO + AI-Act eingehalten werden',
                icon: TrendingUp,
              },
              {
                title: 'Audit-Ready',
                desc: 'Alle Reports signiert, alle Logs im Evidence Vault — bereit für Audits',
                icon: Lock,
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="border border-violet-400 border-opacity-30 p-6 bg-obsidian-900">
                  <Icon className="h-6 w-6 text-violet-400 mb-3" />
                  <h3 className="font-bold text-titanium-50 mb-2">{item.title}</h3>
                  <p className="text-silver-400 text-sm">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Revenue Model */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700 bg-obsidian-850">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-10 text-center">
            Dein Revenue-Modell
          </h2>

          <div className="space-y-6">
            {[
              {
                scenario: 'Szenario 1: Reseller',
                model: 'Du nutzt RealSyncDynamics.AI, stellst den Kunden deine Domain vor',
                pricing: 'Dein Einkaufspreis: €99/Monat/Kunde · Dein Verkauf: €199-249/Monat',
                margin: 'Verdopplung der Governance-Revenue pro Kunde',
              },
              {
                scenario: 'Szenario 2: Sub-Agentur',
                model: 'Du verrechnest an Deine Kunden, RealSyncDynamics.AI rechnet mit dir ab',
                pricing: 'RealSyncDynamics.AI-Anteil: 30-40% deines Verkaufspreises',
                margin: 'Du bleibt Ansprechpartner, wir machen das Backend',
              },
              {
                scenario: 'Szenario 3: Embedded',
                model: 'Tiefe API-Integration in dein eigenes Kundenportal',
                pricing: 'Custom Revenue-Share (5-10 Kunden mindestens)',
                margin: 'Fullstack-Governance unter deinem Brand',
              },
            ].map((item, i) => (
              <div key={i} className="border border-silver-700 p-6">
                <div className="font-bold text-violet-400 text-sm uppercase tracking-wider mb-2">
                  {item.scenario}
                </div>
                <h3 className="font-bold text-titanium-50 mb-3">{item.model}</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-silver-400">
                    <span className="text-silver-200 font-bold">Preismodell:</span> {item.pricing}
                  </p>
                  <p className="text-security-400">
                    <span className="text-security-300 font-bold">Impact:</span> {item.margin}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing for Agencies */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-6">
            Agency-Paket: Professional Governance
          </h2>
          <div className="border border-silver-700 p-8 bg-obsidian-900 rounded-none mb-8">
            <div className="font-display font-bold text-4xl text-titanium-50 mb-2">€149/Monat</div>
            <p className="text-silver-400 mb-6">für die erste Website/das erste Projekt deiner Agentur</p>
            <ul className="space-y-3 text-sm text-silver-300 mb-8 max-w-lg mx-auto">
              {[
                'Weiße Bluse (dein Logo, deine Domain)',
                'bis zu 10 Kunden-Domains',
                'DSGVO + AI-Act Monitoring',
                'Evidence Vault',
                'Team-Zugang (5 Nutzer)',
                'API zum Einbau in dein Portal',
                'Reseller-Support',
              ].map((feature, i) => (
                <li key={i} className="flex gap-2">
                  <Check className="h-4 w-4 text-violet-400 flex-shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
            <button className="surface-mono px-8 py-3 font-bold">Jetzt starten</button>
          </div>

          <p className="text-silver-400 text-sm">
            Bist du bereit für 50+ Kunden-Websites? Skaliere auf <strong>Scale €1.999/Monat</strong> oder frag <Link to="/contact-sales?product=agency&tier=scale" className="text-security-500 hover:text-security-400">Enterprise an</Link>.
          </p>
        </div>
      </section>

      {/* Implementation */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700 bg-obsidian-850">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-2xl text-titanium-50 text-center mb-12">
            Implementation: 4 Wochen to Go-Live
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                week: 'Woche 1',
                step: 'Kickoff & Setup',
                tasks: ['API-Keys generieren', 'Domain-Config', 'Team-Zugang'],
              },
              {
                week: 'Woche 2',
                step: 'Branding & Test',
                tasks: ['Logo/Farben konfigurieren', 'Test-Kunden importieren', 'API testen'],
              },
              {
                week: 'Woche 3',
                step: 'Integration',
                tasks: ['Portal-Integration (oder iFrame)', 'Webhook-Setup', 'Support-Onboarding'],
              },
              {
                week: 'Woche 4',
                step: 'Go-Live',
                tasks: ['Live-Kunden migrieren', 'Support rund um die Uhr', 'Erste Scans'],
              },
            ].map((phase, i) => (
              <div key={i} className="border border-silver-700 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-violet-400 mb-2">
                  {phase.week}
                </div>
                <h3 className="font-bold text-titanium-50 mb-3">{phase.step}</h3>
                <ul className="space-y-1 text-xs text-silver-400">
                  {phase.tasks.map((task, j) => (
                    <li key={j}>• {task}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-xl text-titanium-50 mb-4">
            Bereit für White-Label Governance?
          </h2>
          <p className="text-silver-300 mb-8">
            Lass uns klären, welches Modell für deine Agentur passt.
            Reseller, Sub-Agentur oder Embedded — alles ist möglich.
          </p>
          <Link
            to="/contact-sales?product=agency&source=solution-page"
            className="surface-mono px-8 py-3 font-bold inline-flex items-center gap-2"
          >
            Für Agenturen anfragen <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
