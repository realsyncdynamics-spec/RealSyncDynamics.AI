import { useState } from 'react';
import { ChevronDown, Mail, Github } from 'lucide-react';

export const RealSyncDynamicsLanding = () => {
  const [activeSection, setActiveSection] = useState(0);

  const sections = [
    'Hero',
    'Was wir bieten',
    'Was wir können',
    'Was sonst keiner kann',
    'Roadmap',
    'Preise',
    'Service',
    'Impressum',
    'AGB',
    'Kontakt',
  ];

  const scrollToSection = (index: number) => {
    const element = document.getElementById(`section-${index}`);
    element?.scrollIntoView({ behavior: 'smooth' });
    setActiveSection(index);
  };

  return (
    <div className="bg-gradient-to-b from-slate-950 to-slate-900 text-titanium">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-obsidian/95 border-b border-titanium/20 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-security-blue">RealSyncDynamics.AI</h1>
            <div className="flex gap-4">
              <a href="mailto:realsyncdynamics@gmail.com" className="hover:text-security-blue transition">
                <Mail size={20} />
              </a>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {sections.map((section, idx) => (
              <button
                key={idx}
                onClick={() => scrollToSection(idx)}
                className={`px-4 py-2 rounded text-sm whitespace-nowrap transition ${
                  activeSection === idx
                    ? 'bg-security-blue text-obsidian'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                {section}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Sections */}
      <div className="overflow-y-auto">
        {/* 1. Hero */}
        <section
          id="section-0"
          className="min-h-screen flex items-center justify-center bg-obsidian px-6 py-20"
        >
          <div className="max-w-6xl text-center">
            <h2 className="text-6xl font-bold mb-6">RealSyncDynamics.AI</h2>
            <p className="text-2xl text-petrol mb-8">
              EU-souveräne SaaS-Plattform für Creator und Agenturen
            </p>
            <p className="text-xl text-titanium/80 mb-12 max-w-2xl mx-auto">
              Provenienz-Nachweis (C2PA), KI-Workflows, VPS-Operations. Multi-Tenant. DSGVO & EU AI Act ready.
            </p>
            <button className="bg-security-blue hover:bg-blue-600 text-obsidian font-bold py-4 px-8 rounded text-lg transition">
              Demo anfordern
            </button>
            <div className="mt-16 flex justify-center">
              <ChevronDown size={40} className="animate-bounce text-security-blue" />
            </div>
          </div>
        </section>

        {/* 2. Was wir bieten */}
        <section
          id="section-1"
          className="min-h-screen flex items-center justify-center bg-slate-900 px-6 py-20"
        >
          <div className="max-w-6xl">
            <h2 className="text-4xl font-bold text-center mb-16">Was wir bieten</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-obsidian p-8 rounded-lg border border-titanium/20">
                <div className="text-4xl mb-4">🔐</div>
                <h3 className="text-2xl font-bold text-security-blue mb-4">Provenienz-Nachweis</h3>
                <p className="text-titanium/80">
                  C2PA-zertifizierte Herkunftsverfolgung für alle Content-Assets. Transparenz und Authentizität.
                </p>
              </div>
              <div className="bg-obsidian p-8 rounded-lg border border-titanium/20">
                <div className="text-4xl mb-4">🤖</div>
                <h3 className="text-2xl font-bold text-security-blue mb-4">KI-Workflows</h3>
                <p className="text-titanium/80">
                  Anthropic, Google, OpenAI & lokale EU-Alternative Ollama. Vollständige Kontrolle über deine KI.
                </p>
              </div>
              <div className="bg-obsidian p-8 rounded-lg border border-titanium/20">
                <div className="text-4xl mb-4">☁️</div>
                <h3 className="text-2xl font-bold text-security-blue mb-4">Multi-Tenant VPS</h3>
                <p className="text-titanium/80">
                  Dezentralisierte Infrastruktur mit vollständiger Kontrolle. Deine Daten, deine Regeln.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Was wir können */}
        <section
          id="section-2"
          className="min-h-screen flex items-center justify-center bg-obsidian px-6 py-20"
        >
          <div className="max-w-6xl">
            <h2 className="text-4xl font-bold text-center mb-16">Was wir können</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-xl font-bold text-security-blue mb-4">KI-Provider Integration</h3>
                <ul className="space-y-3 text-titanium/80">
                  <li>✓ Cloud-Provider: Anthropic, Google, OpenAI</li>
                  <li>✓ On-Premise EU: Ollama gemma3:4b</li>
                  <li>✓ Nahtlose Fallbacks und Load-Balancing</li>
                </ul>
              </div>
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-xl font-bold text-security-blue mb-4">Multi-Tenancy & RLS</h3>
                <ul className="space-y-3 text-titanium/80">
                  <li>✓ Row-Level Security auf allen Tabellen</li>
                  <li>✓ Keine Admin-Backdoors</li>
                  <li>✓ Vollständige Tenant-Isolation</li>
                </ul>
              </div>
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-xl font-bold text-security-blue mb-4">Automation & Monitoring</h3>
                <ul className="space-y-3 text-titanium/80">
                  <li>✓ n8n Workflow-Automation</li>
                  <li>✓ Sentry Real-Time Monitoring</li>
                  <li>✓ Stripe Billing Integration</li>
                </ul>
              </div>
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-xl font-bold text-security-blue mb-4">Edge Functions</h3>
                <ul className="space-y-3 text-titanium/80">
                  <li>✓ Supabase Edge Functions</li>
                  <li>✓ Serverless Architecture</li>
                  <li>✓ Global Low Latency</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Was sonst keiner kann */}
        <section
          id="section-3"
          className="min-h-screen flex items-center justify-center bg-slate-900 px-6 py-20"
        >
          <div className="max-w-6xl">
            <h2 className="text-4xl font-bold text-center mb-4">Was sonst keiner kann</h2>
            <p className="text-center text-titanium/80 mb-16 text-lg">
              Unser einzigartiger Vorsprung im Markt
            </p>
            <div className="space-y-4">
              <div className="bg-obsidian p-6 rounded-lg border-l-4 border-petrol flex gap-6">
                <div className="text-3xl min-w-fit">🇪🇺</div>
                <div>
                  <h3 className="text-xl font-bold text-petrol mb-2">100% EU-Souveränität</h3>
                  <p className="text-titanium/80">Keine Abhängigkeit von US-Cloud-Infrastruktur. Alle Daten bleiben in der EU.</p>
                </div>
              </div>
              <div className="bg-obsidian p-6 rounded-lg border-l-4 border-petrol flex gap-6">
                <div className="text-3xl min-w-fit">✓</div>
                <div>
                  <h3 className="text-xl font-bold text-petrol mb-2">DSGVO + EU AI Act Ready</h3>
                  <p className="text-titanium/80">Von Tag 1 konform. RLS auf allen Daten, Audit Trail auf alles, keine Backdoors.</p>
                </div>
              </div>
              <div className="bg-obsidian p-6 rounded-lg border-l-4 border-petrol flex gap-6">
                <div className="text-3xl min-w-fit">🔒</div>
                <div>
                  <h3 className="text-xl font-bold text-petrol mb-2">Zero-Trust Architektur</h3>
                  <p className="text-titanium/80">Service-Role Keys nur in Edge Functions. Kein direkter Datenbankzugriff von außen.</p>
                </div>
              </div>
              <div className="bg-obsidian p-6 rounded-lg border-l-4 border-petrol flex gap-6">
                <div className="text-3xl min-w-fit">🌍</div>
                <div>
                  <h3 className="text-xl font-bold text-petrol mb-2">KI lokal laufen lassen</h3>
                  <p className="text-titanium/80">Ollama gemma3:4b – deine eigene KI, auf deinen Servern, ohne externe APIs.</p>
                </div>
              </div>
              <div className="bg-obsidian p-6 rounded-lg border-l-4 border-petrol flex gap-6">
                <div className="text-3xl min-w-fit">📋</div>
                <div>
                  <h3 className="text-xl font-bold text-petrol mb-2">C2PA Provenance Tracking</h3>
                  <p className="text-titanium/80">Vollständige Herkunftsverfolgung aller Inhalte. Wer, wann, wie, womit generiert.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Roadmap */}
        <section
          id="section-4"
          className="min-h-screen flex items-center justify-center bg-obsidian px-6 py-20"
        >
          <div className="max-w-6xl">
            <h2 className="text-4xl font-bold text-center mb-16">Roadmap – Was kommt</h2>
            <div className="space-y-8">
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-2xl font-bold text-security-blue mb-2">Q3 2026</h3>
                <ul className="space-y-2 text-titanium/80">
                  <li>✓ Erweiterte Workflow-Templates</li>
                  <li>✓ Batch-Processing für große Datenmengen</li>
                  <li>✓ API v2 Release</li>
                </ul>
              </div>
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-2xl font-bold text-security-blue mb-2">Q4 2026</h3>
                <ul className="space-y-2 text-titanium/80">
                  <li>✓ Native Video C2PA Zertifizierung</li>
                  <li>✓ Advanced Analytics Dashboard</li>
                  <li>✓ Multi-Language Support</li>
                </ul>
              </div>
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-2xl font-bold text-security-blue mb-2">Q1 2027</h3>
                <ul className="space-y-2 text-titanium/80">
                  <li>✓ Multi-Workspace Support</li>
                  <li>✓ Team Collaboration Features</li>
                  <li>✓ Custom Branding & White-Label</li>
                </ul>
              </div>
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-2xl font-bold text-security-blue mb-2">Q2 2027</h3>
                <ul className="space-y-2 text-titanium/80">
                  <li>✓ Enterprise SSO & SAML 2.0</li>
                  <li>✓ Advanced Audit Logging</li>
                  <li>✓ Custom SLA Agreements</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Preise */}
        <section
          id="section-5"
          className="min-h-screen flex items-center justify-center bg-slate-900 px-6 py-20"
        >
          <div className="max-w-6xl">
            <h2 className="text-4xl font-bold text-center mb-16">Preismodelle</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-obsidian p-8 rounded-lg border border-titanium/20">
                <h3 className="text-2xl font-bold text-security-blue mb-4">STARTER</h3>
                <p className="text-3xl font-bold text-titanium mb-6">Auf Anfrage</p>
                <ul className="space-y-3 text-titanium/80 mb-8">
                  <li>✓ Basis-Features</li>
                  <li>✓ Bis zu 10 Workflows</li>
                  <li>✓ Community Support</li>
                  <li>✓ 5 GB Storage</li>
                </ul>
                <button className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded transition">
                  Anfrage stellen
                </button>
              </div>
              <div className="bg-security-blue/10 p-8 rounded-lg border-2 border-security-blue transform scale-105">
                <div className="bg-security-blue text-obsidian text-center py-2 rounded mb-4 font-bold">
                  EMPFOHLEN
                </div>
                <h3 className="text-2xl font-bold text-security-blue mb-4">PRO</h3>
                <p className="text-3xl font-bold text-titanium mb-6">Auf Anfrage</p>
                <ul className="space-y-3 text-titanium/80 mb-8">
                  <li>✓ Erweiterte AI-Features</li>
                  <li>✓ Unlimited Workflows</li>
                  <li>✓ Priority Support</li>
                  <li>✓ 100 GB Storage</li>
                </ul>
                <button className="w-full bg-security-blue hover:bg-blue-600 text-obsidian font-bold py-2 rounded transition">
                  Anfrage stellen
                </button>
              </div>
              <div className="bg-obsidian p-8 rounded-lg border border-titanium/20">
                <h3 className="text-2xl font-bold text-security-blue mb-4">ENTERPRISE</h3>
                <p className="text-3xl font-bold text-titanium mb-6">Custom</p>
                <ul className="space-y-3 text-titanium/80 mb-8">
                  <li>✓ Custom Deployment</li>
                  <li>✓ EU-VPS Infrastruktur</li>
                  <li>✓ 24/7 Support</li>
                  <li>✓ White-Label Optionen</li>
                </ul>
                <button className="w-full bg-petrol hover:bg-teal-700 text-obsidian font-bold py-2 rounded transition">
                  Kontakt
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Service */}
        <section
          id="section-6"
          className="min-h-screen flex items-center justify-center bg-obsidian px-6 py-20"
        >
          <div className="max-w-6xl">
            <h2 className="text-4xl font-bold text-center mb-16">Service & Support</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-800 p-8 rounded-lg">
                <h3 className="text-2xl font-bold text-security-blue mb-6">Was wir bieten</h3>
                <ul className="space-y-4 text-titanium/80">
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit">✓</span>
                    <span>24/7 Support (Deutsch & Englisch)</span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit">✓</span>
                    <span>Technical Onboarding & Training</span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit">✓</span>
                    <span>Custom Integration Support</span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit">✓</span>
                    <span>Monthly Business Reviews</span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit">✓</span>
                    <span>Security & Compliance Audits</span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit">✓</span>
                    <span>EU-basiertes Support-Team</span>
                  </li>
                </ul>
              </div>
              <div className="bg-slate-800 p-8 rounded-lg">
                <h3 className="text-2xl font-bold text-petrol mb-6">Deutschsprachiger Support</h3>
                <p className="text-titanium/80 mb-6">
                  Unser Support-Team sitzt in Deutschland und Österreich. Kommunikation auf Deutsch und Englisch, ohne Umwege über internationale Call-Center.
                </p>
                <div className="bg-obsidian p-6 rounded border-l-4 border-petrol">
                  <p className="text-titanium/80">
                    <strong className="text-titanium">Durchschnittliche Response-Zeit:</strong> &lt;1 Stunde <br />
                    <strong className="text-titanium">Verfügbarkeit:</strong> Mo–So, 08:00–22:00 CET
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Impressum */}
        <section
          id="section-7"
          className="min-h-screen flex items-center justify-center bg-slate-900 px-6 py-20"
        >
          <div className="max-w-4xl">
            <h2 className="text-4xl font-bold mb-12">Impressum</h2>
            <div className="space-y-8 text-titanium/80">
              <div>
                <h3 className="text-xl font-bold text-titanium mb-3">Anbieter</h3>
                <p>
                  <strong>RealSyncDynamics.AI</strong> <br />
                  [Unternehmensname hier eintragen]
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-titanium mb-3">Kontakt</h3>
                <p>
                  <strong>E-Mail:</strong> realsyncdynamics@gmail.com <br />
                  <strong>Telefon:</strong> [Telefonnummer hier eintragen]
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-titanium mb-3">Geschäftsführer</h3>
                <p>[Name und Vorname hier eintragen]</p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-titanium mb-3">Umsatzsteuer-Identifikationsnummer</h3>
                <p>[USt-ID hier eintragen]</p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-titanium mb-3">Registergericht</h3>
                <p>[Registergericht und Handelsregisternummer hier eintragen]</p>
              </div>
              <div className="bg-obsidian p-6 rounded border-l-4 border-security-blue mt-12">
                <p className="text-sm text-titanium/70">
                  <strong>Hinweis:</strong> Dieses Impressum ist ein Template. Bitte füllen Sie alle markierten Felder mit Ihren
                  tatsächlichen Daten aus und überprüfen Sie die rechtliche Vollständigkeit mit einem Rechtsanwalt.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 9. AGB */}
        <section
          id="section-8"
          className="min-h-screen flex items-center justify-center bg-obsidian px-6 py-20"
        >
          <div className="max-w-4xl">
            <h2 className="text-4xl font-bold mb-12">Allgemeine Geschäftsbedingungen (AGB)</h2>
            <div className="space-y-8 text-titanium/80">
              <div className="bg-slate-800 p-6 rounded">
                <h3 className="text-xl font-bold text-titanium mb-3">1. Geltungsbereich</h3>
                <p>
                  Diese AGB gelten für alle Nutzung der RealSyncDynamics.AI Plattform und Services.
                </p>
              </div>
              <div className="bg-slate-800 p-6 rounded">
                <h3 className="text-xl font-bold text-titanium mb-3">2. Leistungsbeschreibung</h3>
                <p>
                  RealSyncDynamics.AI bietet eine EU-souveräne SaaS-Plattform für Content-Management, KI-Workflows und
                  Provenienz-Tracking. [weitere Leistungsbeschreibung eintragen]
                </p>
              </div>
              <div className="bg-slate-800 p-6 rounded">
                <h3 className="text-xl font-bold text-titanium mb-3">3. Haftungsbegrenzung</h3>
                <p>
                  [Haftungsbegrenzung nach deutschem/österreichischem Recht eintragen] Ausnahmen für Vorsatz und
                  grobe Fahrlässigkeit gelten nach Maßgabe des geltenden Rechts.
                </p>
              </div>
              <div className="bg-slate-800 p-6 rounded">
                <h3 className="text-xl font-bold text-titanium mb-3">4. Kündigung</h3>
                <p>
                  [Kündigungsregelungen eintragen] Kündigung ist mit [Frist] zum Ende eines Kalendermonats möglich.
                </p>
              </div>
              <div className="bg-obsidian p-6 rounded border-l-4 border-security-blue mt-12">
                <p className="text-sm text-titanium/70">
                  <strong>Hinweis:</strong> Dies ist ein Template-Dokument. Ihre vollständigen AGB müssen von einem
                  Rechtsanwalt erstellt und überprüft werden. Diese Seite ist nicht rechtsverbindlich.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 10. Kontakt & Footer */}
        <section
          id="section-9"
          className="min-h-screen flex items-center justify-center bg-slate-900 px-6 py-20"
        >
          <div className="max-w-4xl w-full">
            <h2 className="text-4xl font-bold text-center mb-12">Kontakt & Support</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              <div className="bg-obsidian p-8 rounded-lg border border-titanium/20 text-center">
                <Mail size={48} className="mx-auto mb-4 text-security-blue" />
                <h3 className="text-xl font-bold mb-4">E-Mail</h3>
                <a
                  href="mailto:realsyncdynamics@gmail.com"
                  className="text-security-blue hover:text-blue-400 transition"
                >
                  realsyncdynamics@gmail.com
                </a>
              </div>
              <div className="bg-obsidian p-8 rounded-lg border border-titanium/20 text-center">
                <Github size={48} className="mx-auto mb-4 text-security-blue" />
                <h3 className="text-xl font-bold mb-4">Dokumentation</h3>
                <p className="text-titanium/80 mb-4">[Link zu Docs eintragen]</p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-titanium/20 pt-12 mt-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div>
                  <h4 className="font-bold text-titanium mb-4">Navigation</h4>
                  <ul className="space-y-2 text-titanium/80 text-sm">
                    <li>
                      <button onClick={() => scrollToSection(0)} className="hover:text-security-blue transition">
                        Hero
                      </button>
                    </li>
                    <li>
                      <button onClick={() => scrollToSection(1)} className="hover:text-security-blue transition">
                        Features
                      </button>
                    </li>
                    <li>
                      <button onClick={() => scrollToSection(2)} className="hover:text-security-blue transition">
                        Capabilities
                      </button>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-titanium mb-4">Legal</h4>
                  <ul className="space-y-2 text-titanium/80 text-sm">
                    <li>
                      <button onClick={() => scrollToSection(7)} className="hover:text-security-blue transition">
                        Impressum
                      </button>
                    </li>
                    <li>
                      <button onClick={() => scrollToSection(8)} className="hover:text-security-blue transition">
                        AGB
                      </button>
                    </li>
                    <li>
                      <a href="#" className="hover:text-security-blue transition">
                        Datenschutz
                      </a>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-titanium mb-4">Kontakt</h4>
                  <ul className="space-y-2 text-titanium/80 text-sm">
                    <li>
                      <a href="mailto:realsyncdynamics@gmail.com" className="hover:text-security-blue transition">
                        Email
                      </a>
                    </li>
                    <li>
                      <a href="#" className="hover:text-security-blue transition">
                        Support
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="text-center text-titanium/60 text-sm border-t border-titanium/20 pt-8">
                <p>© {new Date().getFullYear()} RealSyncDynamics.AI. Alle Rechte vorbehalten.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
