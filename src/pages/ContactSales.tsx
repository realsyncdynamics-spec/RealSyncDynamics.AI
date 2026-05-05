import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, ArrowRight, CheckCircle2, Calendar, Mail, Building2, User } from 'lucide-react';

const sources: Record<string, string> = {
    apex_header: 'Navigation',
    apex_hero: 'Hero-Bereich',
    apex_cta: 'CTA-Bereich',
    apex_pricing_enterprise: 'Enterprise-Preisplan',
};

export function ContactSales() {
    const [params] = useSearchParams();
    const source = params.get('source') || '';
    const [submitted, setSubmitted] = useState(false);
    const [form, setForm] = useState({
          name: '',
          email: '',
          company: '',
          role: '',
          message: '',
          tier: params.get('tier') || '',
    });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: connect to Supabase edge function or Formspree
        setSubmitted(true);
  };

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
        
              <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
                      <div className="grid lg:grid-cols-2 gap-12">
                        {/* Left: Info */}
                                <div className="space-y-6">
                                  {source && sources[source] && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 border border-titanium-800 bg-obsidian-900 text-titanium-400 text-xs rounded-none">
                                        Angefragt ueber: {sources[source]}
                        </div>div>
                                            )}
                                            <div>
                                                          <p className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-2">Demo buchen</p>p>
                                                          <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 mb-3">
                                                                          30 Min. — keine Kaltakquise.
                                                          </h1>h1>
                                                          <p className="text-titanium-300 leading-relaxed">
                                                                          Wir zeigen den eu_local-Modus, das Audit-Log, einen Beispiel-Workflow und die
                                                                          DSGVO-Selfservice-API live. Du entscheidest danach.
                                                          </p>p>
                                            </div>div>
                                
                                            <div className="space-y-3">
                                              {[
          { icon: <Calendar className="h-4 w-4" />, text: 'Termin innerhalb von 48h' },
          { icon: <ShieldCheck className="h-4 w-4" />, text: 'Deine Daten werden nicht weitergegeben' },
          { icon: <CheckCircle2 className="h-4 w-4" />, text: 'Kein Sales-Druck, kein Upsell' },
                        ].map((item, i) => (
                                          <div key={i} className="flex items-center gap-3 text-sm text-titanium-300">
                                                            <div className="text-emerald-400">{item.icon}</div>div>
                                            {item.text}
                                          </div>div>
                                        ))}
                                            </div>div>
                                
                                            <div className="p-4 bg-obsidian-900 border border-titanium-900 rounded-none">
                                                          <p className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-2">Was wir zeigen</p>p>
                                                          <ul className="space-y-1.5 text-sm text-titanium-300">
                                                            {[
                            'eu_local-Modus live an deinen Daten',
                            'Audit-Log: Provider, Modell, Token, Kosten',
                            'DSGVO-Selfservice (Art. 15 + 17) in Aktion',
                            'Workflow-Demo mit echtem Trigger',
                            'Pricing & Onboarding-Prozess',
                          ].map((item) => (
                                              <li key={item} className="flex items-start gap-2">
                                                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                                {item}
                                              </li>li>
                                            ))}
                                                          </ul>ul>
                                            </div>div>
                                </div>div>
                      
                        {/* Right: Form */}
                                <div className="bg-obsidian-900 border border-titanium-900 p-6 rounded-none">
                                  {submitted ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-4">
                                        <div className="w-12 h-12 bg-emerald-900/30 border border-emerald-800 flex items-center justify-center">
                                                          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                                        </div>div>
                                        <h2 className="text-xl font-display font-bold text-titanium-50">Anfrage erhalten!</h2>h2>
                                        <p className="text-titanium-300 text-sm">Wir melden uns innerhalb von 48h mit einem Terminvorschlag.</p>p>
                                        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm text-security-400 hover:text-security-300">
                                                          <ArrowLeft className="h-4 w-4" /> Zur Startseite
                                        </Link>Link>
                        </div>div>
                      ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                                        <h2 className="font-display font-bold text-titanium-50 mb-2">Demo-Anfrage</h2>h2>
                        
                                        <div className="grid sm:grid-cols-2 gap-4">
                                                          <div className="space-y-1">
                                                                              <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider flex items-center gap-1">
                                                                                                    <User className="h-3 w-3" /> Name *
                                                                              </label>label>
                                                                              <input
                                                                                                      name="name"
                                                                                                      value={form.name}
                                                                                                      onChange={handleChange}
                                                                                                      required
                                                                                                      placeholder="Max Mustermann"
                                                                                                      className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-800 text-titanium-100 text-sm focus:outline-none focus:border-security-500 rounded-none"
                                                                                                    />
                                                          </div>div>
                                                          <div className="space-y-1">
                                                                              <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider flex items-center gap-1">
                                                                                                    <Mail className="h-3 w-3" /> E-Mail *
                                                                              </label>label>
                                                                              <input
                                                                                                      name="email"
                                                                                                      type="email"
                                                                                                      value={form.email}
                                                                                                      onChange={handleChange}
                                                                                                      required
                                                                                                      placeholder="max@firma.de"
                                                                                                      className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-800 text-titanium-100 text-sm focus:outline-none focus:border-security-500 rounded-none"
                                                                                                    />
                                                          </div>div>
                                        </div>div>
                        
                                        <div className="space-y-1">
                                                          <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider flex items-center gap-1">
                                                                              <Building2 className="h-3 w-3" /> Unternehmen *
                                                          </label>label>
                                                          <input
                                                                                name="company"
                                                                                value={form.company}
                                                                                onChange={handleChange}
                                                                                required
                                                                                placeholder="Muster GmbH"
                                                                                className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-800 text-titanium-100 text-sm focus:outline-none focus:border-security-500 rounded-none"
                                                                              />
                                        </div>div>
                        
                                        <div className="space-y-1">
                                                          <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">Branche</label>label>
                                                          <select
                                                                                name="role"
                                                                                value={form.role}
                                                                                onChange={handleChange}
                                                                                className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-800 text-titanium-100 text-sm focus:outline-none focus:border-security-500 rounded-none"
                                                                              >
                                                                              <option value="">Bitte waehlen...</option>option>
                                                                              <option value="healthtech">HealthTech / Medizin</option>option>
                                                                              <option value="legal">Legal / Kanzlei</option>option>
                                                                              <option value="fintech">FinTech / Bank / Versicherung</option>option>
                                                                              <option value="behoerde">Behoerde / Public Sector</option>option>
                                                                              <option value="other">Sonstiges</option>option>
                                                          </select>select>
                                        </div>div>
                        
                                        <div className="space-y-1">
                                                          <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">Paket-Interesse</label>label>
                                                          <select
                                                                                name="tier"
                                                                                value={form.tier}
                                                                                onChange={handleChange}
                                                                                className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-800 text-titanium-100 text-sm focus:outline-none focus:border-security-500 rounded-none"
                                                                              >
                                                                              <option value="">Noch nicht entschieden</option>option>
                                                                              <option value="bronze">Bronze (29 EUR/Monat)</option>option>
                                                                              <option value="silver">Silver (99 EUR/Monat)</option>option>
                                                                              <option value="gold">Gold (299 EUR/Monat)</option>option>
                                                                              <option value="enterprise">Enterprise (Auf Anfrage)</option>option>
                                                          </select>select>
                                        </div>div>
                        
                                        <div className="space-y-1">
                                                          <label className="text-xs font-bold text-titanium-400 uppercase tracking-wider">Nachricht / Use Case</label>label>
                                                          <textarea
                                                                                name="message"
                                                                                value={form.message}
                                                                                onChange={handleChange}
                                                                                rows={3}
                                                                                placeholder="Kurze Beschreibung deines Use Case oder spezifische Fragen..."
                                                                                className="w-full px-3 py-2 bg-obsidian-950 border border-titanium-800 text-titanium-100 text-sm focus:outline-none focus:border-security-500 rounded-none resize-none"
                                                                              />
                                        </div>div>
                        
                                        <p className="text-[11px] text-titanium-500">
                                                          Mit dem Absenden stimmst du der Verarbeitung deiner Daten gemaess unserer{' '}
                                                          <Link to="/legal/privacy" className="text-security-400 hover:underline">Datenschutzerklaerung</Link>Link> zu.
                                        </p>p>
                        
                                        <button
                                                            type="submit"
                                                            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none"
                                                          >
                                                          Demo anfragen <ArrowRight className="h-4 w-4" />
                                        </button>button>
                        </form>form>
                                            )}
                                </div>div>
                      </div>div>
              </main>main>
        
              <footer className="border-t border-titanium-900 bg-obsidian-950 px-4 sm:px-6 py-8 mt-8">
                      <div className="max-w-6xl mx-auto flex flex-wrap gap-4 text-xs text-titanium-500 justify-center">
                                <Link to="/" className="hover:text-titanium-300">Startseite</Link>Link>
                                <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>Link>
                                <Link to="/pricing" className="hover:text-titanium-300">Preise</Link>Link>
                                <a href="mailto:privacy@realsyncdynamicsai.de" className="hover:text-titanium-300">privacy@...</a>a>
                      </div>div>
              </footer>footer>
        </div>div>
      );
}</div>
