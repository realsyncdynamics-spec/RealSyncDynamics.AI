import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, ArrowRight, CheckCircle2, Users, Zap, Award, TrendingUp } from 'lucide-react';

const benefits = [
  {
        icon: <Award className="h-5 w-5" />,
        title: 'White-Label-Option',
        desc: 'Brande die Plattform mit deinem Logo und deiner Domain. Deine Kunden sehen nur deine Marke.',
  },
  {
        icon: <TrendingUp className="h-5 w-5" />,
        title: 'Revenue-Share',
        desc: '20% recurring Revenue auf jede vermittelte Subscription. Monatlich, ohne Deckel.',
  },
  {
        icon: <Users className="h-5 w-5" />,
        title: 'Multi-Tenant-Management',
        desc: 'Verwalte alle deine Kunden in einem Dashboard. Billing, Quotas, Audit-Logs auf einen Blick.',
  },
  {
        icon: <Zap className="h-5 w-5" />,
        title: 'Dedicated Onboarding',
        desc: 'Wir onboarden deine ersten 3 Kunden gemeinsam. Templates, Schulung, Support-Prio.',
  },
  ];

const tiers = [
  {
        name: 'Reseller',
        price: 'Ab 199 EUR/Monat',
        desc: 'Fuer Agenturen mit 3-10 Kunden',
        features: [
                'White-Label-Domain',
                '20% Revenue-Share',
                'Bis 10 Kunden-Tenants',
                'Quarterly Business Review',
              ],
  },
  {
        name: 'Strategic Partner',
        price: 'Auf Anfrage',
        desc: 'Fuer Agenturen mit 10+ Kunden oder spezifischer Branchenfokussierung',
        features: [
                'Alles aus Reseller',
                'Custom SLA',
                'Co-Marketing',
                'API-Integration in dein Stack',
                'Dedicated Account Manager',
              ],
        highlight: true,
  },
  ];

export function Agencies() {
    return (
          <div className="min-h-screen bg-obsidian-950 text-titanium-100">
                <header className="border-b border-titanium-900 bg-obsidian-950/80 backdrop-blur-sm sticky top-0 z-40">
                        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                                  <Link to="/" className="flex items-center gap-2.5">
                                              <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
                                                            <ShieldCheck className="h-4 w-4 text-white" />
                                              </div>div>
                                              <span className="font-display font-bold text-titanium-50 tracking-tight">RealSyncDynamics.AI</span>span>
                                  </Link>Link>
                                  <Link to="/" className="flex items-center gap-1.5 text-sm text-titanium-400 hover:text-titanium-100">
                                              <ArrowLeft className="h-4 w-4" /> Zurueck
                                  </Link>Link>
                        </div>div>
                </header>header>
          
                <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 space-y-16">
                  {/* Hero */}
                        <div className="text-center space-y-5 max-w-3xl mx-auto">
                                  <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none">
                                              <Users className="h-3 w-3" /> Agentur-Partnerprogramm
                                  </div>div>
                                  <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight">
                                              Verdiene mit DSGVO-konformer KI-Compliance.
                                  </h1>h1>
                                  <p className="text-lg text-titanium-300 leading-relaxed">
                                              Als RealSyncDynamics-Partner bietest du regulierten Unternehmen eine schluesselfertige
                                              Compliance-Infrastruktur — und profitierst von monatlichem Recurring Revenue.
                                  </p>p>
                                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                                              <Link
                                                              to="/contact-sales?source=agencies_hero"
                                                              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none"
                                                            >
                                                            Partner werden <ArrowRight className="h-4 w-4" />
                                              </Link>Link>
                                              <a
                                                              href="#vorteile"
                                                              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-obsidian-900 border border-titanium-700 hover:bg-obsidian-800 text-titanium-200 font-semibold rounded-none"
                                                            >
                                                            Vorteile ansehen
                                              </a>a>
                                  </div>div>
                        </div>div>
                
                  {/* Benefits */}
                        <section id="vorteile" className="space-y-6">
                                  <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em]">Ihre Vorteile</h2>h2>
                                  <div className="grid sm:grid-cols-2 gap-4">
                                    {benefits.map((b) => (
                          <div key={b.title} className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
                                          <div className="w-10 h-10 mb-3 bg-security-900/30 border border-security-800 text-security-300 flex items-center justify-center">
                                            {b.icon}
                                          </div>div>
                                          <h3 className="font-display font-bold text-titanium-50 mb-1.5">{b.title}</h3>h3>
                                          <p className="text-sm text-titanium-400 leading-relaxed">{b.desc}</p>p>
                          </div>div>
                        ))}
                                  </div>div>
                        </section>section>
                
                  {/* Partner Tiers */}
                        <section className="space-y-6">
                                  <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em]">Partner-Modelle</h2>h2>
                                  <div className="grid sm:grid-cols-2 gap-4">
                                    {tiers.map((t) => (
                          <div
                                            key={t.name}
                                            className={`flex flex-col p-6 rounded-none border relative ${
                                                                t.highlight
                                                                  ? 'border-security-500 bg-security-950/20 ring-1 ring-security-500/20'
                                                                  : 'border-titanium-900 bg-obsidian-900'
                                            }`}
                                          >
                            {t.highlight && (
                                                              <div className="absolute -top-2.5 left-6 bg-security-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                                                                                  Empfohlen
                                                              </div>div>
                                          )}
                                          <h3 className="font-display text-xl font-bold text-titanium-50 mb-1">{t.name}</h3>h3>
                                          <p className="text-sm font-bold text-security-400 mb-1">{t.price}</p>p>
                                          <p className="text-xs text-titanium-500 mb-4">{t.desc}</p>p>
                                          <ul className="space-y-1.5 flex-1 mb-5">
                                            {t.features.map((f) => (
                                                                <li key={f} className="flex items-start gap-2 text-sm text-titanium-300 leading-snug">
                                                                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                                                  {f}
                                                                </li>li>
                                                              ))}
                                          </ul>ul>
                                          <Link
                                                              to="/contact-sales?source=agencies_tier"
                                                              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none ${
                                                                                    t.highlight
                                                                                      ? 'bg-security-500 hover:bg-security-600 text-white'
                                                                                      : 'bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200'
                                                              }`}
                                                            >
                                                            Jetzt anfragen <ArrowRight className="h-4 w-4" />
                                          </Link>Link>
                          </div>div>
                        ))}
                                  </div>div>
                        </section>section>
                
                  {/* Process */}
                        <section className="space-y-6">
                                  <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em]">Wie es funktioniert</h2>h2>
                                  <div className="grid sm:grid-cols-3 gap-4">
                                    {[
            { n: '01', title: 'Erstgespraech (30 Min)', desc: 'Wir verstehen deinen Kundenstamm und passen das Angebot an.' },
            { n: '02', title: 'Partner-Onboarding', desc: 'White-Label-Setup, Vertragsabschluss, erste 3 Kunden gemeinsam onboarden.' },
            { n: '03', title: 'Recurring Revenue', desc: 'Jeder geworbene Kunde generiert monatlichen Revenue-Share ohne Mehraufwand.' },
                        ].map((s) => (
                                        <div key={s.n} className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
                                                        <span className="font-mono text-xs font-bold text-security-400 block mb-2">{s.n}</span>span>
                                                        <h3 className="font-display font-bold text-titanium-50 mb-1.5">{s.title}</h3>h3>
                                                        <p className="text-sm text-titanium-400 leading-relaxed">{s.desc}</p>p>
                                        </div>div>
                                      ))}
                                  </div>div>
                        </section>section>
                
                  {/* CTA */}
                        <section className="text-center p-10 bg-obsidian-900 border border-titanium-900 rounded-none space-y-4">
                                  <h2 className="text-2xl font-display font-bold text-titanium-50">Bereit, DSGVO-Compliance zu monetarisieren?</h2>h2>
                                  <p className="text-titanium-300 text-sm max-w-xl mx-auto">
                                              Sprich mit uns ueber dein Agenturmodell. Keine langen Vertragsverhandlungen, kein Vorab-Investment.
                                  </p>p>
                                  <Link
                                                to="/contact-sales?source=agencies_cta"
                                                className="inline-flex items-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none"
                                              >
                                              Partner-Gespraech anfragen <ArrowRight className="h-4 w-4" />
                                  </Link>Link>
                        </section>section>
                </main>main>
          
                <footer className="border-t border-titanium-900 bg-obsidian-950 px-4 sm:px-6 py-8 mt-8">
                        <div className="max-w-6xl mx-auto flex flex-wrap gap-4 text-xs text-titanium-500 justify-center">
                                  <Link to="/" className="hover:text-titanium-300">Startseite</Link>Link>
                                  <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>Link>
                                  <Link to="/pricing" className="hover:text-titanium-300">Preise</Link>Link>
                                  <Link to="/contact-sales" className="hover:text-titanium-300">Kontakt</Link>Link>
                        </div>div>
                </footer>footer>
          </div>div>
        );
}</div>
