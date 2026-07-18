import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { useHealthStatus } from '../hooks/useHealthStatus';
import {
  Snowflake,
  ShieldCheck,
  ArrowRight,
  PlayCircle,
  Radar,
  FileLock2,
  GitBranch,
  Scale,
  Lock,
  ServerCog,
  Code2,
  Check,
  Building2,
  Landmark,
  Megaphone,
  Cloud,
  Globe2,
  LineChart,
  Scan,
  MessageCircle,
  Phone,
} from 'lucide-react';

/**
 * ⛔ DESIGN-LOCK (genehmigte Baseline, Commit 3b972f3) — siehe CLAUDE.md.
 * Nur TEXTE/COPY und BUTTON-Beschriftungen (Strings) sowie Button-Link-Ziele
 * dürfen ohne Rückfrage geändert werden. JEDE Design-/Layout-/Struktur-/
 * Farb-/Komponenten-/Spacing-/Icon-Änderung braucht ausdrückliche Genehmigung.
 *
 * MainLanding — Unternehmenshauptseite (Root-Route).
 * Design: Obsidian-Hintergrund (rgb(3,7,18)), Earth-at-Night-Hero (Europa),
 * Cyan-Akzent, Plus Jakarta Sans + JetBrains Mono (Metadaten).
 *
 * Positionierung: „Das KI-Betriebssystem für DSGVO, EU AI Act &
 * Code-Compliance" — Governance + Claude-Code-Optimierung in einer Runtime.
 */

const BG = 'rgb(3, 7, 18)';
const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

const NAV_LINKS = [
  { label: 'Produkt', to: '#product' },
  { label: 'Automatisierung', to: '/automations' },
  { label: 'Evidence', to: '/evidence' },
  { label: 'AI Act', to: '/ai-act' },
  { label: 'Sicherheit', to: '#security' },
  { label: 'Preise', to: '#pricing' },
];

// Hero-Feature-Spalten (Screenshot: Icon + Titel + Kurztext).
const HERO_FEATURES = [
  { icon: ShieldCheck, title: 'DSGVO-KONFORM', text: 'Evidenz, Prozesse und Policies automatisiert.' },
  { icon: Globe2, title: 'AI-ACT-READY', text: 'Risikobewertung, Transparenz & Dokumentation.' },
  { icon: LineChart, title: 'KONTINUIERLICH', text: 'Monitoring, Alerts & Evidenz in Echtzeit.' },
];

const TRUST = ['DSGVO Art. 32', 'EU AI Act', 'TDDDG', 'BAIT', 'MaRisk', 'EU-Hosting'];

const PLATFORM = [
  {
    icon: Radar,
    title: 'Runtime-Monitoring',
    text: 'Kontinuierliche Telemetrie über Websites, Datenflüsse und KI-Systeme — regulatorische Risiken werden erkannt, sobald sie entstehen.',
  },
  {
    icon: FileLock2,
    title: 'Evidence Vault',
    text: 'Kryptografisch nachvollziehbare Nachweise mit lückenlosem Prüfpfad. Audit-fähig, unveränderlich, exportierbar.',
  },
  {
    icon: Scale,
    title: 'AI-Act-Klassifizierung',
    text: 'Automatische Einstufung von KI-Systemen nach Risikoklasse inklusive Transparenz- und Dokumentationspflichten.',
  },
  {
    icon: Code2,
    title: 'Claude Code Integration',
    text: 'Automatisierte Code-Analyse und Code-Fixes für datenschutz- und regelkonforme Softwareentwicklung.',
  },
  {
    icon: ServerCog,
    title: 'Governance-Runtime',
    text: 'Policies werden zur Laufzeit durchgesetzt — nicht nur dokumentiert. Jeder externe Call wird geloggt und bewertet.',
  },
  {
    icon: GitBranch,
    title: 'Automatisierung',
    text: 'DSGVO-Selfservice (Art. 15 + 17), Workflows und Alerts — orchestriert und nahtlos integriert.',
  },
];

const CORE_SEGMENTS = [
  { icon: Megaphone, title: 'Agenturen', text: 'Tracking, Consent und Kampagnen-KI für viele Kunden — mandantengetrennt, White-Label und in einem Dashboard.', to: '/agencies' },
  { icon: Scale, title: 'Datenschutz- & KI-Kanzleien', text: 'Compliance as a Service für Ihre Mandanten — Multi-Tenant im White-Label-Kanzlei-Modus, auditfest dokumentiert.', to: '/legaltech' },
  { icon: Cloud, title: 'SaaS & Technologie', text: 'Eigene KI-Features auditierbar machen — Transparenz- und Dokumentationspflichten nach EU AI Act erfüllt by Design.', to: '/fuer-saas' },
  { icon: Landmark, title: 'Regulierte Unternehmen', text: 'BAIT, MaRisk, KRITIS und Scoring-Modelle — KI-Entscheidungen nachvollziehbar, prüfbar und aufsichtskonform.', to: '/branchen' },
];

const STEPS = [
  { no: '01', title: 'Verbinden', text: 'Domains, KI-Systeme, Code und Datenflüsse in Minuten anbinden — ohne schwere Integration.' },
  { no: '02', title: 'Überwachen', text: 'Die Runtime erfasst kontinuierlich Telemetrie und bewertet Risiken in Echtzeit.' },
  { no: '03', title: 'Nachweisen', text: 'Jede Maßnahme landet als kryptografische Evidenz im auditfähigen Prüfpfad.' },
];

const PRICING = [
  { name: 'Starter', price: '79', cadence: '/Monat', features: ['1 Domain', 'Runtime-Monitoring', 'Evidence Vault', 'DSGVO-Selfservice'], cta: '14 Tage testen', to: '/checkout/starter?source=home&pilot=true' },
  { name: 'Growth', price: '249', cadence: '/Monat', features: ['5 Domains', 'AI-Act-Klassifizierung', 'Alerts & Workflows', 'Konversations-Bots'], cta: '14 Tage testen', featured: true, to: '/checkout/growth?source=home&pilot=true' },
  { name: 'Agency', price: '699', cadence: '/Monat', features: ['25 Domains', 'White-Label', 'Herkunftsnachweis (C2PA)', 'API-Zugriff'], cta: '14 Tage testen', to: '/checkout/agency?source=home&pilot=true' },
  { name: 'Partner', price: '1.999', cadence: '/Monat', features: ['Bis zu 50 Mandanten', 'DSB-Kanzlei-Modus', 'Voller API-Zugriff', 'SLA'], cta: 'Partner anfragen', to: '/contact-sales?tier=scale&source=home' },
];

export function MainLanding() {
  return (
    <div className="min-h-screen text-white antialiased" style={{ backgroundColor: BG, fontFamily: FONT_STACK }}>
      <SEOHead />
      <Header />
      <Hero />
      <TrustStrip />
      <Platform />
      <Runtime />
      <Industries />
      <ProofBand />
      <Pricing />
      <Security />
      <ProductEntryPoints />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ── HEADER ─────────────────────────────────────────────── */
function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 sm:h-20 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
          <Snowflake className="w-5 sm:w-6 h-5 sm:h-6 text-cyan-400" strokeWidth={1.5} />
          <span className="text-sm sm:text-lg font-semibold tracking-tight">
            RealSync <span className="font-normal text-white/90">Dynamics.AI</span>
          </span>
        </a>
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          {NAV_LINKS.map((l) => (
            <SmartLink key={l.label} to={l.to} className="text-sm text-white/70 hover:text-white transition-colors">{l.label}</SmartLink>
          ))}
          <SmartLink to="/flow/login" className="text-sm text-white/70 hover:text-white transition-colors">Login</SmartLink>
        </nav>
        <SmartLink to="/flow/start-scan?source=nav-startfree" className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg flex-shrink-0">
          Kostenlos starten<ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </SmartLink>
      </div>
    </header>
  );
}

/* ── HERO ───────────────────────────────────────────────── */
function Hero() {
  const { label: monitoringLabel, pulse } = useHealthStatus();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src="/europe-globe.jpg" alt="Europa-zentrierter Globus bei Nacht — Satellitenperspektive" className="w-full h-full object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgb(3,7,18)] via-[rgb(3,7,18)]/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(3,7,18)] via-transparent to-[rgb(3,7,18)]/40" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 pt-28 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <SmartLink to="/claude-code-optimizer?source=home-hero-pill" className="group inline-flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1 sm:py-1.5 mb-6 sm:mb-8 border border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/60 transition-colors rounded-full">
              <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wider text-[rgb(3,7,18)] bg-cyan-400 rounded">NEU</span>
              <span className="font-mono text-[10px] sm:text-xs tracking-widest text-cyan-300 flex items-center gap-1">
                CLAUDE CODE OPTIMIZER<ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </SmartLink>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] sm:leading-[1.05] tracking-tight mb-4 sm:mb-6">
              Das KI-Betriebssystem<br />für <span className="text-cyan-400">DSGVO, EU AI Act<br />&amp; Code-Compliance</span>
            </h1>

            <p className="font-mono text-[11px] sm:text-sm tracking-[0.25em] text-cyan-400/90 mb-4 sm:mb-6">
              AI GOVERNANCE &amp; CODE OPTIMIZATION OS FOR TRUST &amp; VALUE
            </p>

            <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-xl leading-relaxed mb-7 sm:mb-8">
              RealSync Dynamics AI überwacht Websites, KI-Systeme, Code und Evidenz
              kontinuierlich — DSGVO-konform, AI-Act-ready, Claude-Code-auditiert und prüfbar.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 mb-8 sm:mb-10 max-w-xl">
              {HERO_FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="w-4 h-4 text-cyan-400 shrink-0" strokeWidth={1.75} />
                    <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-wider text-white/90">{title}</span>
                  </div>
                  <p className="text-xs text-white/55 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <SmartLink to="/flow/start-scan?source=home-hero" className="inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg">
                Kostenlos starten<ArrowRight className="w-4 h-4" />
              </SmartLink>
              <SmartLink to="/app" className="inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg">
                <PlayCircle className="w-4 h-4" />Produkt-Tour ansehen
              </SmartLink>
            </div>
          </div>

          {/* Metrik-Karten über dem Globus — wie im Screenshot */}
          <div className="relative hidden lg:block min-h-[560px]">
            <MetricCard className="absolute top-0 right-24" metric={{ label: 'DSGVO', value: 'Konform', accent: true }} />
            <RiskCard className="absolute top-24 right-0" />
            <MetricCard className="absolute top-44 left-4" metric={{ label: 'EVIDENZ', value: '1.248', suffix: 'Nachweise' }} />
            <ClaudeCodeAuditCard className="absolute top-64 right-6" />
            <MetricCard className="absolute top-64 right-64" metric={{ label: 'EU AI ACT', value: 'READY', accent: true }} />
            <MonitoringCard className="absolute bottom-16 right-40" label={monitoringLabel} pulse={pulse} />
            <ClaudeCodeIntegrationCard className="absolute bottom-0 left-0" />
          </div>
        </div>

        {/* Mobile: Karten gestapelt */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12 lg:hidden">
          <MetricCard metric={{ label: 'DSGVO', value: 'Konform', accent: true }} />
          <RiskCard />
          <MetricCard metric={{ label: 'EVIDENZ', value: '1.248', suffix: 'Nachweise' }} />
          <MetricCard metric={{ label: 'EU AI ACT', value: 'READY', accent: true }} />
          <ClaudeCodeAuditCard className="sm:col-span-2" />
          <MonitoringCard label={monitoringLabel} pulse={pulse} />
          <ClaudeCodeIntegrationCard className="sm:col-span-2" />
        </div>
      </div>
    </section>
  );
}

/* ── TRUST-STRIP ────────────────────────────────────────── */
function TrustStrip() {
  return (
    <section className="relative z-10 border-y border-white/10 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 sm:py-6 flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-8 lg:gap-x-10 gap-y-2.5 sm:gap-y-3">
        <span className="font-mono text-[10px] sm:text-[11px] tracking-widest text-white/40 uppercase">Konform mit</span>
        {TRUST.map((t) => (
          <span key={t} className="font-mono text-[11px] sm:text-xs tracking-wider text-white/60">{t}</span>
        ))}
      </div>
    </section>
  );
}

/* ── PLATTFORM ──────────────────────────────────────────── */
function Platform() {
  return (
    <Section id="product" eyebrow="DIE PLATTFORM" title="Eine Runtime. Vollständige KI-Governance." subtitle="Vom kontinuierlichen Monitoring bis zum kryptografischen Nachweis — alles in einer auditfähigen Infrastruktur, mit integriertem Claude-Code-Audit.">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
        {PLATFORM.map(({ icon: Icon, title, text }) => (
          <div key={title} className="group p-6 sm:p-8 bg-[rgb(3,7,18)] hover:bg-white/[0.03] transition-colors">
            <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 mb-5">
              <Icon className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-semibold mb-2.5">{title}</h3>
            <p className="text-sm text-white/60 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── GOVERNANCE-RUNTIME ─────────────────────────────────── */
function Runtime() {
  return (
    <Section eyebrow="SO FUNKTIONIERT ES" title="Compliance, die ab Minute eins läuft" subtitle="Keine Monate-Projekte, keine statischen PDFs — Governance läuft ab dem ersten Tag zur Laufzeit.">
      <div className="grid md:grid-cols-3 gap-6">
        {STEPS.map(({ no, title, text }) => (
          <div key={no} className="relative p-8 border border-white/10 rounded-2xl bg-white/[0.02]">
            <span className="font-mono text-5xl font-bold text-cyan-400/20">{no}</span>
            <h3 className="text-xl font-semibold mt-4 mb-2.5">{title}</h3>
            <p className="text-sm text-white/60 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── BRANCHEN ───────────────────────────────────────────── */
function Industries() {
  return (
    <Section eyebrow="FÜR WEN" title="Gebaut für Teams, die Governance betreiben müssen" subtitle="Dieselbe Runtime — auf den jeweiligen regulatorischen Schmerzpunkt zugeschnitten.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
        {CORE_SEGMENTS.map(({ icon: Icon, title, text, to }) => (
          <SmartLink key={title} to={to} className="group flex gap-4 p-6 sm:p-8 bg-[rgb(3,7,18)] hover:bg-white/[0.03] transition-colors">
            <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 shrink-0">
              <Icon className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="flex items-center gap-1.5 text-base sm:text-lg font-semibold mb-1.5">
                {title}
                <ArrowRight className="w-4 h-4 text-cyan-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h3>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed">{text}</p>
            </div>
          </SmartLink>
        ))}
      </div>
    </Section>
  );
}

/* ── PROOF-BAND ─────────────────────────────────────────── */
function ProofBand() {
  const stats = [
    { value: '24/7', label: 'Kontinuierliches Monitoring' },
    { value: '100%', label: 'EU-Hosting & Datenresidenz' },
    { value: '< 5 Min', label: 'Bis zum ersten Nachweis' },
    { value: '94.2%', label: 'Claude-Code-Readiness-Score' },
  ];
  return (
    <section className="relative z-10 py-12 sm:py-16 border-y border-white/10 bg-gradient-to-r from-cyan-500/[0.04] via-transparent to-cyan-500/[0.04]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {stats.map(({ value, label }) => (
          <div key={label} className="text-center">
            <div className="font-mono text-2xl sm:text-3xl md:text-4xl font-bold text-cyan-400 mb-2">{value}</div>
            <div className="text-xs sm:text-sm text-white/60 leading-relaxed">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── PRICING ────────────────────────────────────────────── */
function Pricing() {
  return (
    <Section id="pricing" eyebrow="PREISE" title="Preise, die mit Ihrer Verantwortung skalieren" subtitle="14 Tage kostenlos testen · transparent, metered, jederzeit kündbar — ohne Setup-Gebühr und ohne Berater-Tagessätze.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {PRICING.map((p) => (
          <div key={p.name} className={`relative flex flex-col p-7 rounded-2xl border ${p.featured ? 'border-cyan-400/60 bg-cyan-500/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
            {p.featured && (
              <span className="absolute -top-3 left-7 px-3 py-1 text-[10px] font-bold tracking-wider text-[rgb(3,7,18)] bg-cyan-400 rounded-full">BELIEBT</span>
            )}
            <h3 className="text-lg font-semibold mb-1">{p.name}</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-mono text-3xl font-bold">{p.price} €</span>
              <span className="font-mono text-xs text-white/40">{p.cadence}</span>
            </div>
            <ul className="flex-1 space-y-3 mb-7">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                  <Check className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" strokeWidth={2} />{f}
                </li>
              ))}
            </ul>
            <SmartLink to={p.to} className={`inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg transition-colors ${p.featured ? 'text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300' : 'text-white border border-white/20 hover:border-white/40 hover:bg-white/5'}`}>
              {p.cta}<ArrowRight className="w-4 h-4" />
            </SmartLink>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-4 p-6 sm:p-7 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-start sm:items-center gap-4 flex-1">
          <div className="w-10 sm:w-11 h-10 sm:h-11 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 flex-shrink-0">
            <Building2 className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold">Enterprise / On-Prem</h3>
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">Custom Runtime, SLA, AI-Act-Modul, DSB-Integration, Private Cloud, unlimitierte Domains.</p>
          </div>
        </div>
        <SmartLink to="/contact-sales?tier=enterprise&source=home" className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg whitespace-nowrap flex-shrink-0">
          Enterprise anfragen<ArrowRight className="w-4 h-4" />
        </SmartLink>
      </div>
    </Section>
  );
}

/* ── SICHERHEIT ─────────────────────────────────────────── */
function Security() {
  const points = [
    { icon: Lock, title: 'EU-Souveränität', text: 'Hosting, Verarbeitung und Modelle innerhalb der EU. Optional lokale Modelle für maximale Datenkontrolle.' },
    { icon: FileLock2, title: 'Kryptografische Evidenz', text: 'Jeder Nachweis ist signiert und unveränderlich — ein lückenloser Prüfpfad für Audits und Aufsichtsbehörden.' },
    { icon: ShieldCheck, title: 'Service-Role-Isolation', text: 'Sensible Keys ausschließlich serverseitig. RLS schützt jede Tabelle auf Mandantenebene.' },
  ];
  return (
    <Section id="security" eyebrow="SICHERHEIT & COMPLIANCE" title="Vertrauen ist in die Architektur eingebaut" subtitle="Nicht nachgelagert, sondern Fundament: Souveränität, Nachweisbarkeit und Isolation by Design.">
      <div className="grid md:grid-cols-3 gap-6">
        {points.map(({ icon: Icon, title, text }) => (
          <div key={title} className="p-8 border border-white/10 rounded-2xl bg-white/[0.02]">
            <Icon className="w-6 h-6 text-cyan-400 mb-5" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold mb-2.5">{title}</h3>
            <p className="text-sm text-white/60 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── PRODUCT ENTRY POINTS ───────────────────────────────── */
function ProductEntryPoints() {
  const products = [
    {
      icon: Scan,
      title: 'Website Compliance Scan',
      text: 'Kostenloser automatisierter Scan — DSGVO, EU AI Act und Code-Compliance prüfen. Detaillierter Bericht in Echtzeit.',
      to: '/scan/start',
    },
    {
      icon: MessageCircle,
      title: 'KI-Chat-Assistent',
      text: 'Intelligenter Chatbot für Ihre Website — EU-gehostet, auf Ihre Dokumentation trainiert, DSGVO-konform.',
      to: '/chatbot/start',
    },
    {
      icon: Phone,
      title: 'KI-Telefon-Assistent',
      text: 'Automatisierte Sprachanrufe mit vollständiger Dokumentation — Kundenservice, Terminvergabe, Compliance-Abfragen.',
      to: '/phonebot/start',
    },
  ];

  return (
    <Section eyebrow="NEUE PRODUKTE" title="KI-Assistenten & Compliance-Tools" subtitle="Starten Sie sofort — neue Einstiege für Website-Audits, Chat und Telefon-Automatisierung.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
        {products.map(({ icon: Icon, title, text, to }) => (
          <SmartLink key={title} to={to} className="group flex flex-col p-6 sm:p-8 bg-[rgb(3,7,18)] hover:bg-white/[0.03] transition-colors">
            <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 mb-5">
              <Icon className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />
            </div>
            <h3 className="flex items-center gap-1.5 text-lg font-semibold mb-2.5">
              {title}
              <ArrowRight className="w-4 h-4 text-cyan-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h3>
            <p className="text-sm text-white/60 leading-relaxed flex-1">{text}</p>
          </SmartLink>
        ))}
      </div>
    </Section>
  );
}

/* ── FINAL-CTA ──────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="relative z-10 py-16 md:py-24">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.02] to-transparent p-8 sm:p-12 md:p-16 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight mb-4 sm:mb-5">
            Bereit für Governance,<br className="hidden sm:block" /> die zur Laufzeit läuft?
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
            Starten Sie mit einem kostenlosen Scan — ohne Account, in unter fünf Minuten. Sehen Sie
            Ihren DSGVO-, AI-Act- und Claude-Code-Readiness-Score sofort.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <SmartLink to="/flow/start-scan?source=home-final" className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg">
              Kostenlos starten<ArrowRight className="w-4 h-4" />
            </SmartLink>
            <SmartLink to="/app" className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg">
              <PlayCircle className="w-4 h-4" />Produkt-Tour ansehen
            </SmartLink>
          </div>
          <p className="mt-5 font-mono text-[10px] sm:text-xs tracking-wider text-white/40">
            Self-Service · ohne Account · kein Verkaufsgespräch nötig
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── FOOTER ─────────────────────────────────────────────── */
function Footer() {
  const cols = [
    { title: 'Produkt', links: [
      { label: 'Runtime-Monitoring', to: '/runtime' },
      { label: 'Evidence Vault', to: '/evidence-vault' },
      { label: 'AI-Act-Klassifizierung', to: '/ai-act-klassifikator' },
      { label: 'Automatisierung', to: '/automations' },
    ] },
    { title: 'Lösungen', links: [
      { label: 'Agenturen', to: '/agencies' },
      { label: 'DSB-Kanzleien', to: '/legaltech' },
      { label: 'Branchen', to: '/branchen' },
      { label: 'Case Studies', to: '/case-studies' },
    ] },
    { title: 'Ressourcen', links: [
      { label: 'Dokumentation', to: '/docs' },
      { label: 'Roadmap', to: '/roadmap' },
      { label: 'Blog', to: '/blog' },
      { label: 'Sicherheit', to: '/security' },
    ] },
    { title: 'Unternehmen', links: [
      { label: 'Über uns', to: '/about' },
      { label: 'Kontakt', to: '/contact-sales' },
      { label: 'Impressum', to: '/impressum' },
      { label: 'Datenschutz', to: '/datenschutz' },
      { label: 'AGB', to: '/agb' },
    ] },
  ];
  return (
    <footer className="relative z-10 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 sm:py-14">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 lg:gap-10">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <Snowflake className="w-5 h-5 text-cyan-400" strokeWidth={1.5} />
              <span className="text-sm sm:text-base font-semibold tracking-tight">RealSync Dynamics.AI</span>
            </Link>
            <p className="text-[11px] sm:text-xs text-white/50 leading-relaxed max-w-xs">
              Das KI-Betriebssystem für DSGVO, EU AI Act und Code-Compliance.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="font-mono text-[10px] sm:text-[11px] tracking-widest text-white/40 uppercase mb-3 sm:mb-4">{c.title}</h4>
              <ul className="space-y-2">
                {c.links.map((l) => (
                  <li key={l.label}><SmartLink to={l.to} className="text-xs sm:text-sm text-white/60 hover:text-white transition-colors">{l.label}</SmartLink></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 sm:mt-12 pt-5 sm:pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-center sm:text-left">
          <p className="font-mono text-[10px] sm:text-xs text-white/50">© 2026 RealSync Dynamics. SaaS &amp; KI-Innovationen.</p>
          <nav className="flex flex-wrap items-center justify-center sm:justify-end gap-x-3 sm:gap-x-5 gap-y-2">
            <Link to="/impressum" className="font-mono text-[10px] sm:text-xs text-white/50 hover:text-white transition-colors">Impressum</Link>
            <Link to="/datenschutz" className="font-mono text-[10px] sm:text-xs text-white/50 hover:text-white transition-colors">Datenschutz</Link>
            <Link to="/agb" className="font-mono text-[10px] sm:text-xs text-white/50 hover:text-white transition-colors">AGB</Link>
            <span className="font-mono text-[10px] sm:text-xs text-white/40">EU-Hosting · DSGVO · EU AI Act</span>
          </nav>
        </div>
      </div>
    </footer>
  );
}

/* ── HELPERS ────────────────────────────────────────────── */
function SmartLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  if (to.startsWith('/')) {
    return <Link to={to} className={className}>{children}</Link>;
  }
  return <a href={to} className={className}>{children}</a>;
}

function Section({ id, eyebrow, title, subtitle, children }: { id?: string; eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section id={id} className="relative z-10 py-16 md:py-24 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-2xl mb-10 md:mb-12">
          <p className="font-mono text-[10px] sm:text-xs tracking-[0.25em] text-cyan-400/90 mb-3 sm:mb-4">{eyebrow}</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 sm:mb-4">{title}</h2>
          <p className="text-sm sm:text-base text-white/60 leading-relaxed">{subtitle}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

type Metric = { label: string; value: string; suffix?: string; accent?: boolean };

function CardShell({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`px-4 py-3 sm:px-5 sm:py-4 border border-white/10 bg-white/5 backdrop-blur-md rounded-xl shadow-2xl ${className}`}>
      {children}
    </div>
  );
}

function MetricCard({ metric, className = '' }: { metric: Metric; className?: string }) {
  return (
    <CardShell className={className}>
      <div className="flex items-center gap-2 mb-2">
        {metric.accent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        <span className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/50">{metric.label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono font-bold ${metric.accent ? 'text-cyan-400 text-base sm:text-lg' : 'text-white text-xl sm:text-2xl'}`}>{metric.value}</span>
        {metric.suffix && <span className="font-mono text-[11px] sm:text-xs text-white/40">{metric.suffix}</span>}
      </div>
    </CardShell>
  );
}

function RiskCard({ className = '' }: { className?: string }) {
  return (
    <CardShell className={className}>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        <span className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/50">RISK SCORE</span>
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="font-mono font-bold text-white text-2xl sm:text-3xl">87</span>
        <span className="font-mono text-[11px] sm:text-xs text-white/40">/100</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-[87%] rounded-full bg-cyan-400" />
      </div>
    </CardShell>
  );
}

function MonitoringCard({ label, pulse, className = '' }: { label: string; pulse: boolean; className?: string }) {
  return (
    <CardShell className={className}>
      <div className="flex items-center gap-2 mb-2">
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
        <span className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/50">MONITORING</span>
      </div>
      <div className="flex items-center gap-2">
        <LineChart className="w-4 h-4 text-cyan-400" strokeWidth={1.75} />
        <span className="font-mono font-bold text-cyan-400 text-base sm:text-lg">{label}</span>
      </div>
    </CardShell>
  );
}

function ClaudeCodeAuditCard({ className = '' }: { className?: string }) {
  return (
    <CardShell className={className}>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        <span className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/50">CLAUDE CODE AUDIT</span>
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="font-mono font-bold text-white text-2xl sm:text-3xl">94.2%</span>
        <span className="font-mono text-[11px] sm:text-xs text-cyan-400">Code-Ready</span>
      </div>
      <div className="space-y-0.5">
        <div className="font-mono text-[10px] text-white/50">Analysierte Codezeilen: <span className="text-white/80">2.1 Mio</span></div>
        <div className="font-mono text-[10px] text-white/50">Behobene Sicherheitslücken: <span className="text-white/80">11.350</span></div>
      </div>
    </CardShell>
  );
}

function ClaudeCodeIntegrationCard({ className = '' }: { className?: string }) {
  return (
    <CardShell className={`max-w-xs ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Code2 className="w-3.5 h-3.5 text-cyan-400" strokeWidth={2} />
        <span className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/50">CLAUDE CODE INTEGRATION</span>
      </div>
      <p className="text-[11px] sm:text-xs text-white/70 leading-relaxed">
        Automatisierte Code-Analyse und Code-Fixes für datenschutz- und regelkonforme Softwareentwicklung.
      </p>
    </CardShell>
  );
}
