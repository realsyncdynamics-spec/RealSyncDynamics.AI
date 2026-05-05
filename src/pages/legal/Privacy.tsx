import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export function Privacy() {
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
          
                <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-10">
                        <div>
                                  <p className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-2">Rechtliches</p>p>
                                  <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 mb-4">Datenschutzerklaerung</h1>h1>
                                  <p className="text-sm text-titanium-400">Stand: Mai 2026 - RealSync Dynamics GmbH (in Gruendung)</p>p>
                        </div>div>
                
                        <section className="space-y-3">
                                  <h2 className="text-lg font-display font-bold text-titanium-50">1. Verantwortlicher</h2>h2>
                                  <div className="p-4 bg-obsidian-900 border border-titanium-900 text-sm text-titanium-300 space-y-1">
                                              <p>RealSync Dynamics (i.G.)</p>p>
                                              <p>E-Mail: <a href="mailto:privacy@realsyncdynamicsai.de" className="text-security-400 hover:underline">privacy@realsyncdynamicsai.de</a>a></p>p>
                                  </div>div>
                        </section>section>
                
                        <section className="space-y-3">
                                  <h2 className="text-lg font-display font-bold text-titanium-50">2. Erhobene Daten und Zwecke</h2>h2>
                                  <div className="space-y-2 text-sm text-titanium-300">
                                              <div className="p-4 bg-obsidian-900 border border-titanium-900">
                                                            <h3 className="font-bold text-titanium-100 mb-1">2.1 Besuchsdaten (Server-Log)</h3>h3>
                                                            <p>IP-Adresse (anonymisiert nach 24h), Zeitstempel, aufgerufene URL, Browser-Typ. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.</p>p>
                                              </div>div>
                                              <div className="p-4 bg-obsidian-900 border border-titanium-900">
                                                            <h3 className="font-bold text-titanium-100 mb-1">2.2 Kontaktformular / Demo-Anfrage</h3>h3>
                                                            <p>Name, E-Mail, Unternehmen, Nachricht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Speicherdauer: 3 Jahre.</p>p>
                                              </div>div>
                                              <div className="p-4 bg-obsidian-900 border border-titanium-900">
                                                            <h3 className="font-bold text-titanium-100 mb-1">2.3 Account und Plattform-Nutzung</h3>h3>
                                                            <p>E-Mail (Magic-Link-Auth), Tenant-ID, AI-Aufruf-Metadaten, Token-Zaehlung, Kosten. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>p>
                                              </div>div>
                                  </div>div>
                        </section>section>
                
                        <section className="space-y-3">
                                  <h2 className="text-lg font-display font-bold text-titanium-50">3. Datenresidenz und Hosting</h2>h2>
                                  <p className="text-sm text-titanium-300">
                                              Alle Daten werden ausschliesslich auf Servern innerhalb der EU/EWR verarbeitet und gespeichert.
                                              Infrastruktur: Supabase EU-Region (Frankfurt), GitHub Pages (nur statische Assets ohne personenbezogene Daten).
                                  </p>p>
                        </section>section>
                
                        <section className="space-y-3">
                                  <h2 className="text-lg font-display font-bold text-titanium-50">4. Weitergabe an Dritte / Sub-Prozessoren</h2>h2>
                                  <p className="text-sm text-titanium-300">
                                              Eine vollstaendige Liste aller Sub-Prozessoren finden Sie unter{' '}
                                              <Link to="/legal/sub-processors" className="text-security-400 hover:underline">Sub-Prozessoren</Link>Link>.
                                              Daten werden nicht verkauft oder fuer Werbezwecke weitergegeben.
                                  </p>p>
                        </section>section>
                
                        <section className="space-y-3">
                                  <h2 className="text-lg font-display font-bold text-titanium-50">5. Ihre Rechte (Art. 15-22 DSGVO)</h2>h2>
                                  <div className="grid sm:grid-cols-2 gap-2 text-sm text-titanium-300">
                                    {[
                          ['Art. 15', 'Auskunft ueber gespeicherte Daten'],
                          ['Art. 16', 'Berichtigung unrichtiger Daten'],
                          ['Art. 17', 'Loeschung (Recht auf Vergessenwerden)'],
                          ['Art. 18', 'Einschraenkung der Verarbeitung'],
                          ['Art. 20', 'Datenuebertragbarkeit'],
                          ['Art. 21', 'Widerspruch gegen Verarbeitung'],
                        ].map(([art, desc]) => (
                                        <div key={art} className="p-3 bg-obsidian-900 border border-titanium-900">
                                                        <span className="text-emerald-400 font-bold">{art}</span>span> - {desc}
                                        </div>div>
                                      ))}
                                  </div>div>
                                  <p className="text-sm text-titanium-400">
                                              Anfragen an: <a href="mailto:privacy@realsyncdynamicsai.de" className="text-security-400 hover:underline">privacy@realsyncdynamicsai.de</a>a>
                                  </p>p>
                        </section>section>
                
                        <section className="space-y-3">
                                  <h2 className="text-lg font-display font-bold text-titanium-50">6. Cookies und Tracking</h2>h2>
                                  <p className="text-sm text-titanium-300">
                                              Diese Website verwendet keine Tracking-Cookies und keine Analytics-Dienste.
                                              Technisch notwendige Session-Cookies werden nur nach Login gesetzt.
                                  </p>p>
                        </section>section>
                </main>main>
          
                <footer className="border-t border-titanium-900 bg-obsidian-950 px-4 sm:px-6 py-8 mt-8">
                        <div className="max-w-6xl mx-auto flex flex-wrap gap-4 text-xs text-titanium-500 justify-center">
                                  <Link to="/" className="hover:text-titanium-300">Startseite</Link>Link>
                                  <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Prozessoren</Link>Link>
                                  <Link to="/pricing" className="hover:text-titanium-300">Preise</Link>Link>
                                  <Link to="/contact-sales" className="hover:text-titanium-300">Kontakt</Link>Link>
                        </div>div>
                </footer>footer>
          </div>div>
        );
}</div>
