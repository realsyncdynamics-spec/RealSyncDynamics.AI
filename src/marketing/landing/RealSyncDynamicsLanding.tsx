import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Mail, Github, Shield, Zap, Lock, TrendingUp } from 'lucide-react';

export const RealSyncDynamicsLanding = () => {
  const [activeSection, setActiveSection] = useState(0);

  const sections = [
    'Product',
    'Was wir bieten',
    'Capabilities',
    'Vorteile',
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
    <div className="bg-obsidian text-titanium overflow-hidden" style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-obsidian/95 border-b border-petrol/30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-petrol to-security-blue rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">▲</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-petrol to-security-blue bg-clip-text text-transparent">RealSync</h1>
            </div>
            <div className="flex gap-4">
              <a href="mailto:hello@realsyncdynamicsai.de" className="hover:text-petrol transition">
                <Mail size={20} />
              </a>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {sections.map((section, idx) => (
              <button
                key={idx}
                onClick={() => scrollToSection(idx)}
                className={`px-4 py-2 rounded text-sm whitespace-nowrap transition font-medium ${
                  activeSection === idx
                    ? 'bg-gradient-to-r from-petrol to-security-blue text-obsidian'
                    : 'bg-slate-800/50 hover:bg-slate-700/50 text-titanium/80'
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
        {/* 1. Hero — Space/Earth Background */}
        <section
          id="section-0"
          className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden"
          style={{
            background: `
              linear-gradient(135deg, rgba(10, 10, 11, 0.95) 0%, rgba(15, 118, 110, 0.1) 50%, rgba(0, 82, 255, 0.05) 100%),
              radial-gradient(circle at 20% 50%, rgba(15, 118, 110, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(0, 82, 255, 0.1) 0%, transparent 50%)
            `,
            backgroundAttachment: 'fixed',
          }}
        >
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 right-10 w-96 h-96 bg-petrol/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-20 left-10 w-96 h-96 bg-security-blue/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="max-w-6xl text-center relative z-10">
            <div className="mb-8 inline-block">
              <span className="inline-block px-4 py-2 bg-petrol/20 border border-petrol/50 rounded-full text-petrol text-sm font-medium">
                ✨ AI Governance Runtime
              </span>
            </div>
            <h2 className="text-7xl md:text-8xl font-bold mb-8 leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Das KI-<br />Betriebssystem
              <br />
              für<span className="bg-gradient-to-r from-petrol via-security-blue to-petrol bg-clip-text text-transparent"> Compliance</span>
            </h2>
            <p className="text-2xl text-titanium/80 mb-12 max-w-3xl mx-auto leading-relaxed">
              EU-souveräne Runtime-native Governance für DSGVO, TTDSG &amp; EU AI Act. Kontinuierliche Telemetrie statt Stichproben.
              Auto-Fix statt nur Diagnose.
            </p>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-4 justify-center mb-12">
              <div className="px-4 py-2 bg-obsidian/50 border border-petrol/30 rounded-full text-sm text-titanium/80">
                ✓ DSGVO-konform
              </div>
              <div className="px-4 py-2 bg-obsidian/50 border border-security-blue/30 rounded-full text-sm text-titanium/80">
                ✓ AI-Act-ready
              </div>
              <div className="px-4 py-2 bg-obsidian/50 border border-petrol/30 rounded-full text-sm text-titanium/80">
                ✓ EU-gehostet
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-gradient-to-r from-petrol to-security-blue hover:from-teal-700 hover:to-blue-600 text-obsidian font-bold py-4 px-8 rounded transition transform hover:scale-105">
                Demo anfordern
              </button>
              <button className="bg-obsidian/50 border border-titanium/30 hover:border-petrol/50 text-titanium font-bold py-4 px-8 rounded transition">
                Dokumentation →
              </button>
            </div>

            <div className="mt-20 flex justify-center">
              <ChevronDown size={40} className="animate-bounce text-petrol" />
            </div>
          </div>
        </section>

        {/* 2. Was wir bieten */}
        <section
          id="section-1"
          className="min-h-screen flex items-center justify-center px-6 py-20 relative bg-gradient-to-b from-obsidian to-slate-950"
        >
          <div className="max-w-6xl relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-6xl font-bold mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Was wir <span className="bg-gradient-to-r from-petrol to-security-blue bg-clip-text text-transparent">bieten</span>
              </h2>
              <p className="text-xl text-titanium/70 max-w-2xl mx-auto">
                Kontinuierliche Überwachung, automatische Fixes und kryptografische Nachweise
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-petrol/20 to-transparent rounded-lg blur opacity-0 group-hover:opacity-100 transition" />
                <div className="relative bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-petrol/30 group-hover:border-petrol/60 transition">
                  <div className="w-14 h-14 bg-petrol/20 rounded-lg flex items-center justify-center mb-6">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <h3 className="text-2xl font-bold text-petrol mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Continuous Monitoring
                  </h3>
                  <p className="text-titanium/70">
                    Websites, Cookies und Tracking laufend überwacht. Risiko-Erkennung in Echtzeit statt einmaliger Audits.
                  </p>
                </div>
              </div>

              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-security-blue/20 to-transparent rounded-lg blur opacity-0 group-hover:opacity-100 transition" />
                <div className="relative bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-security-blue/30 group-hover:border-security-blue/60 transition">
                  <div className="w-14 h-14 bg-security-blue/20 rounded-lg flex items-center justify-center mb-6">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <h3 className="text-2xl font-bold text-security-blue mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Auto-Fix Engine
                  </h3>
                  <p className="text-titanium/70">
                    Nicht nur Diagnose, sondern direkt der Fix: Script-Blocking, Consent-Injection, Font-Self-Hosting — automatisiert.
                  </p>
                </div>
              </div>

              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-petrol/20 to-transparent rounded-lg blur opacity-0 group-hover:opacity-100 transition" />
                <div className="relative bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-petrol/30 group-hover:border-petrol/60 transition">
                  <div className="w-14 h-14 bg-petrol/20 rounded-lg flex items-center justify-center mb-6">
                    <span className="text-2xl">🔐</span>
                  </div>
                  <h3 className="text-2xl font-bold text-petrol mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Evidence-Vault
                  </h3>
                  <p className="text-titanium/70">
                    Kryptografisch nachvollziehbarer Prüfpfad für jeden Scan und jede Änderung — auditfähig für Behörden.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Was wir können */}
        <section
          id="section-2"
          className="min-h-screen flex items-center justify-center px-6 py-20 bg-slate-950 relative"
        >
          <div className="max-w-6xl relative z-10 w-full">
            <div className="text-center mb-20">
              <h2 className="text-6xl font-bold mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Technische <span className="bg-gradient-to-r from-security-blue to-petrol bg-clip-text text-transparent">Capabilities</span>
              </h2>
              <p className="text-xl text-titanium/70 max-w-2xl mx-auto">
                Enterprise-Grade Infrastruktur für Compliance &amp; Governance
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-security-blue/30 hover:border-security-blue/60 transition">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-security-blue/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <Shield size={20} className="text-security-blue" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-security-blue mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      Regulatorik-Abdeckung
                    </h3>
                    <ul className="space-y-2 text-titanium/70 text-sm">
                      <li className="flex gap-2"><span className="text-security-blue">✓</span> EU AI Act — Klassifizierung &amp; Monitoring</li>
                      <li className="flex gap-2"><span className="text-security-blue">✓</span> DSGVO — Verarbeitung &amp; Betroffenenrechte</li>
                      <li className="flex gap-2"><span className="text-security-blue">✓</span> TTDSG — Consent &amp; Tracking</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-petrol/30 hover:border-petrol/60 transition">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-petrol/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <TrendingUp size={20} className="text-petrol" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-petrol mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      Telemetrie &amp; Risk-Detection
                    </h3>
                    <ul className="space-y-2 text-titanium/70 text-sm">
                      <li className="flex gap-2"><span className="text-petrol">✓</span> Kontinuierliche Scans statt Stichprobe</li>
                      <li className="flex gap-2"><span className="text-petrol">✓</span> Risk-Score je Domain &amp; System</li>
                      <li className="flex gap-2"><span className="text-petrol">✓</span> Cookie- &amp; Tracking-Inventar</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-security-blue/30 hover:border-security-blue/60 transition">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-security-blue/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <Lock size={20} className="text-security-blue" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-security-blue mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      Multi-Tenancy & RLS
                    </h3>
                    <ul className="space-y-2 text-titanium/70 text-sm">
                      <li className="flex gap-2"><span className="text-security-blue">✓</span> Row-Level Security auf allen Tabellen</li>
                      <li className="flex gap-2"><span className="text-security-blue">✓</span> Keine Admin-Backdoors</li>
                      <li className="flex gap-2"><span className="text-security-blue">✓</span> Vollständige Mandanten-Isolation</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-petrol/30 hover:border-petrol/60 transition">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-petrol/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <Zap size={20} className="text-petrol" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-petrol mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      Automation &amp; Reporting
                    </h3>
                    <ul className="space-y-2 text-titanium/70 text-sm">
                      <li className="flex gap-2"><span className="text-petrol">✓</span> n8n Workflow-Automation</li>
                      <li className="flex gap-2"><span className="text-petrol">✓</span> White-Label-Reports &amp; API</li>
                      <li className="flex gap-2"><span className="text-petrol">✓</span> Sentry Real-Time Monitoring</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Vorteile — Was sonst keiner kann */}
        <section
          id="section-3"
          className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-to-b from-slate-950 to-obsidian"
        >
          <div className="max-w-6xl relative z-10 w-full">
            <div className="text-center mb-20">
              <h2 className="text-6xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Was sonst <span className="bg-gradient-to-r from-petrol to-security-blue bg-clip-text text-transparent">keiner</span> kann
              </h2>
              <p className="text-xl text-titanium/70">Unser einzigartiger Vorsprung im Markt</p>
            </div>
            <div className="space-y-4">
              <div className="group bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-petrol/30 hover:border-petrol/60 flex gap-6 transition">
                <div className="text-4xl min-w-fit">🇪🇺</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-petrol mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    100% EU-Souveränität
                  </h3>
                  <p className="text-titanium/70">Keine Abhängigkeit von US-Cloud-Infrastruktur. Alle Daten bleiben in der EU.</p>
                </div>
              </div>

              <div className="group bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-security-blue/30 hover:border-security-blue/60 flex gap-6 transition">
                <div className="text-4xl min-w-fit">⚡</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-security-blue mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Auto-Fix statt Diagnose
                  </h3>
                  <p className="text-titanium/70">Andere zeigen nur das Problem. Wir liefern den einsetzbaren Fix-Code — Consent-Banner, Script-Blocking, Font-Self-Hosting.</p>
                </div>
              </div>

              <div className="group bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-petrol/30 hover:border-petrol/60 flex gap-6 transition">
                <div className="text-4xl min-w-fit">🔒</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-petrol mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Zero-Trust Architektur
                  </h3>
                  <p className="text-titanium/70">Service-Role Keys nur in Edge Functions. Kein direkter Datenbankzugriff von außen.</p>
                </div>
              </div>

              <div className="group bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-security-blue/30 hover:border-security-blue/60 flex gap-6 transition">
                <div className="text-4xl min-w-fit">🌍</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-security-blue mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    EU-Datenresidenz &amp; lokale KI
                  </h3>
                  <p className="text-titanium/70">Sensible Compliance-Daten ohne US-APIs verarbeiten — optional mit EU-lokaler KI (Ollama) on-premise.</p>
                </div>
              </div>

              <div className="group bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-petrol/30 hover:border-petrol/60 flex gap-6 transition">
                <div className="text-4xl min-w-fit">🔄</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-petrol mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Runtime-native, nicht einmalig
                  </h3>
                  <p className="text-titanium/70">Compliance ist kein PDF von gestern. Kontinuierliche Telemetrie erkennt Drift, sobald sie passiert — mit lückenlosem Prüfpfad.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Roadmap */}
        <section
          id="section-4"
          className="min-h-screen flex items-center justify-center px-6 py-20 bg-slate-950"
        >
          <div className="max-w-6xl relative z-10 w-full">
            <div className="text-center mb-20">
              <h2 className="text-6xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Roadmap – Was <span className="bg-gradient-to-r from-security-blue to-petrol bg-clip-text text-transparent">kommt</span>
              </h2>
              <p className="text-xl text-titanium/70">Produktentwicklung 2026–2027</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border-l-4 border-petrol">
                <h3 className="text-2xl font-bold text-petrol mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Q3 2026</h3>
                <ul className="space-y-3 text-titanium/70">
                  <li className="flex gap-2"><span className="text-petrol">→</span> Erweiterte Policy-Templates (DSGVO/AI-Act)</li>
                  <li className="flex gap-2"><span className="text-petrol">→</span> Batch-Scans für Domain-Portfolios</li>
                  <li className="flex gap-2"><span className="text-petrol">→</span> Public API v2</li>
                </ul>
              </div>

              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-2xl font-bold text-security-blue mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Q4 2026</h3>
                <ul className="space-y-3 text-titanium/70">
                  <li className="flex gap-2"><span className="text-security-blue">→</span> Automatisierte AI-Act-Risikoklassifizierung</li>
                  <li className="flex gap-2"><span className="text-security-blue">→</span> Advanced Compliance-Analytics</li>
                  <li className="flex gap-2"><span className="text-security-blue">→</span> Multi-Language-Reports</li>
                </ul>
              </div>

              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border-l-4 border-petrol">
                <h3 className="text-2xl font-bold text-petrol mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Q1 2027</h3>
                <ul className="space-y-3 text-titanium/70">
                  <li className="flex gap-2"><span className="text-petrol">→</span> Multi-Workspace Support</li>
                  <li className="flex gap-2"><span className="text-petrol">→</span> Team Collaboration Features</li>
                  <li className="flex gap-2"><span className="text-petrol">→</span> Custom Branding & White-Label</li>
                </ul>
              </div>

              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border-l-4 border-security-blue">
                <h3 className="text-2xl font-bold text-security-blue mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Q2 2027</h3>
                <ul className="space-y-3 text-titanium/70">
                  <li className="flex gap-2"><span className="text-security-blue">→</span> Enterprise SSO & SAML 2.0</li>
                  <li className="flex gap-2"><span className="text-security-blue">→</span> Erweiterter Prüfpfad-Export</li>
                  <li className="flex gap-2"><span className="text-security-blue">→</span> Custom SLA Agreements</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Preise */}
        <section
          id="section-5"
          className="min-h-screen flex items-center justify-center px-6 py-20 bg-obsidian"
        >
          <div className="max-w-6xl w-full">
            <div className="text-center mb-16">
              <h2 className="text-6xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Preismodelle
              </h2>
              <p className="text-xl text-titanium/70">
                Vom kostenlosen Erst-Scan bis zur kompletten Governance-Runtime
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
              <div className="bg-slate-900/80 backdrop-blur p-6 rounded-lg border border-titanium/20 hover:border-titanium/40 flex flex-col transition">
                <h3 className="text-lg font-bold text-titanium mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Free Audit</h3>
                <p className="text-3xl font-bold bg-gradient-to-r from-petrol to-security-blue bg-clip-text text-transparent mb-1">0 €</p>
                <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-4">einmalig</p>
                <ul className="space-y-2 text-sm text-titanium/70 mb-6 flex-1">
                  <li>✓ Sofort-Risk-Score</li>
                  <li>✓ Kein Account nötig</li>
                  <li>✓ Einzeldomain-Scan</li>
                </ul>
                <button className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded text-sm transition">
                  Scan starten
                </button>
              </div>

              <div className="bg-slate-900/80 backdrop-blur p-6 rounded-lg border border-security-blue/30 hover:border-security-blue/60 flex flex-col transition">
                <h3 className="text-lg font-bold text-security-blue mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Starter</h3>
                <p className="text-3xl font-bold text-titanium mb-1">79 €</p>
                <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-4">pro Monat</p>
                <ul className="space-y-2 text-sm text-titanium/70 mb-6 flex-1">
                  <li>✓ Einzeldomain</li>
                  <li>✓ Compliance-Monitoring</li>
                  <li>✓ Evidence-Export</li>
                </ul>
                <button className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded text-sm transition">
                  Buchen
                </button>
              </div>

              <div className="relative bg-gradient-to-br from-security-blue/20 to-petrol/10 backdrop-blur p-6 rounded-lg border-2 border-security-blue/50 hover:border-security-blue flex flex-col transition">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-security-blue to-petrol text-obsidian text-xs px-4 py-1 rounded-full font-bold whitespace-nowrap">
                  ⭐ EMPFOHLEN
                </div>
                <h3 className="text-lg font-bold text-security-blue mb-2 mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Growth</h3>
                <p className="text-3xl font-bold text-titanium mb-1">249 €</p>
                <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-4">pro Monat</p>
                <ul className="space-y-2 text-sm text-titanium/70 mb-6 flex-1">
                  <li>✓ Monitoring + Auto-Fix</li>
                  <li>✓ Mehrere Domains</li>
                  <li>✓ Prioritäts-Support</li>
                </ul>
                <button className="w-full bg-gradient-to-r from-security-blue to-petrol hover:from-blue-600 hover:to-teal-700 text-obsidian font-bold py-2 rounded text-sm transition">
                  Buchen
                </button>
              </div>

              <div className="bg-slate-900/80 backdrop-blur p-6 rounded-lg border border-petrol/30 hover:border-petrol/60 flex flex-col transition">
                <h3 className="text-lg font-bold text-petrol mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Agency</h3>
                <p className="text-3xl font-bold text-titanium mb-1">699 €</p>
                <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-4">pro Monat</p>
                <ul className="space-y-2 text-sm text-titanium/70 mb-6 flex-1">
                  <li>✓ White-Label</li>
                  <li>✓ 10 Kunden-Sites</li>
                  <li>✓ API-Zugang</li>
                </ul>
                <button className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded text-sm transition">
                  Buchen
                </button>
              </div>

              <div className="bg-slate-900/80 backdrop-blur p-6 rounded-lg border border-titanium/20 hover:border-titanium/40 flex flex-col transition">
                <h3 className="text-lg font-bold text-titanium mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Scale</h3>
                <p className="text-3xl font-bold text-titanium mb-1">1.999 €</p>
                <p className="text-xs font-mono uppercase tracking-wider text-titanium/50 mb-4">pro Monat</p>
                <ul className="space-y-2 text-sm text-titanium/70 mb-6 flex-1">
                  <li>✓ DSB-Kanzleien</li>
                  <li>✓ Bis 50 Mandanten</li>
                  <li>✓ Evidence-Vault</li>
                </ul>
                <button className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded text-sm transition">
                  Buchen
                </button>
              </div>
            </div>

            {/* Enterprise — individueller Anfrage-Banner */}
            <div className="bg-gradient-to-r from-petrol/20 to-security-blue/10 border border-petrol/50 rounded-lg p-8 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur">
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-petrol to-security-blue bg-clip-text text-transparent mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Enterprise — individuell
                </h3>
                <p className="text-titanium/70">
                  Custom Deployment, EU-VPS, Evidence-Vault, SLA &amp; White-Label nach Bedarf.
                </p>
              </div>
              <a
                href="mailto:hello@realsyncdynamicsai.de"
                className="bg-gradient-to-r from-petrol to-security-blue hover:from-teal-700 hover:to-blue-600 text-obsidian font-bold py-3 px-8 rounded transition whitespace-nowrap"
              >
                Anfrage stellen
              </a>
            </div>
          </div>
        </section>

        {/* 7. Service */}
        <section
          id="section-6"
          className="min-h-screen flex items-center justify-center px-6 py-20 bg-slate-950"
        >
          <div className="max-w-6xl w-full">
            <div className="text-center mb-16">
              <h2 className="text-6xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Service &amp; <span className="bg-gradient-to-r from-petrol to-security-blue bg-clip-text text-transparent">Support</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-security-blue/30 hover:border-security-blue/60 transition">
                <h3 className="text-2xl font-bold text-security-blue mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Was wir bieten</h3>
                <ul className="space-y-4 text-titanium/70">
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit font-bold">✓</span>
                    <span>24/7 Support (Deutsch & Englisch)</span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit font-bold">✓</span>
                    <span>Technical Onboarding & Training</span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit font-bold">✓</span>
                    <span>Custom Integration Support</span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit font-bold">✓</span>
                    <span>Monthly Business Reviews</span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit font-bold">✓</span>
                    <span>Security & Compliance Audits</span>
                  </li>
                  <li className="flex gap-4">
                    <span className="text-security-blue min-w-fit font-bold">✓</span>
                    <span>EU-basiertes Support-Team</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-petrol/30 hover:border-petrol/60 transition">
                <h3 className="text-2xl font-bold text-petrol mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Deutschsprachiger Support</h3>
                <p className="text-titanium/70 mb-6">
                  Unser Support-Team sitzt in Deutschland und Österreich. Kommunikation auf Deutsch und Englisch, ohne Umwege über internationale Call-Center.
                </p>
                <div className="bg-obsidian/50 p-6 rounded border-l-4 border-petrol">
                  <p className="text-titanium/70 text-sm">
                    <strong className="text-titanium">Response-Zeit:</strong> &lt;1 Stunde <br />
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
          className="min-h-screen flex items-center justify-center px-6 py-20 bg-obsidian"
        >
          <div className="max-w-4xl">
            <h2 className="text-5xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Impressum</h2>
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
          className="min-h-screen flex items-center justify-center px-6 py-20 bg-slate-950"
        >
          <div className="max-w-4xl">
            <h2 className="text-5xl font-bold mb-12" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Allgemeine Geschäftsbedingungen</h2>
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
          className="min-h-screen flex items-center justify-center px-6 py-20 bg-obsidian"
        >
          <div className="max-w-4xl w-full">
            <div className="text-center mb-16">
              <h2 className="text-6xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Kontakt &amp; <span className="bg-gradient-to-r from-petrol to-security-blue bg-clip-text text-transparent">Support</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-petrol/30 hover:border-petrol/60 text-center transition">
                <Mail size={48} className="mx-auto mb-4 text-petrol" />
                <h3 className="text-xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>E-Mail</h3>
                <a
                  href="mailto:hello@realsyncdynamicsai.de"
                  className="text-petrol hover:text-teal-400 transition font-medium"
                >
                  hello@realsyncdynamicsai.de
                </a>
                <p className="text-titanium/60 text-sm mt-2">Telefon: +49 176 4013 2161</p>
              </div>

              <div className="bg-slate-900/80 backdrop-blur p-8 rounded-lg border border-security-blue/30 hover:border-security-blue/60 text-center transition">
                <Github size={48} className="mx-auto mb-4 text-security-blue" />
                <h3 className="text-xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Dokumentation</h3>
                <Link to="/docs" className="text-security-blue hover:text-blue-400 transition font-medium">
                  /docs →
                </Link>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-petrol/30 pt-12 mt-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div>
                  <h4 className="font-bold text-titanium mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Navigation</h4>
                  <ul className="space-y-2 text-titanium/70 text-sm">
                    <li>
                      <button onClick={() => scrollToSection(0)} className="hover:text-petrol transition">Product</button>
                    </li>
                    <li>
                      <button onClick={() => scrollToSection(1)} className="hover:text-petrol transition">Features</button>
                    </li>
                    <li>
                      <button onClick={() => scrollToSection(5)} className="hover:text-petrol transition">Preise</button>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-titanium mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Legal</h4>
                  <ul className="space-y-2 text-titanium/70 text-sm">
                    <li>
                      <Link to="/legal/impressum" className="hover:text-petrol transition">
                        Impressum
                      </Link>
                    </li>
                    <li>
                      <Link to="/legal/terms" className="hover:text-petrol transition">
                        AGB
                      </Link>
                    </li>
                    <li>
                      <Link to="/legal/widerruf" className="hover:text-petrol transition">
                        Widerrufsbelehrung
                      </Link>
                    </li>
                    <li>
                      <Link to="/legal/privacy" className="hover:text-petrol transition">
                        Datenschutz
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-titanium mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Kontakt</h4>
                  <ul className="space-y-2 text-titanium/70 text-sm">
                    <li>
                      <a href="mailto:hello@realsyncdynamicsai.de" className="hover:text-petrol transition">
                        hello@realsyncdynamicsai.de
                      </a>
                    </li>
                    <li>
                      <button onClick={() => scrollToSection(5)} className="hover:text-petrol transition">
                        Preise &amp; Pläne
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="text-center text-titanium/50 text-sm border-t border-petrol/20 pt-8">
                <p>© {new Date().getFullYear()} RealSync Dynamics · Dominik Steiner. Alle Rechte vorbehalten.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
