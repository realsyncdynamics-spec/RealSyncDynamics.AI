import {
  Snowflake,
  ShieldCheck,
  ScanLine,
  Activity,
  ArrowRight,
  PlayCircle,
} from 'lucide-react';

/**
 * MainLanding — Unternehmenshauptseite (Nachbau der Vercel-Hauptseite rx35).
 * Design: Obsidian-Hintergrund (rgb(3,7,18)), Earth-at-Night-Hero (Europa),
 * Petrol/Cyan-Akzent, Plus Jakarta Sans + JetBrains Mono (Metadaten).
 */

const NAV_LINKS = [
  'Produkt',
  'Automatisierung',
  'Evidence',
  'AI Act',
  'Sicherheit',
  'Preise',
];

const FEATURES = [
  {
    icon: ShieldCheck,
    label: 'DSGVO-KONFORM',
    text: 'Nachweise, Prozesse und Richtlinien automatisiert.',
  },
  {
    icon: ScanLine,
    label: 'AI-ACT-READY',
    text: 'Risikobewertung, Transparenz & Dokumentation.',
  },
  {
    icon: Activity,
    label: 'KONTINUIERLICH',
    text: 'Monitoring, Alerts & Evidence in Echtzeit.',
  },
];

const METRICS = [
  { label: 'DSGVO', value: 'Compliant', accent: true },
  { label: 'EU AI ACT', value: 'READY', accent: true },
  { label: 'RISK SCORE', value: '87', suffix: '/100' },
  { label: 'EVIDENCE', value: '1.248', suffix: 'Nachweise' },
  { label: 'MONITORING', value: 'LIVE', live: true },
];

const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

export function MainLanding() {
  return (
    <div
      className="min-h-screen text-white antialiased"
      style={{ backgroundColor: 'rgb(3, 7, 18)', fontFamily: FONT_STACK }}
    >
      {/* ── HEADER ───────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-30">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <Snowflake className="w-6 h-6 text-cyan-400" strokeWidth={1.5} />
            <span className="text-lg font-semibold tracking-tight">
              RealSync <span className="font-normal text-white/90">Dynamics.AI</span>
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm text-white/70 hover:text-white transition-colors"
              >
                {link}
              </a>
            ))}
            <a href="#" className="text-sm text-white/70 hover:text-white transition-colors">
              Login
            </a>
          </nav>

          <a
            href="#"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg"
          >
            KI-OS entdecken
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Hintergrundbild: Earth-at-Night Europa */}
        <div className="absolute inset-0 z-0">
          <img
            src="/europe-globe.jpg"
            alt="Europa-zentrierter Globus bei Nacht — Satellitenperspektive"
            className="w-full h-full object-cover object-right"
          />
          {/* Lesbarkeits-Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-[rgb(3,7,18)] via-[rgb(3,7,18)]/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgb(3,7,18)] via-transparent to-[rgb(3,7,18)]/40" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 pt-28 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Linke Spalte: Text */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 mb-8 border border-cyan-500/40 bg-cyan-500/5 rounded-full">
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider text-[rgb(3,7,18)] bg-cyan-400 rounded">
                  NEU
                </span>
                <span className="font-mono text-xs tracking-widest text-cyan-300 flex items-center gap-1.5">
                  GOVERNANCE COMPLEXITY SCORE
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>

              {/* Haupttitel */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6">
                Das KI-
                <br />
                Betriebssystem für
                <br />
                DSGVO &amp; <span className="text-cyan-400">EU AI Act</span>
              </h1>

              {/* Subline */}
              <p className="font-mono text-sm tracking-[0.25em] text-cyan-400/90 mb-6">
                AI GOVERNANCE OS FOR TRUST &amp; VALUE
              </p>

              {/* Beschreibung */}
              <p className="text-base md:text-lg text-white/70 max-w-xl leading-relaxed mb-10">
                <span className="font-semibold text-white/90">RealSync Dynamics</span>{' '}
                entwickelt SaaS &amp; KI-Innovationen für die Zukunft. Unser erstes
                Produkt überwacht Websites, KI-Systeme, Risiken und Nachweise
                kontinuierlich — DSGVO-konform, AI-Act-ready und auditierbar.
              </p>

              {/* Feature-Badges */}
              <div className="grid sm:grid-cols-3 gap-6 mb-10 max-w-2xl">
                {FEATURES.map(({ icon: Icon, label, text }) => (
                  <div key={label}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-cyan-400" strokeWidth={1.75} />
                      <span className="font-mono text-xs font-medium tracking-wider text-white">
                        {label}
                      </span>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="#"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg"
                >
                  KI-Betriebssystem entdecken
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg"
                >
                  <PlayCircle className="w-4 h-4" />
                  Produkt-Tour ansehen
                </a>
              </div>
            </div>

            {/* Rechte Spalte: Floating Metric-Cards */}
            <div className="relative hidden lg:block min-h-[520px]">
              <MetricCard className="absolute top-4 right-8" metric={METRICS[0]} />
              <MetricCard className="absolute top-32 right-44" metric={METRICS[1]} />
              <MetricCard className="absolute top-52 right-4" metric={METRICS[2]} />
              <MetricCard className="absolute bottom-24 right-32" metric={METRICS[3]} />
              <MetricCard className="absolute bottom-4 right-10" metric={METRICS[4]} />
            </div>
          </div>

          {/* Mobile: Metriken als Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-12 lg:hidden">
            {METRICS.map((m) => (
              <MetricCard key={m.label} metric={m} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono text-xs text-white/50">
            © 2026 RealSync Dynamics. SaaS &amp; KI-Innovationen.
          </p>
          <nav className="flex items-center gap-6">
            {['Roadmap', 'Kontakt', 'Impressum', 'AGB & Datenschutz'].map((l) => (
              <a
                key={l}
                href="#"
                className="text-xs text-white/60 hover:text-white transition-colors"
              >
                {l}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

type Metric = {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
  live?: boolean;
};

function MetricCard({ metric, className = '' }: { metric: Metric; className?: string }) {
  return (
    <div
      className={`px-5 py-4 border border-white/10 bg-white/5 backdrop-blur-md rounded-xl shadow-2xl ${className}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {metric.live && (
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        )}
        <span className="font-mono text-[10px] tracking-widest text-white/50">
          {metric.label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`font-mono font-bold ${
            metric.accent || metric.live ? 'text-cyan-400 text-lg' : 'text-white text-2xl'
          }`}
        >
          {metric.value}
        </span>
        {metric.suffix && (
          <span className="font-mono text-xs text-white/40">{metric.suffix}</span>
        )}
      </div>
    </div>
  );
}
