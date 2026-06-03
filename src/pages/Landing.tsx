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
import { Link } from 'react-router-dom';
import {
  ArrowRight, ShieldCheck, AlertTriangle, ScanLine, Eye, FileStack,
  BadgeCheck, Gavel, Lock, Building2, Briefcase, UserCheck, Landmark, Server,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { CTA } from '../content/runtimeVocab';
import { usePlatformStats, relativeTimeDe } from '../hooks/usePlatformStats';

export function Landing() {
  return (
    <>
      <Navbar />
      <main className="bg-obsidian-950 text-titanium-100 pt-14">
        <Hero />
        <ProblemSection />
        <AutomationFlow />
        <DsgvoAutomation />
        <AiActAutomation />
        <SecuritySection />
        <AudienceSection />
        <PricingTeaser />
        <FinalCta />
        <Footer />
      </main>
    </>
  );
}

// ─── 1 · Hero ────────────────────────────────────────────────────────

// Zielgruppen-Kacheln im Hero — breite Branchenansprache, Hard-Edge.
const HERO_AUDIENCE = [
  { title: 'Kleine Betriebe', body: 'Website fortlaufend auf DSGVO-Risiken, Einwilligungen und externe Dienste prüfen.' },
  { title: 'Online-Shops',    body: 'Tracking, Tools, Formulare und Datenflüsse zentral und nachvollziehbar überwachen.' },
  { title: 'Dienstleister',   body: 'Risiken, technische Änderungen und Compliance-Nachweise ohne Medienbruch dokumentieren.' },
  { title: 'Agenturen',       body: 'Mehrere Mandate, Reports und Governance-Prozesse in einer Oberfläche verwalten.' },
];

const HERO_SIGNALS = [
  'Kontinuierliche Überwachung',
  'Regulatorische Risiko-Erkennung',
  'Kryptografisch nachvollziehbare Evidenz',
  'EU-gehostete Infrastruktur',
];

function Hero() {
  const { data: stats } = usePlatformStats();

  // Echte Plattform-Aggregate (aus public.platform_stats), sonst Fallback.
  const domains = stats?.domainsScanned ?? 15;
  const openRisks = stats?.openRisks ?? 51;
  const evidencePct = stats?.evidencePct ?? 44;
  const lastScan = stats ? relativeTimeDe(stats.lastScanAt) : '—';
  const isLive = Boolean(stats);

  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,400px)] items-start">
        {/* Linke Spalte — Narrative + CTAs + Zielgruppen */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500 mb-4">
            Self-Service · EU-souverän · Auditfähig · Jede Branche
          </p>
          <h1 className="font-display font-bold tracking-tight text-titanium-50 text-3xl sm:text-5xl leading-[1.05] max-w-4xl">
            Kontinuierliche AI- und Compliance-Governance für jede Branche.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-titanium-300 max-w-3xl leading-relaxed">
            RealSyncDynamics.AI <strong className="text-titanium-100">erkennt</strong>,{' '}
            <strong className="text-titanium-100">überwacht</strong>,{' '}
            <strong className="text-titanium-100">dokumentiert</strong> und{' '}
            <strong className="text-titanium-100">beweist</strong> Risiken automatisch —
            für Betriebe, Shops, Dienstleister, Agenturen und wachsende
            Unternehmen. Ohne manuelle Dokumentation, mit nachvollziehbarer
            Evidenz für Websites, Datenflüsse und KI-Systeme.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/audit?source=hero"
              className="inline-flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-5 py-3 text-sm font-semibold hover:bg-cyan-300 transition-colors"
            >
              {CTA.startFree} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/welcome?source=hero"
              className="inline-flex items-center gap-2 border border-titanium-700 text-titanium-100 px-5 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors"
            >
              {CTA.openDashboard}
            </Link>
          </div>

          <p className="mt-6 font-mono text-[11px] text-titanium-500">
            Keine Karte nötig · EU-Hosting (Frankfurt) · kein Onboarding nötig
          </p>

          {/* Zielgruppen-Kacheln */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-titanium-900">
            {HERO_AUDIENCE.map(({ title, body }) => (
              <div key={title} className="bg-obsidian-900 p-4">
                <p className="font-display font-semibold text-titanium-50 text-sm">{title}</p>
                <p className="mt-2 text-sm text-titanium-400 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          {/* Signal-Chips */}
          <div className="mt-8 flex flex-wrap gap-2 font-mono text-[11px] text-titanium-400">
            {HERO_SIGNALS.map((s) => (
              <span key={s} className="border border-titanium-800 px-3 py-1">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Rechte Spalte — Live-Risikoübersicht-Widget */}
        <aside className="border border-titanium-800 bg-obsidian-900 p-5">
          <div className="flex items-center justify-between border-b border-titanium-800 pb-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-titanium-500">
                Governance Runtime
              </p>
              <p className="mt-1 font-display font-semibold text-titanium-50">
                Live-Risikoübersicht
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] text-emerald-300">
              <span className="h-1.5 w-1.5 bg-emerald-300" /> {isLive ? 'LIVE' : 'BEISPIEL'}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <div className="border border-titanium-800 bg-obsidian-950 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-titanium-500">Domains geprüft</p>
                  <p className="mt-1 font-display font-bold text-2xl text-titanium-50">{domains}</p>
                </div>
                <div>
                  <p className="text-sm text-titanium-500">Offene Risiken</p>
                  <p className="mt-1 font-display font-bold text-2xl text-amber-300">{openRisks}</p>
                </div>
              </div>
              <div className="mt-4 h-2 bg-titanium-800">
                <div className="h-2 bg-cyan-400" style={{ width: `${evidencePct}%` }} />
              </div>
              <p className="mt-2 font-mono text-[10px] text-titanium-500">
                {evidencePct} % der Prüfungen mit auditfähiger Evidenz
              </p>
            </div>

            <div className="grid gap-px bg-titanium-900 sm:grid-cols-2">
              <div className="bg-obsidian-900 p-4">
                <p className="text-sm text-titanium-500">Letzte Prüfung</p>
                <p className="mt-2 font-display font-semibold text-titanium-50">{lastScan}</p>
                <p className="mt-2 text-xs text-titanium-500 leading-5">
                  Website, Consent-Layer und externe Dienste automatisch neu bewertet.
                </p>
              </div>
              <div className="bg-obsidian-900 p-4">
                <p className="text-sm text-titanium-500">Evidence Status</p>
                <p className="mt-2 font-display font-semibold text-titanium-50">Auditierbar</p>
                <p className="mt-2 text-xs text-titanium-500 leading-5">
                  Änderungen, Funde und Maßnahmen nachvollziehbar dokumentiert.
                </p>
              </div>
            </div>
          </div>
        </aside>
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
          <Link to="/audit?source=dsgvo" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
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
          <Link to="/ai-governance" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
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

// ─── 11 · Preise ─────────────────────────────────────────────────────

const PLAN_TEASER = [
  { name: 'Free',       price: '€0',     note: '1 Scan, Score + Top-Findings', cta: CTA.startFree,          to: '/audit?source=pricing-free' },
  { name: 'Monitoring', price: 'ab €79', note: '24/7 Drift + Alerts',           cta: CTA.activateMonitoring, to: '/checkout/starter?source=pricing' },
  { name: 'Governance', price: 'ab €249',note: 'AI-Act-Register + DSFA',        cta: CTA.upgrade,            to: '/checkout/growth?source=pricing' },
  { name: 'Agency',     price: 'ab €699',note: 'Multi-Domain + White-Label',    cta: CTA.startPlan,          to: '/checkout/agency?source=pricing' },
];

function PricingTeaser() {
  return (
    <section className="border-b border-titanium-900 px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50 mb-2">
          Preise — self-service, ohne Gespräch
        </h2>
        <p className="text-sm text-titanium-400 mb-10 max-w-2xl">
          Alle Tarife sind direkt buchbar. Nur Enterprise (SSO, On-Premise,
          Behördenvertrag, Custom-DPA, Purchase Order) läuft über Anfrage.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-titanium-900">
          {PLAN_TEASER.map((p) => (
            <div key={p.name} className="bg-obsidian-900 p-6 flex flex-col">
              <h3 className="font-display font-semibold text-titanium-50">{p.name}</h3>
              <div className="font-display font-bold text-2xl text-titanium-50 mt-1 mb-1">{p.price}</div>
              <p className="text-xs text-titanium-500 mb-5">{p.note}</p>
              <Link to={p.to} className="mt-auto inline-flex items-center justify-center gap-2 border border-cyan-400/40 text-cyan-200 px-3 py-2 text-sm font-semibold hover:bg-cyan-400/10 transition-colors">
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-titanium-500">
          <Link to="/pricing" className="hover:text-titanium-200 underline-offset-4 hover:underline">Alle Tarife & Details</Link>
          <Link to="/contact-sales?tier=enterprise&source=pricing-teaser" className="hover:text-titanium-200 underline-offset-4 hover:underline">{CTA.enterprise}</Link>
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
          In zwei Minuten startklar
        </h2>
        <p className="text-sm text-titanium-400 max-w-2xl mx-auto mb-8">
          Domain eintragen, erster Scan läuft automatisch. Score, Befunde
          und auditfähiger Report stehen im Anschluss bereit.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/audit?source=final-cta"
            className="inline-flex items-center gap-2 bg-cyan-400 text-obsidian-950 px-5 py-3 text-sm font-semibold hover:bg-cyan-300 transition-colors"
          >
            {CTA.startFree} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/welcome?source=final-cta"
            className="inline-flex items-center gap-2 border border-titanium-700 text-titanium-100 px-5 py-3 text-sm font-semibold hover:border-titanium-500 transition-colors"
          >
            {CTA.openDashboard}
          </Link>
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
