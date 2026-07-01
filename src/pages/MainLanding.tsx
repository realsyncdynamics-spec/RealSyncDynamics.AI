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
} from 'lucide-react';

/**
 * MainLanding — Unternehmenshauptseite (Root-Route).
 * Design: Obsidian-Hintergrund (rgb(3,7,18)), Earth-at-Night-Hero (Europa),
 * Cyan-Akzent, Plus Jakarta Sans + JetBrains Mono (Metadaten).
 *
 * Positionierung: „The AI Operating System for GDPR, EU AI Act &
 * Code-Compliance" — Governance + Claude-Code-Optimierung in einer Runtime.
 */

const BG = 'rgb(3, 7, 18)';
const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

const NAV_LINKS = [
  { label: 'Product', to: '#product' },
  { label: 'Automation', to: '/automations' },
  { label: 'Evidence', to: '/evidence' },
  { label: 'AI Act', to: '/ai-act' },
  { label: 'Security', to: '#security' },
  { label: 'Pricing', to: '#pricing' },
];

// Hero-Feature-Spalten (Screenshot: Icon + Titel + Kurztext).
const HERO_FEATURES = [
  { icon: ShieldCheck, title: 'GDPR-COMPLIANT', text: 'Evidence, processes, and policies automated.' },
  { icon: Globe2, title: 'AI-ACT-READY', text: 'Risk assessment, transparency & documentation.' },
  { icon: LineChart, title: 'CONTINUOUS', text: 'Monitoring, alerts & evidence in real time.' },
];

const TRUST = ['GDPR Art. 32', 'EU AI Act', 'TTDSG', 'BAIT', 'MaRisk', 'EU Hosting'];

const PLATFORM = [
  {
    icon: Radar,
    title: 'Runtime Monitoring',
    text: 'Continuous telemetry across websites, data flows and AI systems — regulatory risks are detected the moment they appear.',
  },
  {
    icon: FileLock2,
    title: 'Evidence Vault',
    text: 'Cryptographically verifiable evidence with a gap-free audit trail. Audit-ready, immutable, exportable.',
  },
  {
    icon: Scale,
    title: 'AI Act Classification',
    text: 'Automatic classification of AI systems by risk class, including transparency and documentation obligations.',
  },
  {
    icon: Code2,
    title: 'Claude Code Integration',
    text: 'Automated code analysis and code fixes for privacy- and regulation-compliant software development.',
  },
  {
    icon: ServerCog,
    title: 'Governance Runtime',
    text: 'Policies are enforced at runtime — not just documented. Every external call is logged and scored.',
  },
  {
    icon: GitBranch,
    title: 'Automation',
    text: 'GDPR self-service (Art. 15 + 17), workflows and alerts — orchestrated and seamlessly integrated.',
  },
];

const CORE_SEGMENTS = [
  { icon: Megaphone, title: 'Agencies', text: 'Tracking, consent and campaign AI for many clients — tenant-separated, white-label, in one dashboard.', to: '/agencies' },
  { icon: Scale, title: 'Privacy & AI Law Firms', text: 'Compliance as a service for your clients — multi-tenant white-label firm mode, audit-proof by design.', to: '/legaltech' },
  { icon: Cloud, title: 'SaaS & Technology', text: 'Make your own AI features auditable — EU AI Act transparency and documentation duties met by design.', to: '/fuer-saas' },
  { icon: Landmark, title: 'Regulated Companies', text: 'BAIT, MaRisk, KRITIS and scoring models — AI decisions traceable, verifiable and supervisor-ready.', to: '/branchen' },
];

const STEPS = [
  { no: '01', title: 'Connect', text: 'Onboard domains, AI systems, code and data flows in minutes — no heavy integration.' },
  { no: '02', title: 'Monitor', text: 'The runtime continuously captures telemetry and scores risks in real time.' },
  { no: '03', title: 'Prove', text: 'Every action lands as cryptographic evidence in the audit-ready trail.' },
];

const PRICING = [
  { name: 'Starter', price: '79', cadence: '/mo', features: ['1 Domain', 'Runtime Monitoring', 'Evidence Vault', 'GDPR Self-Service'], cta: 'Start for Free', to: '/audit' },
  { name: 'Growth', price: '249', cadence: '/mo', features: ['5 Domains', 'AI Act Classification', 'Alerts & Workflows', 'Priority Support'], cta: 'Choose Growth', featured: true, to: '/audit' },
  { name: 'Agency', price: '699', cadence: '/mo', features: ['25 Domains', 'White-Label', 'Multi-Tenant Dashboard', 'API Access'], cta: 'Choose Agency', to: '/agencies' },
  { name: 'Scale', price: '1,999', cadence: '/mo', features: ['Up to 50 tenants', 'DPO firm mode', 'Full API access', 'SLA'], cta: 'Choose Scale', to: '/contact-sales' },
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
          <SmartLink to="/app" className="text-sm text-white/70 hover:text-white transition-colors">Login</SmartLink>
        </nav>
        <SmartLink to="/audit?source=nav-startfree" className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg flex-shrink-0">
          Start for Free<ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
        <img src="/europe-globe.jpg" alt="Europe-centered globe at night — satellite perspective" className="w-full h-full object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgb(3,7,18)] via-[rgb(3,7,18)]/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(3,7,18)] via-transparent to-[rgb(3,7,18)]/40" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 pt-28 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1 sm:py-1.5 mb-6 sm:mb-8 border border-cyan-500/40 bg-cyan-500/5 rounded-full">
              <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wider text-[rgb(3,7,18)] bg-cyan-400 rounded">NEW</span>
              <span className="font-mono text-[10px] sm:text-xs tracking-widest text-cyan-300 flex items-center gap-1">
                CLAUDE CODE OPTIMIZER<ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] sm:leading-[1.05] tracking-tight mb-4 sm:mb-6">
              The AI Operating System<br />for <span className="text-cyan-400">GDPR, EU AI Act<br />&amp; Code-Compliance</span>
            </h1>

            <p className="font-mono text-[11px] sm:text-sm tracking-[0.25em] text-cyan-400/90 mb-4 sm:mb-6">
              AI GOVERNANCE &amp; CODE OPTIMIZATION OS FOR TRUST &amp; VALUE
            </p>

            <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-xl leading-relaxed mb-7 sm:mb-8">
              RealSync Dynamics AI continuously monitors websites, AI systems, code, and
              evidence — GDPR-compliant, AI-Act-ready, Claude Code-audited, and auditable.
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
              <SmartLink to="/audit?source=home-hero" className="inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg">
                Start for Free<ArrowRight className="w-4 h-4" />
              </SmartLink>
              <SmartLink to="/app" className="inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg">
                <PlayCircle className="w-4 h-4" />View Product Tour
              </SmartLink>
            </div>
          </div>

          {/* Metrik-Karten über dem Globus — wie im Screenshot */}
          <div className="relative hidden lg:block min-h-[560px]">
            <MetricCard className="absolute top-0 right-24" metric={{ label: 'GDPR', value: 'Compliant', accent: true }} />
            <RiskCard className="absolute top-24 right-0" />
            <MetricCard className="absolute top-44 left-4" metric={{ label: 'EVIDENCE', value: '1,248', suffix: 'Evidence' }} />
            <ClaudeCodeAuditCard className="absolute top-64 right-6" />
            <MetricCard className="absolute top-64 right-64" metric={{ label: 'EU AI ACT', value: 'READY', accent: true }} />
            <MonitoringCard className="absolute bottom-16 right-40" label={monitoringLabel} pulse={pulse} />
            <ClaudeCodeIntegrationCard className="absolute bottom-0 left-0" />
          </div>
        </div>

        {/* Mobile: Karten gestapelt */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12 lg:hidden">
          <MetricCard metric={{ label: 'GDPR', value: 'Compliant', accent: true }} />
          <RiskCard />
          <MetricCard metric={{ label: 'EVIDENCE', value: '1,248', suffix: 'Evidence' }} />
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
        <span className="font-mono text-[10px] sm:text-[11px] tracking-widest text-white/40 uppercase">Compliant with</span>
        {TRUST.map((t) => (
          <span key={t} className="font-mono text-[11px] sm:text-xs tracking-wider text-white/60">{t}</span>
        ))}
      </div>
    </section>
  );
}

/* ── PLATFORM ───────────────────────────────────────────── */
function Platform() {
  return (
    <Section id="product" eyebrow="THE PLATFORM" title="One runtime. Complete AI governance." subtitle="From continuous monitoring to cryptographic proof — all in one audit-ready infrastructure, with Claude Code auditing built in.">
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

/* ── RUNTIME ────────────────────────────────────────────── */
function Runtime() {
  return (
    <Section eyebrow="HOW IT WORKS" title="Compliance that runs from minute one" subtitle="No months-long projects, no static PDFs — governance runs at runtime from day one.">
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

/* ── INDUSTRIES ─────────────────────────────────────────── */
function Industries() {
  return (
    <Section eyebrow="WHO IT'S FOR" title="Built for the teams that must run governance" subtitle="The same runtime — tailored to each regulatory pain point.">
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
    { value: '24/7', label: 'Continuous monitoring' },
    { value: '100%', label: 'EU hosting & data residency' },
    { value: '< 5 min', label: 'To first evidence' },
    { value: '94.2%', label: 'Claude Code-ready score' },
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
    <Section id="pricing" eyebrow="PRICING" title="Pricing that scales with your responsibility" subtitle="Transparent, metered, cancel anytime — no setup fee, no consulting day rates.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {PRICING.map((p) => (
          <div key={p.name} className={`relative flex flex-col p-7 rounded-2xl border ${p.featured ? 'border-cyan-400/60 bg-cyan-500/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
            {p.featured && (
              <span className="absolute -top-3 left-7 px-3 py-1 text-[10px] font-bold tracking-wider text-[rgb(3,7,18)] bg-cyan-400 rounded-full">POPULAR</span>
            )}
            <h3 className="text-lg font-semibold mb-1">{p.name}</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-mono text-3xl font-bold">€{p.price}</span>
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
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">Custom runtime, SLA, AI Act module, DPO integration, private cloud, unlimited domains.</p>
          </div>
        </div>
        <SmartLink to="/contact-sales" className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg whitespace-nowrap flex-shrink-0">
          Contact us<ArrowRight className="w-4 h-4" />
        </SmartLink>
      </div>
    </Section>
  );
}

/* ── SECURITY ───────────────────────────────────────────── */
function Security() {
  const points = [
    { icon: Lock, title: 'EU sovereignty', text: 'Hosting, processing and models within the EU. Optional local models for maximum data control.' },
    { icon: FileLock2, title: 'Cryptographic evidence', text: 'Every record is signed and immutable — a gap-free audit trail for audits and supervisory authorities.' },
    { icon: ShieldCheck, title: 'Service-role isolation', text: 'Sensitive keys stay server-side only. Row-Level Security protects every table at tenant level.' },
  ];
  return (
    <Section id="security" eyebrow="SECURITY & COMPLIANCE" title="Trust is built into the architecture" subtitle="Not bolted on afterwards — sovereignty, verifiability and isolation by design.">
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

/* ── FINAL-CTA ──────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="relative z-10 py-16 md:py-24">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.02] to-transparent p-8 sm:p-12 md:p-16 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight mb-4 sm:mb-5">
            Ready for governance that<br className="hidden sm:block" /> runs at runtime?
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
            Start with a free scan — no account, in under five minutes. See your GDPR, AI Act
            and Claude Code-readiness score instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <SmartLink to="/audit?source=home-final" className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg">
              Start for Free<ArrowRight className="w-4 h-4" />
            </SmartLink>
            <SmartLink to="/app" className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg">
              <PlayCircle className="w-4 h-4" />View Product Tour
            </SmartLink>
          </div>
          <p className="mt-5 font-mono text-[10px] sm:text-xs tracking-wider text-white/40">
            Self-service · no account · no sales call required
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── FOOTER ─────────────────────────────────────────────── */
function Footer() {
  const cols = [
    { title: 'Product', links: [
      { label: 'Runtime Monitoring', to: '/runtime' },
      { label: 'Evidence Vault', to: '/evidence-vault' },
      { label: 'AI Act Classification', to: '/ai-act-klassifikator' },
      { label: 'Automation', to: '/automations' },
    ] },
    { title: 'Solutions', links: [
      { label: 'Agencies', to: '/agencies' },
      { label: 'Law Firms', to: '/legaltech' },
      { label: 'Industries', to: '/branchen' },
      { label: 'Case Studies', to: '/case-studies' },
    ] },
    { title: 'Resources', links: [
      { label: 'Documentation', to: '/docs' },
      { label: 'Roadmap', to: '/roadmap' },
      { label: 'Blog', to: '/blog' },
      { label: 'Security', to: '/security' },
    ] },
    { title: 'Company', links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact-sales' },
      { label: 'Imprint', to: '/impressum' },
      { label: 'Privacy', to: '/datenschutz' },
      { label: 'Terms', to: '/agb' },
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
              The AI Operating System for GDPR, EU AI Act and Code-Compliance.
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
          <p className="font-mono text-[10px] sm:text-xs text-white/50">© 2026 RealSync Dynamics. SaaS &amp; AI innovations.</p>
          <nav className="flex flex-wrap items-center justify-center sm:justify-end gap-x-3 sm:gap-x-5 gap-y-2">
            <Link to="/impressum" className="font-mono text-[10px] sm:text-xs text-white/50 hover:text-white transition-colors">Imprint</Link>
            <Link to="/datenschutz" className="font-mono text-[10px] sm:text-xs text-white/50 hover:text-white transition-colors">Privacy</Link>
            <Link to="/agb" className="font-mono text-[10px] sm:text-xs text-white/50 hover:text-white transition-colors">Terms</Link>
            <span className="font-mono text-[10px] sm:text-xs text-white/40">EU Hosting · GDPR · EU AI Act</span>
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
        <div className="font-mono text-[10px] text-white/50">Analyzed Code Lines: <span className="text-white/80">2.1 Mio</span></div>
        <div className="font-mono text-[10px] text-white/50">Security Vulnerabilities Fixed: <span className="text-white/80">11,350</span></div>
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
        Automated code analysis and code fixes for privacy- and regulation-compliant software development.
      </p>
    </CardShell>
  );
}
