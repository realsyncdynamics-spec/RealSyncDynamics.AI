import { useState } from 'react';
import { Link } from 'react-router-dom';
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
              <a href="mailto:hello@realsyncdynamicsai.de" className="hover:text-security-blue transition">
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
              EU-souveräne Runtime für AI-Governance &amp; Compliance
            </p>
            <p className="text-xl text-titanium/80 mb-12 max-w-2xl mx-auto">
              Kontinuierliche Telemetrie für Web-, Daten- und KI-Systeme — DSGVO, TTDSG &amp; EU AI Act.
              Risiko-Erkennung, Auto-Fix und kryptografisch nachvollziehbarer Prüfpfad.
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
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-2xl font-bold text-security-blue mb-4">Continuous Monitoring</h3>
                <p className="text-titanium/80">
                  Websites, Cookies und Tracking laufend überwacht — DSGVO &amp; TTDSG. Risiko-Erkennung in Echtzeit
                  statt einmaliger Audits.
                </p>
              </div>
              <div className="bg-obsidian p-8 rounded-lg border border-titanium/20">
                <div className="text-4xl mb-4">⚙️</div>
                <h3 className="text-2xl font-bold text-security-blue mb-4">Auto-Fix Engine</h3>
                <p className="text-titanium/80">
                  Nicht nur „hier ist das Problem", sondern der Fix: Script-Blocking, Consent-Injection und
                  Font-Self-Hosting — automatisiert per Regel-Engine.
                </p>
              </div>
              <div className="bg-obsidian p-8 rounded-lg border border-titanium/20">
                <div className="text-4xl mb-4">🔐</div>
                <h3 className="text-2xl font-bold text-security-blue mb-4">Evidence-Vault</h3>
                <p className="text-titanium/80">
                  Kryptografisch nachvollziehbarer Prüfpfad für jeden Scan und jede Änderung — auditfähige
                  Nachweise für Behörden und Mandanten.
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
                <h3 className="text-xl font-bold text-security-blue mb-4">Regulatorik-Abdeckung</h3>
                <ul className="space-y-3 text-titanium/80">
                  <li>✓ EU AI Act — Klassifizierung &amp; Monitoring</li>
                  <li>✓ DSGVO — Verarbeitung &amp; Betroffenenrechte</li>
                  <li>✓ TTDSG — Consent &amp; Tracking</li>
                </ul>
              </div>
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-xl font-bold text-security-blue mb-4">Telemetrie &amp; Risk-Detection</h3>
                <ul className="space-y-3 text-titanium/80">
                  <li>✓ Kontinuierliche Scans statt Stichprobe</li>
                  <li>✓ Risk-Score je Domain &amp; System</li>
                  <li>✓ Cookie- &amp; Tracking-Inventar</li>
                </ul>
              </div>
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-xl font-bold text-security-blue mb-4">Multi-Tenancy & RLS</h3>
                <ul className="space-y-3 text-titanium/80">
                  <li>✓ Row-Level Security auf allen Tabellen</li>
                  <li>✓ Keine Admin-Backdoors</li>
                  <li>✓ Vollständige Mandanten-Isolation</li>
                </ul>
              </div>
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-xl font-bold text-security-blue mb-4">Automation &amp; Reporting</h3>
                <ul className="space-y-3 text-titanium/80">
                  <li>✓ n8n Workflow-Automation</li>
                  <li>✓ White-Label-Reports &amp; API</li>
                  <li>✓ Sentry Real-Time Monitoring</li>
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
                <div className="text-3xl min-w-fit">⚙️</div>
                <div>
                  <h3 className="text-xl font-bold text-petrol mb-2">Auto-Fix statt nur Diagnose</h3>
                  <p className="text-titanium/80">Andere zeigen nur das Problem. Wir liefern den einsetzbaren Fix-Code — Consent-Banner, Script-Blocking, Font-Self-Hosting.</p>
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
                  <h3 className="text-xl font-bold text-petrol mb-2">EU-Datenresidenz &amp; lokale KI</h3>
                  <p className="text-titanium/80">Sensible Compliance-Daten ohne US-APIs verarbeiten — optional mit EU-lokaler KI (Ollama) on-premise.</p>
                </div>
              </div>
              <div className="bg-obsidian p-6 rounded-lg border-l-4 border-petrol flex gap-6">
                <div className="text-3xl min-w-fit">🔄</div>
                <div>
                  <h3 className="text-xl font-bold text-petrol mb-2">Runtime-native, nicht einmalig</h3>
                  <p className="text-titanium/80">Compliance ist kein PDF von gestern. Kontinuierliche Telemetrie erkennt Drift, sobald sie passiert — mit lückenlosem Prüfpfad.</p>
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
                  <li>✓ Erweiterte Policy-Templates (DSGVO/AI-Act)</li>
                  <li>✓ Batch-Scans für Domain-Portfolios</li>
                  <li>✓ Public API v2</li>
                </ul>
              </div>
              <div className="bg-slate-800 p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-2xl font-bold text-security-blue mb-2">Q4 2026</h3>
                <ul className="space-y-2 text-titanium/80">
                  <li>✓ Automatisierte AI-Act-Risikoklassifizierung</li>
                  <li>✓ Advanced Compliance-Analytics</li>
                  <li>✓ Multi-Language-Reports</li>
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
                  <li>✓ Erweiterter Prüfpfad-Export</li>
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
          <div className="max-w-6xl w-full">
            <h2 className="text-4xl font-bold text-center mb-4">Preismodelle</h2>
            <p className="text-center text-titanium/80 mb-16 text-lg">
              Vom kostenlosen Erst-Scan bis zur kompletten Governance-Runtime — alle Pläne EU-gehostet.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <div className="bg-obsidian p-6 rounded-lg border border-titanium/20 flex flex-col">
                <h3 className="text-lg font-bold text-titanium mb-2">Free Audit</h3>
                <p className="text-3xl font-bold text-titanium mb-1">0 €</p>
                <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-4">einmalig</p>
                <ul className="space-y-2 text-sm text-titanium/80 mb-6 flex-1">
                  <li>✓ Sofort-Risk-Score</li>
                  <li>✓ Kein Account nötig</li>
                  <li>✓ Einzeldomain-Scan</li>
                </ul>
                <button className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-sm transition">
                  Scan starten
                </button>
              </div>
              <div className="bg-obsidian p-6 rounded-lg border border-titanium/20 flex flex-col">
                <h3 className="text-lg font-bold text-security-blue mb-2">Starter</h3>
                <p className="text-3xl font-bold text-titanium mb-1">79 €</p>
                <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-4">pro Monat</p>
                <ul className="space-y-2 text-sm text-titanium/80 mb-6 flex-1">
                  <li>✓ Einzeldomain</li>
                  <li>✓ Compliance-Monitoring</li>
                  <li>✓ Evidence-Export</li>
                </ul>
                <button className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-sm transition">
                  Buchen
                </button>
              </div>
              <div className="bg-security-blue/10 p-6 rounded-lg border-2 border-security-blue flex flex-col relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-security-blue text-obsidian text-xs px-3 py-1 rounded font-bold whitespace-nowrap">
                  EMPFOHLEN
                </div>
                <h3 className="text-lg font-bold text-security-blue mb-2 mt-2">Growth</h3>
                <p className="text-3xl font-bold text-titanium mb-1">249 €</p>
                <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-4">pro Monat</p>
                <ul className="space-y-2 text-sm text-titanium/80 mb-6 flex-1">
                  <li>✓ Monitoring + Auto-Fix</li>
                  <li>✓ Mehrere Domains</li>
                  <li>✓ Prioritäts-Support</li>
                </ul>
                <button className="w-full bg-security-blue hover:bg-blue-600 text-obsidian font-bold py-2 rounded text-sm transition">
                  Buchen
                </button>
              </div>
              <div className="bg-obsidian p-6 rounded-lg border border-titanium/20 flex flex-col">
                <h3 className="text-lg font-bold text-titanium mb-2">Agency</h3>
                <p className="text-3xl font-bold text-titanium mb-1">699 €</p>
                <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-4">pro Monat</p>
                <ul className="space-y-2 text-sm text-titanium/80 mb-6 flex-1">
                  <li>✓ White-Label</li>
                  <li>✓ 10 Kunden-Sites</li>
                  <li>✓ API-Zugang</li>
                </ul>
                <button className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-sm transition">
                  Buchen
                </button>
              </div>
              <div className="bg-obsidian p-6 rounded-lg border border-titanium/20 flex flex-col">
                <h3 className="text-lg font-bold text-titanium mb-2">Scale</h3>
                <p className="text-3xl font-bold text-titanium mb-1">1.999 €</p>
                <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-4">pro Monat</p>
                <ul className="space-y-2 text-sm text-titanium/80 mb-6 flex-1">
                  <li>✓ DSB-Kanzleien</li>
                  <li>✓ Bis 50 Mandanten</li>
                  <li>✓ Evidence-Vault</li>
                </ul>
                <button className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-sm transition">
                  Buchen
                </button>
              </div>
            </div>
            {/* Enterprise — individueller Anfrage-Banner */}
            <div className="bg-petrol/10 border border-petrol rounded-lg p-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-petrol mb-2">Enterprise — individuell</h3>
                <p className="text-titanium/80">
                  Custom Deployment, EU-VPS, Evidence-Vault, SLA &amp; White-Label nach Bedarf.
                </p>
              </div>
              <a
                href="mailto:hello@realsyncdynamicsai.de"
                className="bg-petrol hover:bg-teal-700 text-obsidian font-bold py-3 px-8 rounded transition whitespace-nowrap"
              >
                Anfrage stellen
              </a>
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
            <h2 className="text-4xl font-bold mb-4">Impressum</h2>
            <p className="text-titanium/60 text-sm mb-12 font-mono">§ 5 TMG · § 18 MStV</p>
            <div className="space-y-8 text-titanium/80">
              <div>
                <h3 className="text-xl font-bold text-titanium mb-3">Anbieter / Verantwortlicher</h3>
                <p>
                  <strong className="text-titanium">RealSync Dynamics</strong> <br />
                  Schwarzburger Str. 31 <br />
                  98724 Neuhaus am Rennweg <br />
                  Thüringen, Deutschland
                </p>
                <p className="mt-2">
                  Einzelunternehmen, vertreten durch den Inhaber <strong className="text-titanium">Dominik Steiner</strong>.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-titanium mb-3">Kontakt</h3>
                <p>
                  <strong>Telefon:</strong>{' '}
                  <a href="tel:+4917640132161" className="text-security-blue hover:text-blue-400">+49 176 4013 2161</a> <br />
                  <strong>E-Mail:</strong>{' '}
                  <a href="mailto:hello@realsyncdynamicsai.de" className="text-security-blue hover:text-blue-400">hello@realsyncdynamicsai.de</a> <br />
                  <strong>Datenschutz:</strong>{' '}
                  <a href="mailto:privacy@realsyncdynamicsai.de" className="text-security-blue hover:text-blue-400">privacy@realsyncdynamicsai.de</a>
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-titanium mb-3">Umsatzsteuer</h3>
                <p>Kleinunternehmer i. S. v. § 19 UStG — es wird keine Umsatzsteuer ausgewiesen.</p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-titanium mb-3">Aufsichtsbehörde Datenschutz</h3>
                <p>
                  Thüringer Landesbeauftragter für den Datenschutz und die Informationsfreiheit (TLfDI),
                  Häßlerstraße 8, 99096 Erfurt.
                </p>
              </div>
              <div className="bg-obsidian p-6 rounded border-l-4 border-security-blue mt-12">
                <p className="text-sm text-titanium/70">
                  Das vollständige Impressum mit allen Pflichtangaben (Haftung, Urheberrecht, EU-Streitschlichtung) findest Du hier:{' '}
                  <Link to="/legal/impressum" className="text-security-blue hover:text-blue-400 font-bold">
                    /legal/impressum →
                  </Link>
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
                <h3 className="text-xl font-bold text-titanium mb-3">4. Kündigung &amp; Laufzeit</h3>
                <p>
                  Abonnements sind monatlich kündbar. Details zu Laufzeit, Zahlungsbedingungen und
                  Widerrufsrecht regeln die vollständigen Nutzungsbedingungen.
                </p>
              </div>
              <div className="bg-obsidian p-6 rounded border-l-4 border-security-blue mt-12">
                <p className="text-sm text-titanium/70">
                  Die rechtsverbindlichen, vollständigen Nutzungsbedingungen (AGB) findest Du hier:{' '}
                  <Link to="/legal/terms" className="text-security-blue hover:text-blue-400 font-bold">
                    /legal/terms →
                  </Link>
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
                  href="mailto:hello@realsyncdynamicsai.de"
                  className="text-security-blue hover:text-blue-400 transition"
                >
                  hello@realsyncdynamicsai.de
                </a>
                <p className="text-titanium/60 text-sm mt-2">Telefon: +49 176 4013 2161</p>
              </div>
              <div className="bg-obsidian p-8 rounded-lg border border-titanium/20 text-center">
                <Github size={48} className="mx-auto mb-4 text-security-blue" />
                <h3 className="text-xl font-bold mb-4">Dokumentation</h3>
                <Link to="/docs" className="text-security-blue hover:text-blue-400 transition">
                  /docs →
                </Link>
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
                      <Link to="/legal/impressum" className="hover:text-security-blue transition">
                        Impressum
                      </Link>
                    </li>
                    <li>
                      <Link to="/legal/terms" className="hover:text-security-blue transition">
                        AGB / Nutzungsbedingungen
                      </Link>
                    </li>
                    <li>
                      <Link to="/legal/privacy" className="hover:text-security-blue transition">
                        Datenschutz
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-titanium mb-4">Kontakt</h4>
                  <ul className="space-y-2 text-titanium/80 text-sm">
                    <li>
                      <a href="mailto:hello@realsyncdynamicsai.de" className="hover:text-security-blue transition">
                        hello@realsyncdynamicsai.de
                      </a>
                    </li>
                    <li>
                      <Link to="/pricing" className="hover:text-security-blue transition">
                        Preise &amp; Pläne
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="text-center text-titanium/60 text-sm border-t border-titanium/20 pt-8">
                <p>© {new Date().getFullYear()} RealSync Dynamics · Dominik Steiner. Alle Rechte vorbehalten.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
