import {
  Snowflake,
  ShieldCheck,
  ScanLine,
  Activity,
  ArrowRight,
  PlayCircle,
  Radar,
  FileLock2,
  GitBranch,
  Scale,
  Lock,
  ServerCog,
  Check,
  Building2,
} from 'lucide-react';

/**
 * MainLanding — Unternehmenshauptseite (Enterprise-Ausbau der Vercel-Hauptseite rx35).
 * Design: Obsidian-Hintergrund (rgb(3,7,18)), Earth-at-Night-Hero (Europa),
 * Petrol/Cyan-Akzent, Plus Jakarta Sans + JetBrains Mono (Metadaten).
 *
 * Sektionen: Header · Hero · Trust-Strip · Plattform · Governance-Runtime ·
 *            Proof-Band · Pricing · Security · Final-CTA · Footer
 */

const BG = 'rgb(3, 7, 18)';
const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

const NAV_LINKS = ['Produkt', 'Automatisierung', 'Evidence', 'AI Act', 'Sicherheit', 'Preise'];

const HERO_FEATURES = [
  { icon: ShieldCheck, label: 'DSGVO-KONFORM', text: 'Nachweise, Prozesse und Richtlinien automatisiert.' },
  { icon: ScanLine, label: 'AI-ACT-READY', text: 'Risikobewertung, Transparenz & Dokumentation.' },
  { icon: Activity, label: 'KONTINUIERLICH', text: 'Monitoring, Alerts & Evidence in Echtzeit.' },
];

const METRICS = [
  { label: 'DSGVO', value: 'Compliant', accent: true },
  { label: 'EU AI ACT', value: 'READY', accent: true },
  { label: 'RISK SCORE', value: '87', suffix: '/100' },
  { label: 'EVIDENCE', value: '1.248', suffix: 'Nachweise' },
  { label: 'MONITORING', value: 'LIVE', live: true },
];

const TRUST = ['DSGVO Art. 32', 'EU AI Act', 'TTDSG', 'BAIT', 'MaRisk', 'EU-Hosting'];

const PLATFORM = [
  {
    icon: Radar,
    title: 'Runtime-Monitoring',
    text: 'Kontinuierliche Telemetrie über Websites, Daten- und KI-Systeme — regulatorische Risiken werden erkannt, sobald sie entstehen.',
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
    icon: ServerCog,
    title: 'Governance-Runtime',
    text: 'Policies werden zur Laufzeit durchgesetzt — nicht nur dokumentiert. Jeder externe Call wird geloggt und bewertet.',
  },
  {
    icon: GitBranch,
    title: 'Automatisierung',
    text: 'DSGVO-Selfservice (Art. 15 + 17), Workflows und Alerts — orchestriert über n8n, nahtlos integriert.',
  },
  {
    icon: ShieldCheck,
    title: 'Multi-Tenancy',
    text: 'RLS-geschützte Mandantentrennung mit White-Label für DSB-Kanzleien und Agenturen.',
  },
];

const STEPS = [
  { no: '01', title: 'Verbinden', text: 'Domains, KI-Systeme und Datenflüsse in Minuten anbinden — ohne Code.' },
  { no: '02', title: 'Überwachen', text: 'Die Runtime erfasst kontinuierlich Telemetrie und bewertet Risiken in Echtzeit.' },
  { no: '03', title: 'Nachweisen', text: 'Jede Maßnahme landet als kryptografische Evidenz im auditfähigen Prüfpfad.' },
];

const PRICING = [
  { name: 'Starter', price: '79', cadence: '/Monat', features: ['1 Domain', 'Runtime-Monitoring', 'Evidence Vault', 'DSGVO-Selfservice'], cta: 'Starten' },
  { name: 'Growth', price: '249', cadence: '/Monat', features: ['5 Domains', 'AI-Act-Klassifizierung', 'Alerts & Workflows', 'Priorisierter Support'], cta: 'Wählen', featured: true },
  { name: 'Agency', price: '699', cadence: '/Monat', features: ['25 Domains', 'White-Label', 'Multi-Tenant-Dashboard', 'API-Zugriff'], cta: 'Wählen' },
  { name: 'Scale', price: '1.999', cadence: '/Monat', features: ['Bis zu 50 Mandanten', 'DSB-Kanzlei-Modus', 'Voller API-Zugriff', 'SLA'], cta: 'Wählen' },
];

export function MainLanding() {
  return (
    <div className="min-h-screen text-white antialiased" style={{ backgroundColor: BG, fontFamily: FONT_STACK }}>
      <Header />
      <Hero />
      <TrustStrip />
      <Platform />
      <Runtime />
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
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <Snowflake className="w-6 h-6 text-cyan-400" strokeWidth={1.5} />
          <span className="text-lg font-semibold tracking-tight">
            RealSync <span className="font-normal text-white/90">Dynamics.AI</span>
          </span>
        </a>
        <nav className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a key={l} href="#" className="text-sm text-white/70 hover:text-white transition-colors">{l}</a>
          ))}
          <a href="#" className="text-sm text-white/70 hover:text-white transition-colors">Login</a>
        </nav>
        <a href="#" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg">
          KI-OS entdecken<ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
}

/* ── HERO ───────────────────────────────────────────────── */
function Hero() {
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
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 mb-8 border border-cyan-500/40 bg-cyan-500/5 rounded-full">
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider text-[rgb(3,7,18)] bg-cyan-400 rounded">NEU</span>
              <span className="font-mono text-xs tracking-widest text-cyan-300 flex items-center gap-1.5">
                GOVERNANCE COMPLEXITY SCORE<ArrowRight className="w-3 h-3" />
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6">
              Das KI-<br />Betriebssystem für<br />DSGVO &amp; <span className="text-cyan-400">EU AI Act</span>
            </h1>

            <p className="font-mono text-sm tracking-[0.25em] text-cyan-400/90 mb-6">
              AI GOVERNANCE OS FOR TRUST &amp; VALUE
            </p>

            <p className="text-base md:text-lg text-white/70 max-w-xl leading-relaxed mb-10">
              <span className="font-semibold text-white/90">RealSync Dynamics</span> entwickelt SaaS &amp; KI-Innovationen für die Zukunft. Unser erstes Produkt überwacht Websites, KI-Systeme, Risiken und Nachweise kontinuierlich — DSGVO-konform, AI-Act-ready und auditierbar.
            </p>

            <div className="grid sm:grid-cols-3 gap-6 mb-10 max-w-2xl">
              {HERO_FEATURES.map(({ icon: Icon, label, text }) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-cyan-400" strokeWidth={1.75} />
                    <span className="font-mono text-xs font-medium tracking-wider text-white">{label}</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg">
                KI-Betriebssystem entdecken<ArrowRight className="w-4 h-4" />
              </a>
              <a href="#" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg">
                <PlayCircle className="w-4 h-4" />Produkt-Tour ansehen
              </a>
            </div>
          </div>

          <div className="relative hidden lg:block min-h-[520px]">
            <MetricCard className="absolute top-4 right-8" metric={METRICS[0]} />
            <MetricCard className="absolute top-32 right-44" metric={METRICS[1]} />
            <MetricCard className="absolute top-52 right-4" metric={METRICS[2]} />
            <MetricCard className="absolute bottom-24 right-32" metric={METRICS[3]} />
            <MetricCard className="absolute bottom-4 right-10" metric={METRICS[4]} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-12 lg:hidden">
          {METRICS.map((m) => (<MetricCard key={m.label} metric={m} />))}
        </div>
      </div>
    </section>
  );
}

/* ── TRUST-STRIP ────────────────────────────────────────── */
function TrustStrip() {
  return (
    <section className="relative z-10 border-y border-white/10 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        <span className="font-mono text-[11px] tracking-widest text-white/40 uppercase">Konform mit</span>
        {TRUST.map((t) => (
          <span key={t} className="font-mono text-xs tracking-wider text-white/60">{t}</span>
        ))}
      </div>
    </section>
  );
}

/* ── PLATTFORM ──────────────────────────────────────────── */
function Platform() {
  return (
    <Section id="produkt" eyebrow="DIE PLATTFORM" title="Eine Runtime für vollständige KI-Governance" subtitle="Vom kontinuierlichen Monitoring bis zum kryptografischen Nachweis — alles in einer auditfähigen Infrastruktur.">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
        {PLATFORM.map(({ icon: Icon, title, text }) => (
          <div key={title} className="group p-8 bg-[rgb(3,7,18)] hover:bg-white/[0.03] transition-colors">
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
    <Section eyebrow="SO FUNKTIONIERT ES" title="In drei Schritten zur kontinuierlichen Compliance" subtitle="Keine Projektphasen, keine statischen PDFs — Governance läuft ab dem ersten Tag zur Laufzeit.">
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

/* ── PROOF-BAND ─────────────────────────────────────────── */
function ProofBand() {
  const stats = [
    { value: '24/7', label: 'Kontinuierliches Monitoring' },
    { value: '100%', label: 'EU-Hosting & Datenresidenz' },
    { value: '< 5 Min', label: 'Bis zum ersten Nachweis' },
    { value: 'Art. 15+17', label: 'DSGVO-Selfservice automatisiert' },
  ];
  return (
    <section className="relative z-10 py-16 border-y border-white/10 bg-gradient-to-r from-cyan-500/[0.04] via-transparent to-cyan-500/[0.04]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map(({ value, label }) => (
          <div key={label} className="text-center">
            <div className="font-mono text-3xl md:text-4xl font-bold text-cyan-400 mb-2">{value}</div>
            <div className="text-sm text-white/60">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── PRICING ────────────────────────────────────────────── */
function Pricing() {
  return (
    <Section id="preise" eyebrow="PREISE" title="Transparente Pläne mit klarer Wertschöpfung" subtitle="Vom Einzel-Creator bis zur DSB-Kanzlei. Metered Billing, jederzeit kündbar.">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <a href="#" className={`inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg transition-colors ${p.featured ? 'text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300' : 'text-white border border-white/20 hover:border-white/40 hover:bg-white/5'}`}>
              {p.cta}<ArrowRight className="w-4 h-4" />
            </a>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-7 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-white/5 border border-white/10">
            <Building2 className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Enterprise</h3>
            <p className="text-sm text-white/60">Custom Runtime, SLA, AI-Act-Modul, DSB-Integration, unlimitierte Domains.</p>
          </div>
        </div>
        <a href="#" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg whitespace-nowrap">
          Sales kontaktieren<ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </Section>
  );
}

/* ── SECURITY ───────────────────────────────────────────── */
function Security() {
  const points = [
    { icon: Lock, title: 'EU-Souveränität', text: 'Hosting, Verarbeitung und Modelle innerhalb der EU. Optional lokale Modelle (Ollama) für maximale Datenkontrolle.' },
    { icon: FileLock2, title: 'Kryptografische Evidenz', text: 'Jeder Nachweis ist signiert und unveränderlich — ein lückenloser Prüfpfad für Audits und Aufsichtsbehörden.' },
    { icon: ShieldCheck, title: 'Service-Role-Isolation', text: 'Sensible Keys ausschließlich serverseitig in Edge Functions. RLS schützt jede Tabelle auf Mandantenebene.' },
  ];
  return (
    <Section id="sicherheit" eyebrow="SICHERHEIT & COMPLIANCE" title="Vertrauen ist in die Architektur eingebaut" subtitle="Nicht nachgelagert, sondern Fundament: Souveränität, Nachweisbarkeit und Isolation by Design.">
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
    <section className="relative z-10 py-24">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.02] to-transparent p-12 md:p-16 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5">
            Bereit für Governance,<br className="hidden sm:block" /> die zur Laufzeit funktioniert?
          </h2>
          <p className="text-base md:text-lg text-white/70 max-w-2xl mx-auto mb-10">
            Starten Sie mit einem kostenlosen Audit — ohne Account, in unter fünf Minuten. Sehen Sie Ihren Governance Complexity Score sofort.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#" className="inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg">
              Kostenloses Audit starten<ArrowRight className="w-4 h-4" />
            </a>
            <a href="#" className="inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg">
              Mit Sales sprechen
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── FOOTER ─────────────────────────────────────────────── */
function Footer() {
  const cols = [
    { title: 'Produkt', links: ['Runtime-Monitoring', 'Evidence Vault', 'AI-Act-Klassifizierung', 'Automatisierung'] },
    { title: 'Lösungen', links: ['Agenturen', 'DSB-Kanzleien', 'Healthcare', 'Public Sector'] },
    { title: 'Ressourcen', links: ['Dokumentation', 'Roadmap', 'Blog', 'Case Studies'] },
    { title: 'Unternehmen', links: ['Über uns', 'Kontakt', 'Impressum', 'AGB & Datenschutz'] },
  ];
  return (
    <footer className="relative z-10 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="col-span-2 lg:col-span-1">
            <a href="/" className="flex items-center gap-2.5 mb-4">
              <Snowflake className="w-5 h-5 text-cyan-400" strokeWidth={1.5} />
              <span className="font-semibold tracking-tight">RealSync Dynamics.AI</span>
            </a>
            <p className="text-xs text-white/50 leading-relaxed max-w-xs">
              Europäische Runtime-native AI-Governance- und Compliance-Plattform.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="font-mono text-[11px] tracking-widest text-white/40 uppercase mb-4">{c.title}</h4>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}><a href="#" className="text-sm text-white/60 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-xs text-white/50">© 2026 RealSync Dynamics. SaaS &amp; KI-Innovationen.</p>
          <p className="font-mono text-xs text-white/40">EU-Hosting · DSGVO · EU AI Act</p>
        </div>
      </div>
    </footer>
  );
}

/* ── HELPERS ────────────────────────────────────────────── */
function Section({ id, eyebrow, title, subtitle, children }: { id?: string; eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section id={id} className="relative z-10 py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-xs tracking-[0.25em] text-cyan-400/90 mb-4">{eyebrow}</p>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">{title}</h2>
          <p className="text-base text-white/60 leading-relaxed">{subtitle}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

type Metric = { label: string; value: string; suffix?: string; accent?: boolean; live?: boolean };

function MetricCard({ metric, className = '' }: { metric: Metric; className?: string }) {
  return (
    <div className={`px-5 py-4 border border-white/10 bg-white/5 backdrop-blur-md rounded-xl shadow-2xl ${className}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {metric.live && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
        <span className="font-mono text-[10px] tracking-widest text-white/50">{metric.label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono font-bold ${metric.accent || metric.live ? 'text-cyan-400 text-lg' : 'text-white text-2xl'}`}>{metric.value}</span>
        {metric.suffix && <span className="font-mono text-xs text-white/40">{metric.suffix}</span>}
      </div>
    </div>
  );
}
