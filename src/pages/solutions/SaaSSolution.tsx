import { Link } from 'react-router-dom';
import { ArrowRight, Check, Shield, Zap, BarChart3, Lightbulb } from 'lucide-react';
import { Logo } from '../../components/Logo';

export function SaaSSolution() {
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
          <div className="inline-block px-3 py-1 bg-security-500 bg-opacity-10 border border-security-500 text-security-400 text-xs font-bold rounded-none mb-6">
            ✦ SaaS & Tech-Unternehmen
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-5xl lg:text-6xl text-titanium-50 tracking-tight leading-[1.05] mb-6">
            EU AI Act & DSGVO automatisiert
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mb-8">
            Du bietest ein AI-Produkt oder SaaS? RealSyncDynamics.AI dokumentiert deine KI-Systeme,
            prüft die Compliance laufend und liefert Evidence für Regulatoren — ohne aufwendige Compliance-Teams.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/audit?source=saas-hero"
              className="surface-mono px-6 py-3 font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              Kostenlos auditen <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact-sales?product=saas-governance"
              className="border border-silver-400 px-6 py-3 font-bold text-sm text-silver-300 hover:text-titanium-50 inline-flex items-center justify-center gap-2"
            >
              Für SaaS-Anbieter <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700 bg-obsidian-850">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h2 className="font-display font-bold text-2xl text-security-500 mb-6">Das Problem</h2>
            <ul className="space-y-4 text-silver-300">
              {[
                'Dein SaaS nutzt mehrere AI-Modelle (OpenAI, Anthropic, Google, Ollama)',
                'Die Behörden fordern: Wo lädt ihr die Daten hoch? Wo werden sie verarbeitet?',
                'Euer Team dokumentiert alles manuell in Excel/Confluence',
                'Regelmäßige DSGVO- und AI-Act-Prüfungen sind teuer und fehlerträchtig',
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-security-500 flex-shrink-0 mt-1">⚠</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl text-security-500 mb-6">Unsere Lösung</h2>
            <ul className="space-y-4 text-silver-300">
              {[
                'Automatische KI-System-Inventarisierung und Tracking',
                'Laufende Compliance-Dokumentation für DSGVO + EU AI Act',
                'Evidence Vault: Jede Prüfung ist signiert, unveränderlich, auditierbar',
                'Branchen-Agenten prüfen deine Governance kontinuierlich',
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <Check className="h-5 w-5 text-security-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 text-center mb-12">
            Typische Use Cases für SaaS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: Zap,
                title: 'Chat-SaaS mit proprietärem Model',
                desc: 'Dokumentiere, dass dein Model nur mit EU-gehosteten Daten trainiert wird',
              },
              {
                icon: BarChart3,
                title: 'Analytics-Tool mit ML-Insights',
                desc: 'Zeige, dass dein Algorithmus Fair & Transparent ist (EU AI Act)',
              },
              {
                icon: Shield,
                title: 'Datenverarbeitung mit Third-Party-AI',
                desc: 'Trackbare Dokumentation deiner Vendor-Verträge (Sub-Processors)',
              },
              {
                icon: Lightbulb,
                title: 'Automation & Workflow-Engine',
                desc: 'Prüfe automatisch, welche Workflows reguliert sind, welche nicht',
              },
            ].map((useCase, i) => {
              const Icon = useCase.icon;
              return (
                <div key={i} className="border border-silver-700 p-6 hover:border-silver-500 transition">
                  <Icon className="h-8 w-8 text-security-500 mb-4" />
                  <h3 className="font-bold text-titanium-50 mb-2">{useCase.title}</h3>
                  <p className="text-silver-400 text-sm">{useCase.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700 bg-obsidian-850">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 text-center mb-12">
            Warum RealSyncDynamics.AI für SaaS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Automatisiert',
                points: [
                  'KI-Systeme selbstständig erfassen',
                  'Laufende Compliance-Checks ohne Team',
                  'Alerts statt Überraschungen',
                ],
              },
              {
                title: 'Nachweisbar',
                points: [
                  'Evidence Vault mit Signaturen',
                  'Audit Trail für Regulatoren',
                  'Reports in 5 Minuten',
                ],
              },
              {
                title: 'Skalierbar',
                points: [
                  'Von 1 bis 100+ KI-Systeme',
                  'Multi-Tenant fähig',
                  'API für deine Infrastruktur',
                ],
              },
            ].map((section, i) => (
              <div key={i}>
                <h3 className="font-bold text-titanium-50 mb-4">{section.title}</h3>
                <ul className="space-y-2 text-sm text-silver-400">
                  {section.points.map((point, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="text-security-500">→</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing for SaaS */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-6">
            SaaS-Paket: Professional Governance
          </h2>
          <div className="border border-silver-700 p-8 bg-obsidian-900 rounded-none mb-8">
            <div className="font-display font-bold text-4xl text-titanium-50 mb-2">€149/Monat</div>
            <p className="text-silver-400 mb-6">Perfekt für SaaS-Anbieter mit 1-10 Websites/Produkten</p>
            <ul className="space-y-3 text-sm text-silver-300 mb-8 max-w-lg mx-auto">
              {[
                'KI-System-Inventar (unbegrenzt)',
                'AI-Act-Klassifikation',
                'DSGVO-Laufzeit-Monitoring',
                'Evidence Vault für alle Prüfungen',
                'Team-Zugang (5 Nutzer)',
                'API & Webhooks',
              ].map((feature, i) => (
                <li key={i} className="flex gap-2">
                  <Check className="h-4 w-4 text-security-500 flex-shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
            <button className="surface-mono px-8 py-3 font-bold">Jetzt starten</button>
          </div>

          <p className="text-silver-400 text-sm mb-6">
            Für größere Deployments? Skaliere auf <Link to="/governance-os-pricing" className="text-security-500 hover:text-security-400">Governance OS</Link> oder frag <Link to="/contact-sales?product=saas" className="text-security-500 hover:text-security-400">Enterprise an</Link>.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-silver-700">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-xl text-titanium-50 mb-4">
            Bereit für EU-compliant KI?
          </h2>
          <p className="text-silver-300 mb-8">
            Lass uns in 30 Minuten klären, ob RealSyncDynamics.AI für dein SaaS-Produkt passt.
          </p>
          <Link
            to="/contact-sales?product=saas&source=solution-page"
            className="surface-mono px-8 py-3 font-bold inline-flex items-center gap-2"
          >
            Enterprise anfragen <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
