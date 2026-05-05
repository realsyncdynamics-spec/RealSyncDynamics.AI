import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, CheckCircle2, ExternalLink } from 'lucide-react';

const processors = [
  {
        name: 'Supabase Inc.',
        purpose: 'Datenbank, Auth, Storage (PostgreSQL + Edge Functions)',
        location: 'EU (Frankfurt, AWS eu-central-1)',
        dpa: 'https://supabase.com/privacy',
        status: 'aktiv',
  },
  {
        name: 'Stripe Inc.',
        purpose: 'Zahlungsabwicklung, Rechnungsstellung, metered Billing',
        location: 'EU (Stripe Payments Europe Ltd., Dublin)',
        dpa: 'https://stripe.com/de/privacy',
        status: 'aktiv',
  },
  {
        name: 'Anthropic PBC',
        purpose: 'AI-Inferenz (nur im cloud-Modus, mit AVV)',
        location: 'USA (SCCs + AVV)',
        dpa: 'https://www.anthropic.com/legal/privacy',
        status: 'optional',
  },
  {
        name: 'Google LLC (Vertex AI)',
        purpose: 'AI-Inferenz (nur im cloud-Modus, mit AVV)',
        location: 'EU (europe-west3) oder USA (SCCs)',
        dpa: 'https://cloud.google.com/terms/data-processing-addendum',
        status: 'optional',
  },
  {
        name: 'Ollama / eigener EU-Server',
        purpose: 'AI-Inferenz im eu_local-Modus (kein Datentransfer zu US-Providern)',
        location: 'EU (Hostinger DE / Hetzner DE)',
        dpa: 'Eigenbetrieb',
        status: 'aktiv',
  },
  {
        name: 'GitHub Inc. (Microsoft)',
        purpose: 'Hosting statischer Frontend-Assets (keine personenbezogenen Daten)',
        location: 'USA (SCCs) - nur statische Files',
        dpa: 'https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement',
        status: 'aktiv',
  },
  ];

export function SubProcessors() {
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
          
                <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16 space-y-8">
                        <div>
                                  <p className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-2">Rechtliches</p>p>
                                  <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 mb-3">Sub-Prozessoren</h1>h1>
                                  <p className="text-sm text-titanium-400 max-w-2xl">
                                              Gemaess DSGVO Art. 28 Abs. 2 informieren wir transparent ueber alle Sub-Auftragsverarbeiter.
                                              Stand: Mai 2026. Aenderungen werden mit 30 Tagen Vorlauf per E-Mail angekuendigt.
                                  </p>p>
                        </div>div>
                
                        <div className="p-4 bg-emerald-950/20 border border-emerald-900 rounded-none">
                                  <div className="flex items-start gap-2">
                                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                              <div className="text-sm text-emerald-300">
                                                            <strong>EU-Datenresidenz-Garantie:</strong>strong> Im eu_local-Modus werden keine Daten an US-KI-Anbieter
                                                            uebertragen. Alle Verarbeitungen erfolgen auf EU-Servern.
                                              </div>div>
                                  </div>div>
                        </div>div>
                
                        <div className="space-y-3">
                          {processors.map((p) => (
                        <div key={p.name} className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
                                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                      <div className="flex-1 space-y-1.5">
                                                                        <div className="flex items-center gap-2">
                                                                                            <h3 className="font-display font-bold text-titanium-50">{p.name}</h3>h3>
                                                                                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-none ${
                                                p.status === 'aktiv'
                                                  ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-800'
                                                  : 'bg-amber-900/30 text-amber-300 border border-amber-800'
                        }`}>
                                                                                              {p.status}
                                                                                              </span>span>
                                                                        </div>div>
                                                                        <p className="text-sm text-titanium-300">{p.purpose}</p>p>
                                                                        <p className="text-xs text-titanium-500">Standort: {p.location}</p>p>
                                                      </div>div>
                                        {p.dpa !== 'Eigenbetrieb' && (
                                            <a
                                                                  href={p.dpa}
                                                                  target="_blank"
                                                                  rel="noopener noreferrer"
                                                                  className="flex items-center gap-1 text-xs text-security-400 hover:text-security-300 whitespace-nowrap"
                                                                >
                                                                AVV / DPA <ExternalLink className="h-3 w-3" />
                                            </a>a>
                                                      )}
                                      </div>div>
                        </div>div>
                      ))}
                        </div>div>
                
                        <div className="p-4 bg-obsidian-900 border border-titanium-900 text-sm text-titanium-400 space-y-2">
                                  <p className="font-bold text-titanium-200">Aenderungsbenachrichtigung</p>p>
                                  <p>
                                              Neue oder ersetzende Sub-Prozessoren werden mindestens 30 Tage vor Aktivierung per E-Mail an alle
                                              registrierten Administratoren kommuniziert. Widerspruchsrecht gemaess AVV bleibt bestehen.
                                  </p>p>
                                  <p>
                                              Fragen: <a href="mailto:privacy@realsyncdynamicsai.de" className="text-security-400 hover:underline">privacy@realsyncdynamicsai.de</a>a>
                                  </p>p>
                        </div>div>
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
