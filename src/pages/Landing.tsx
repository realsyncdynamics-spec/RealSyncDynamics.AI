/**
 * Landing — Self-Service-Startseite im Governance-Operating-System-Framing.
 *
 * Vollständig statisch: kein Auto-Scroll, kein IntersectionObserver, keine
 * Animations-Loops. Die schweren animierten Sektions-Komponenten bleiben
 * bewusst ungenutzt (Stabilitätscontract). Die Narrative ist eine leichte,
 * statische Eigenkomposition.
 *
 * 5-Sekunden-Botschaft: „RealSyncDynamics.AI erkennt, überwacht,
 * dokumentiert und beweist Compliance automatisch."
 *
 * Struktur (12 Blöcke, Kundensicht):
 *   1 Hero · 2 Problem · 3–6 Detect→Monitor→Document→Prove ·
 *   7 DSGVO-Automation · 8 AI-Act-Automation · 9 Security & EU-Hosting ·
 *   10 Für wen? · 11 Preise · 12 Final CTA · Footer
 *
 * CTA-Disziplin: ausschließlich Strings aus `CTA` (runtimeVocab). Keine
 * Beratungs-/Pilot-/Demo-/Call-/Sales-Sprache. Einzige kontaktbasierte
 * CTA ist „Enterprise anfragen" (SSO/On-Prem/Behörde/Custom-DPA/PO).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ShieldCheck, AlertTriangle, ScanLine, Eye, FileStack,
  BadgeCheck, Gavel, Lock, Building2, Briefcase, UserCheck, Landmark, Server,
  Globe, Bot, FileCheck2, Activity, BarChart3, Shield,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { CTA } from '../content/runtimeVocab';
import { usePlatformStats, relativeTimeDe } from '../hooks/usePlatformStats';
import { FoundingAccessBanner } from '../components/sections/FoundingAccessBanner';
import { ModuleVisibilitySection } from '../components/sections/ModuleVisibilitySection';
import { RuntimeGovernanceFlowSection } from '../components/sections/RuntimeGovernanceFlowSection';
import { EnhancedPricingTeaserSection } from '../components/sections/EnhancedPricingTeaserSection';

export function Landing() {
  return (
    <>
      <Navbar />
      <main className="bg-obsidian-950 text-titanium-100 pt-14">
        <FoundingAccessBanner />
        <Hero />
        <BrowserMetaphorSection />
        <ModuleVisibilitySection />
        <RuntimeGovernanceFlowSection />
        <ProblemSection />
        <AutomationFlow />
        <DsgvoAutomation />
        <AiActAutomation />
        <SecuritySection />
        <AudienceSection />
        <EnhancedPricingTeaserSection />
        <FinalCta />
        <Footer />
      </main>
    </>
  );
}

// ─── 1 · Hero ────────────────────────────────────────────────────────

const HERO_TRUST_SIGNALS = [
  'Kein Account erforderlich',
  'Kostenloser Erstcheck',
  'Sofortiger Compliance Score',
  'Keine Installation',
];

function Hero() {
  const [domain, setDomain] = useState('');
  const navigate = useNavigate();

  function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = domain.trim();
    if (trimmed) {
      navigate(`/audit?domain=${encodeURIComponent(trimmed)}&source=hero`);
    } else {
      navigate('/audit?source=hero');
    }
  }

  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-3xl mx-auto text-center">
        {/* Eyebrow */}
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-400 mb-5">
          Kostenloser DSGVO Website Check
        </p>

        {/* H1 */}
        <h1 className="font-display font-bold tracking-tight text-titanium-50 text-3xl sm:text-5xl leading-[1.08]">
          Prüfen Sie Ihre Website<br className="hidden sm:block" /> in 30 Sekunden
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-base sm:text-lg text-titanium-300 max-w-2xl mx-auto leading-relaxed">
          Erkennen Sie Tracker, Cookies, Drittlandtransfers, fehlende Rechtstexte
          und DSGVO-Risiken automatisch.
        </p>

        {/* Domain Input */}
        <form onSubmit={handleScan} className="mt-10 flex flex-col sm:flex-row gap-0 max-w-xl mx-auto">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="ihre-domain.de"
            className="flex-1 bg-obsidian-900 border border-titanium-700 border-r-0 px-4 py-3 text-sm text-titanium-50 placeholder-titanium-600 font-mono focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-6 py-3 text-sm font-semibold hover:bg-cyan-300 transition-colors shrink-0"
          >
            Kostenlos prüfen <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Trust Signals */}
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {HERO_TRUST_SIGNALS.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-titanium-500">
              <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
              {s}
            </span>
          ))}
        </div>

        {/* Governance OS mention */}
        <div className="mt-12 pt-8 border-t border-titanium-900">
          <p className="text-sm text-titanium-400 mb-3">
            Nach dem Scan wird aus dem Audit ein Governance OS Browser mit Monitoring, Evidence, Reports und Control Packs.
          </p>
          <Link
            to="/audit?source=landing_secondary"
            className="inline-flex items-center gap-2 border border-titanium-700 text-titanium-100 px-4 py-2 text-sm font-semibold hover:border-titanium-500 transition-colors"
          >
            Governance OS öffnen <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── 2 · Problem ─────────────────────────────────────────────────────

const RISKS = [
  { Icon: ShieldCheck,   title: 'DSGVO',        body: 'Consent-Timing, Drittlandtransfer und veraltete Erklärungen ändern sich laufend — manuell kaum nachzuhalten.' },
  { Icon: Gavel,         title: 'EU AI Act',    body: 'High-Risk-Klassifikation, Transparenz- und Dokumentationspflichten ohne laufenden Nachweis.' },
  { Icon: AlertTriangle, title: 'Vendor-Risk',  body: 'Sub-Prozessoren und DPA-Status ändern sich — ohne Inventar bleibt die Auswirkung unklar.' },
  { Icon: FileStack,     title: 'Doku-Aufwand', body: 'VVT, DSFA, Incident- und Vendor-Register manuell zu pflegen kostet Zeit und veraltet sofort.' },
];

function ProblemSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-2">
          Compliance ist manuell, teuer und riskant
        </h2>
        <p className="text-sm text-titanium-400 mb-10 max-w-2xl">
          Ein Audit veraltet in dem Moment, in dem das PDF gespeichert wird.
          DSGVO, AI Act und Vendor-Risiken ändern sich täglich — die
          Dokumentation nicht. Das automatisieren wir.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          {RISKS.map(({ Icon, title, body }) => (
            <div key={title} className="bg-obsidian-900 p-6">
              <Icon className="h-5 w-5 text-rose-300 mb-4" />
              <h3 className="font-display font-semibold text-titanium-50 mb-2">{title}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 3–6 · Detect → Monitor → Document → Prove ───────────────────────

const FLOW = [
  { Icon: ScanLine,  step: '01', key: 'Detect',   body: 'Scanner und Konnektoren erkennen Cookies, Tracker, Vendor, KI-Systeme und Agenten — auch unbekannte (Shadow AI).' },
  { Icon: Eye,       step: '02', key: 'Monitor',  body: 'Continuous Runtime: Drift, Consent-Änderungen und neue Tracker werden automatisch überwacht — kein einmaliger Snapshot.' },
  { Icon: FileStack, step: '03', key: 'Document',  body: 'Findings werden klassifiziert (DSGVO-Artikel, AI-Act-Klasse) und automatisch in Register, VVT, DSFA und Reports dokumentiert.' },
  { Icon: BadgeCheck,step: '04', key: 'Prove',    body: 'Jeder Nachweis landet in einer versiegelten Evidence-Chain (SHA-256, append-only) — auditfähig exportierbar.' },
];

function AutomationFlow() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3">
          So funktioniert es — automatisch
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-10">
          Detect · Monitor · Document · Prove
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          {FLOW.map(({ Icon, step, key, body }) => (
            <div key={key} className="bg-obsidian-900 p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <Icon className="h-5 w-5 text-cyan-300" />
                <span className="font-mono text-[10px] text-titanium-600">{step}</span>
              </div>
              <h3 className="font-display font-semibold text-titanium-50 mb-2">{key}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 7 · DSGVO-Automation ────────────────────────────────────────────

function DsgvoAutomation() {
  const items = [
    'Cookie-, Tracker- und Vendor-Scan mit Consent-Timing',
    'VVT, TOM, AVV und Datenschutzerklärung automatisch vorbereitet',
    'DSFA-Workflow und Auskunfts-/Löschanträge (Art. 15/17)',
    'Meldepflicht-Timer (72 h) und Sub-Prozessoren-Register',
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <ShieldCheck className="h-6 w-6 text-cyan-300 mb-4" />
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
            DSGVO-Automation
          </h2>
          <p className="text-sm text-titanium-400 leading-relaxed mb-6">
            Datenschutz wird automatisch überwacht und dokumentiert — Belege
            werden auditfähig exportierbar bereitgestellt, statt manuell
            gepflegt zu werden.
          </p>
          <Link to="/audit?source=landing_secondary" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            {CTA.startAudit} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <ul className="space-y-3">
          {items.map((t) => (
            <li key={t} className="flex items-start gap-3 text-sm text-titanium-200">
              <BadgeCheck className="h-4 w-4 text-cyan-300 shrink-0 mt-0.5" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── 8 · AI-Act-Automation ───────────────────────────────────────────

function AiActAutomation() {
  const items = [
    'KI-Inventar: erkannte AI-Systeme und Agenten automatisch erfasst',
    'Risiko-Klassifikation gegen Annex III (minimal → high-risk)',
    'Policies, Controls und Audit-Trail je AI-Usecase',
    'Transparenz- und Dokumentationspflichten automatisch vorbereitet',
  ];
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 items-start">
        <ul className="space-y-3 order-2 lg:order-1">
          {items.map((t) => (
            <li key={t} className="flex items-start gap-3 text-sm text-titanium-200">
              <BadgeCheck className="h-4 w-4 text-cyan-300 shrink-0 mt-0.5" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="order-1 lg:order-2">
          <Gavel className="h-6 w-6 text-cyan-300 mb-4" />
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
            AI-Act-Automation
          </h2>
          <p className="text-sm text-titanium-400 leading-relaxed mb-6">
            KI-Systeme werden automatisch inventarisiert, klassifiziert und
            überwacht. Nachweise werden auditfähig dokumentiert — kontinuierlich,
            nicht als einmaliger Bericht.
          </p>
          <Link to="/ai-act" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            {CTA.startAudit} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── 9 · Security & EU-Hosting ───────────────────────────────────────

const SECURITY = [
  { Icon: Server,      title: 'EU-Hosting',        body: 'Frankfurt-gehostet, EU-souverän. On-Premise-Variante und EU-lokale KI-Inferenz verfügbar.' },
  { Icon: Lock,        title: 'Verschlüsselung',   body: 'Verschlüsselung in Transit (TLS) und at-rest; Secrets isoliert, sensible Felder spaltenverschlüsselt.' },
  { Icon: ShieldCheck, title: 'Tenant-Isolation',  body: 'Strikte Mandantentrennung über Row-Level-Security (deny-by-default) auf jeder Tabelle.' },
  { Icon: BadgeCheck,  title: 'Audit-Logs',        body: 'Append-only Prüfpfad über jede Aktion — die Grundlage jeder Evidence.' },
];

function SecuritySection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-2">
          Security & EU-Hosting
        </h2>
        <p className="text-sm text-titanium-400 mb-10 max-w-2xl">
          EU-souverän by default. Sicherheit ist Voraussetzung für
          belastbare Nachweise — nicht ein nachgelagertes Feature.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          {SECURITY.map(({ Icon, title, body }) => (
            <div key={title} className="bg-obsidian-900 p-6">
              <Icon className="h-5 w-5 text-security-400 mb-4" />
              <h3 className="font-display font-semibold text-titanium-50 mb-2">{title}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Link to="/sicherheit" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
            Sicherheit im Detail <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── 10 · Für wen? ───────────────────────────────────────────────────

const AUDIENCE = [
  { Icon: Briefcase, title: 'Unternehmen',            body: 'Websites und KI-Systeme automatisch konform halten — ohne eigenes Compliance-Team.', to: '/branchen' },
  { Icon: Building2, title: 'Agenturen',              body: 'Mehrere Kunden-Domains zentral überwachen und auditfähig dokumentieren.', to: '/fuer-agenturen' },
  { Icon: UserCheck, title: 'Datenschutzbeauftragte', body: 'Register, DSFA und Prüfpfad an einem Ort — Nachweise per Export.', to: '/governance' },
  { Icon: Landmark,  title: 'Behörden',               body: 'EU-souverän, On-Premise-fähig, High-Risk-KI auditierbar dokumentiert.', to: '/oeffentliche-verwaltung' },
];

function AudienceSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-10">
          Für wen?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-titanium-900">
          {AUDIENCE.map(({ Icon, title, body, to }) => (
            <div key={title} className="bg-obsidian-900 p-6 flex flex-col">
              <Icon className="h-5 w-5 text-cyan-300 mb-4" />
              <h3 className="font-display font-semibold text-titanium-50 mb-2">{title}</h3>
              <p className="text-sm text-titanium-400 leading-relaxed mb-4">{body}</p>
              <Link to={to} className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                Mehr erfahren <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


// ─── 12 · Final CTA ──────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-3">
          Starten Sie noch heute — völlig kostenlos
        </h2>
        <p className="text-sm text-titanium-400 max-w-2xl mx-auto mb-8">
          Domain eintragen, Scan startet sofort. Risk-Score, Top-Findings und
          auditfähiger Report stehen nach wenigen Minuten bereit. Keine Karte, keine versteckten Gebühren.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
          <Link
            to="/audit?source=final-cta"
            className="inline-flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-6 py-3 text-sm font-semibold hover:bg-cyan-300 transition-colors rounded-none"
          >
            {CTA.startFree} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/app"
            className="inline-flex items-center justify-center gap-2 border border-amber-500 text-amber-300 px-6 py-3 text-sm font-semibold hover:bg-amber-500/10 transition-colors rounded-none"
          >
            {CTA.foundingAccess}
          </Link>
          <Link
            to="/app"
            className="inline-flex items-center justify-center gap-2 border border-titanium-700 text-titanium-100 px-6 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors rounded-none"
          >
            {CTA.openDashboard}
          </Link>
        </div>

        <p className="text-xs text-titanium-500 mt-6 font-mono uppercase tracking-wider">
          Keine Kreditkarte erforderlich · EU-Hosting · DSGVO-konform
        </p>
      </div>
    </section>
  );
}

// ─── Browser-Metapher-Section ─────────────────────────────────────────

const BROWSER_METAPHORS = [
  { icon: Globe,      label: 'Adresszeile',       mapping: 'Website, KI-System oder Risiko prüfen' },
  { icon: BarChart3,  label: 'Tabs',              mapping: 'Governance-Module: DSGVO, AI Act, Evidence' },
  { icon: Bot,        label: 'Seitenpanel',       mapping: 'KI-Assistent mit Modulkontext' },
  { icon: ScanLine,   label: 'Verlauf',           mapping: 'Audit Trail und Evidence-Snapshots' },
  { icon: Shield,     label: 'Sicherheitsstatus', mapping: 'Compliance Score und Risk-Level' },
  { icon: FileCheck2, label: 'Downloads',         mapping: 'Compliance-Reports und PDF-Exporte' },
  { icon: Activity,   label: 'Erweiterungen',     mapping: 'Module, Add-ons und Integrationen' },
];

function BrowserMetaphorSection() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-14 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-3">
            Warum als Browser?
          </p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-4">
            Compliance-Arbeit so bedienbar wie Web-Arbeit.
          </h2>
          <p className="text-base text-titanium-400 max-w-2xl leading-relaxed">
            Jeder kennt Browser. Deshalb macht der Governance OS Browser Compliance-Arbeit
            so bedienbar wie Web-Arbeit: mit Tabs, Address Bar, Arbeitsfläche, Verlauf,
            Evidence und KI-Assistent.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-titanium-900">
          {BROWSER_METAPHORS.map(({ icon: Icon, label, mapping }) => (
            <div key={label} className="bg-obsidian-900 p-5">
              <Icon className="h-4 w-4 text-cyan-400 mb-3" />
              <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">{label}</p>
              <p className="text-sm text-titanium-200 leading-snug">{mapping}</p>
            </div>
          ))}
          <div className="bg-obsidian-900 p-5 flex flex-col justify-between border-l border-titanium-800">
            <p className="text-sm text-titanium-400 leading-relaxed">
              Governance-Arbeit so vertraut wie Browser-Arbeit.
            </p>
            <Link
              to="/app"
              className="mt-4 inline-flex items-center gap-1.5 text-cyan-400 text-sm font-semibold hover:text-cyan-300 transition-colors"
            >
              Governance OS öffnen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="px-4 sm:px-6 py-10 text-titanium-500">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[12px]">
        <div className="font-mono uppercase tracking-[0.2em]">
          RealSyncDynamics.AI · EU-Frankfurt
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/impressum" className="hover:text-titanium-200">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-titanium-200">Datenschutz</Link>
          <Link to="/agb" className="hover:text-titanium-200">AGB</Link>
          <span className="text-titanium-700">© {year}</span>
        </nav>
      </div>
    </footer>
  );
}
