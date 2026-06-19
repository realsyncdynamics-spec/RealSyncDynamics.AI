/**
 * GovernanceOsHome — „Governance OS 2050" Enterprise-Homepage.
 *
 * Dunkles Premium-Design auf dem Niveau führender SaaS-Seiten 2025/26
 * (Linear · Vercel · Stripe · Palantir · Vision-Pro-Ästhetik): feines
 * Film-Grain, Gradient-Mesh, Glasflächen mit Cursor-Spotlight, Bento-Grid,
 * Stats-Band und eine interaktive 3D-Europa-Weltkugel mit schwebender
 * Produkt-Glaskarte. Positionierung: AI-Betriebssystem für europäische
 * Governance (DSGVO · EU AI Act · Continuous Compliance).
 *
 * Eigene dunkle Navigation mit der Brand-Marke (Logo). Self-Service-Sprache:
 * keine Beratungs-/Call-/„Wir-melden-uns"-Logik. CTA-Vokabular aus runtimeVocab.
 *
 * Performance/A11y: die 3D-Kugel (Three.js/R3F) wird code-split lazy geladen,
 * respektiert `prefers-reduced-motion` (statischer CSS-Globe als Fallback)
 * und ist von einer ErrorBoundary umschlossen (Fallback bei fehlendem WebGL).
 *
 * Route: /governance-os  (siehe App.tsx)
 */
import {
  Component, Suspense, lazy, useEffect, useRef, useState,
  type ReactNode, type MouseEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight, Menu, X,
  Globe, Cpu, AlertTriangle, Archive, Activity, Network, FileText, BarChart3, Workflow,
  ShieldCheck, Scale, Lock, KeyRound, FileCheck2, ClipboardCheck,
  ScanSearch, Camera, CalendarClock, Target, FileSearch,
  Hash, ServerCog, Sparkles, Building2, Zap, Clock, Layers, Gauge, Check, Play,
} from 'lucide-react';
import { CTA, PLANS } from '../content/runtimeVocab';
import { Logo } from '../components/Logo';
import { GovernanceEarthHero } from '../components/hero/GovernanceEarthHero';

// ── Reveal-Wrapper (scroll-in, respektiert reduced-motion) ───────────

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── Eyebrow-Pill (kleines Label über jeder Section) ──────────────────

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-chip border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-petrol-200 backdrop-blur-md">
      <span className="h-1 w-1 rounded-full bg-petrol-300" />
      {children}
    </span>
  );
}

// ── Section-Heading ──────────────────────────────────────────────────

function SectionHeading({ eyebrow, title, intro, center }: { eyebrow: string; title: string; intro?: string; center?: boolean }) {
  return (
    <Reveal className={`mb-14 ${center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-5 text-balance font-display font-bold text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.08] tracking-tight text-titanium-50">
        {title}
      </h2>
      {intro && <p className="mt-5 text-pretty text-base leading-relaxed text-titanium-400">{intro}</p>}
    </Reveal>
  );
}

// ── Spotlight-Karte (Cursor-folgender Glanz, premium hover) ──────────

function SpotlightCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`);
    ref.current.style.setProperty('--my', `${e.clientY - r.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={`group relative overflow-hidden rounded-panel border border-white/[0.08] bg-white/[0.02] transition-colors duration-300 hover:border-petrol-500/40 ${className}`}
    >
      {/* Cursor-Spotlight */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(420px circle at var(--mx,50%) var(--my,0%), rgba(45,212,191,0.10), transparent 60%)',
        }}
      />
      {children}
    </div>
  );
}

// ── Premium-Hintergrund: Grain + Gradient-Mesh ───────────────────────

const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function PageBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* sanftes Mesh */}
      <div className="absolute -top-40 left-1/2 h-[680px] w-[1100px] -translate-x-1/2 rounded-full bg-petrol-500/[0.10] blur-[160px]" />
      <div className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-security-500/[0.08] blur-[150px]" />
      <div className="absolute bottom-0 -left-32 h-[420px] w-[420px] rounded-full bg-emerald-500/[0.06] blur-[150px]" />
      {/* Film-Grain */}
      <div className="absolute inset-0 opacity-[0.025] mix-blend-soft-light" style={{ backgroundImage: GRAIN_URI }} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Navigation
// ════════════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { label: 'Produkt', to: '/runtime' },
  { label: 'Automatisierung', to: '/automations' },
  { label: 'Evidence', to: '/evidence' },
  { label: 'AI Act', to: '/ai-act' },
  { label: 'Sicherheit', to: '/sicherheit' },
  { label: 'Preise', to: '/pricing' },
  { label: 'Login', to: '/welcome' },
] as const;

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-obsidian-950/70 backdrop-blur-xl border-b border-white/10' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="select-none">
            <Logo size={30} />
          </Link>

          <div className="hidden lg:flex items-center gap-7">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm font-medium text-titanium-400 hover:text-titanium-50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/audit?source=governance-os-nav"
              className="group inline-flex items-center gap-1.5 rounded-chip bg-petrol-500 px-4 py-2 text-sm font-semibold text-obsidian-950 hover:bg-petrol-400 transition-colors"
            >
              {CTA.startFree}
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <button onClick={() => setOpen(!open)} className="lg:hidden text-titanium-300" aria-label="Menü">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-white/10 bg-obsidian-950/95 backdrop-blur-xl">
          <div className="space-y-1 px-4 py-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="block rounded-card px-3 py-3 text-base font-medium text-titanium-300 hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/audit?source=governance-os-nav-mobile"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-between rounded-chip bg-petrol-500 px-3 py-3 text-base font-semibold text-obsidian-950"
            >
              {CTA.startFree} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ════════════════════════════════════════════════════════════════════
//  1 · Hero
// ════════════════════════════════════════════════════════════════════

const HERO_FEATURES = [
  { Icon: ShieldCheck, title: 'DSGVO-konform', body: 'Nachweise, Prozesse und Richtlinien automatisiert.' },
  { Icon: Scale, title: 'AI-Act-ready', body: 'Risikobewertung, Transparenz & Dokumentation.' },
  { Icon: Activity, title: 'Kontinuierlich', body: 'Monitoring, Alerts & Evidence in Echtzeit.' },
];

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* dezentes Grid hinter dem Text */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 30% 40%, #000 40%, transparent 100%)',
          }}
        />
      </div>

      {/* Rechte visuelle Fläche: dynamische 3D-Erde (Desktop, bleed nach rechts) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[60%] xl:w-[58%] lg:block">
        <GovernanceEarthHero className="absolute inset-0" />
        {/* weicher Verlauf zur Textseite, damit die Headline lesbar bleibt */}
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-obsidian-950 to-transparent" />
      </div>

      <div className="mx-auto grid min-h-[760px] max-w-7xl grid-cols-1 items-center px-4 sm:px-6 pt-28 pb-16 sm:pt-32 lg:grid-cols-2 lg:pb-24">
        <div className="relative z-10">
          <Reveal>
            <Link
              to="/governance-score"
              className="group inline-flex items-center gap-2 rounded-chip border border-petrol-500/30 bg-petrol-500/10 py-1 pl-1 pr-3 font-mono text-[10px] uppercase tracking-[0.18em] text-petrol-200 transition-colors hover:border-petrol-400/50"
            >
              <span className="rounded-chip bg-petrol-500 px-2 py-0.5 text-[9px] font-semibold text-obsidian-950">Neu</span>
              Governance Complexity Score
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mt-6 text-balance font-display font-bold tracking-tight text-titanium-50 text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02]">
              Das KI-Betriebssystem für{' '}
              <span className="bg-gradient-to-r from-petrol-300 via-ai-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                DSGVO &amp; EU AI Act
              </span>
            </h1>
            <p className="mt-5 font-mono text-[12px] uppercase tracking-[0.32em] text-titanium-500">
              by RealSync Dynamics AI
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl text-pretty text-lg text-titanium-300 leading-relaxed">
              RealSync Dynamics AI überwacht Websites, KI-Systeme, Risiken und Nachweise
              kontinuierlich — DSGVO-konform, AI-Act-ready und auditierbar.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-8 grid max-w-xl grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
              {HERO_FEATURES.map(({ Icon, title, body }) => (
                <div key={title}>
                  <span className="grid h-9 w-9 place-items-center rounded-card border border-white/10 bg-white/[0.03]">
                    <Icon className="h-4 w-4 text-petrol-300" />
                  </span>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-petrol-200">{title}</p>
                  <p className="mt-1.5 text-[13px] leading-snug text-titanium-400">{body}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/audit?source=governance-os-hero"
                className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-500 px-6 py-3.5 text-sm font-semibold text-obsidian-950 hover:bg-petrol-400 transition-colors shadow-[0_0_40px_-8px_rgba(20,184,166,0.6)]"
              >
                {CTA.startFree}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/runtime?source=governance-os-hero"
                className="group inline-flex items-center justify-center gap-2.5 rounded-chip border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-titanium-100 hover:border-white/30 hover:bg-white/[0.06] transition-colors backdrop-blur-md"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-white/[0.04]">
                  <Play className="h-3 w-3 fill-current text-petrol-300" />
                </span>
                Produkt-Tour ansehen
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Mobile/Tablet: Erde unterhalb des Textes (Desktop nutzt die Bleed-Fläche) */}
        <div className="relative mt-12 h-[360px] sm:h-[440px] lg:hidden">
          <GovernanceEarthHero className="absolute inset-0" />
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Stats-Band
// ════════════════════════════════════════════════════════════════════

const STATS = [
  { Icon: Layers, value: '9', label: 'Module · ein Prüfpfad' },
  { Icon: Clock, value: '24/7', label: 'Continuous Monitoring' },
  { Icon: Globe, value: '100%', label: 'EU-Hosting · Frankfurt' },
  { Icon: Zap, value: '< 60s', label: 'Erst-Audit pro Domain' },
];

function StatsBand() {
  return (
    <section className="relative px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-white/[0.08] bg-white/[0.04] lg:grid-cols-4">
          {STATS.map(({ Icon, value, label }, i) => (
            <Reveal key={label} delay={i * 0.05}>
              <div className="flex h-full flex-col gap-2 bg-obsidian-950 p-6">
                <Icon className="h-4 w-4 text-petrol-300" />
                <span className="font-display text-3xl font-bold tracking-tight text-titanium-50 tabular-nums">{value}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">{label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════
//  2 · Was RealSync überwacht
// ════════════════════════════════════════════════════════════════════

const MONITORS = [
  { Icon: Globe, title: 'Websites überwachen', body: 'Header, Cookies, Tracker, Formulare und Third-Parties bei jedem Scan inventarisieren.' },
  { Icon: Cpu, title: 'KI-Systeme klassifizieren', body: 'AI-Endpoints erkennen und nach EU-AI-Act-Risikoklasse einordnen.' },
  { Icon: AlertTriangle, title: 'Risiken erkennen', body: 'Verstöße, Drift und Schwachstellen kontinuierlich aufdecken — bevor sie eskalieren.' },
  { Icon: FileCheck2, title: 'Evidence erzeugen', body: 'Jeder Befund wird mit Zeitstempel zu prüfbarer, versionierter Evidence.' },
  { Icon: FileText, title: 'Dokumente vorbereiten', body: 'Register, DPIA-Templates und §13-Drafts aus realen Befunden ableiten.' },
  { Icon: Activity, title: 'Monitoring aktivieren', body: '24/7-Runtime statt Einmal-Audit — Änderungen werden erkannt, sobald sie entstehen.' },
];

function MonitorSection() {
  return (
    <section className="relative px-4 sm:px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Was RealSync überwacht"
          title="Ein System für Ihre digitale Compliance"
          intro="Vom ersten Scan bis zum auditfähigen Nachweis — alles auf einem durchgehenden Prüfpfad."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MONITORS.map(({ Icon, title, body }, i) => (
            <Reveal key={title} delay={(i % 3) * 0.05}>
              <SpotlightCard className="h-full p-6">
                <span className="grid h-11 w-11 place-items-center rounded-card bg-petrol-500/10 ring-1 ring-petrol-400/30">
                  <Icon className="h-5 w-5 text-petrol-300" />
                </span>
                <h3 className="mt-5 font-display font-semibold text-titanium-50">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-titanium-400">{body}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════
//  3 · Governance OS Module (Bento-Grid)
// ════════════════════════════════════════════════════════════════════

const MODULES = [
  { Icon: Cpu, label: 'KI-Systeme', to: '/app/ai-systems' },
  { Icon: AlertTriangle, label: 'Risiken', to: '/app/risks' },
  { Icon: Activity, label: 'Monitoring', to: '/app/monitoring' },
  { Icon: Network, label: 'Vendors', to: '/app/vendors' },
  { Icon: Globe, label: 'Websites', to: '/app/websites' },
  { Icon: FileText, label: 'Dokumente', to: '/app/documents' },
  { Icon: BarChart3, label: 'Reports', to: '/app/reports' },
  { Icon: Workflow, label: 'Automation Skills', to: '/automations' },
];

function ModuleSection() {
  return (
    <section id="module" className="relative px-4 sm:px-6 py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-petrol-500/30 to-transparent" />
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Governance OS Module"
          title="Ein Betriebssystem — neun Module, ein Prüfpfad"
          intro="Jedes Modul greift auf dieselbe Evidence-Chain zu. Ein Befund aus Websites wird zur Evidence, die Evidence speist Risiken, Monitoring und Reports."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Feature-Tile: Evidence Vault (groß, 2×2) */}
          <Reveal className="col-span-2 row-span-2">
            <Link
              to="/app/evidence"
              className="group relative flex h-full flex-col justify-between overflow-hidden rounded-panel border border-petrol-500/30 bg-gradient-to-br from-petrol-500/[0.10] to-transparent p-6 transition-all hover:border-petrol-500/60 sm:p-8"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-petrol-500/15 blur-3xl" />
              <div>
                <span className="grid h-12 w-12 place-items-center rounded-card border border-white/10 bg-obsidian-900">
                  <Archive className="h-5 w-5 text-petrol-300" />
                </span>
                <h3 className="mt-6 font-display text-xl font-bold text-titanium-50">Evidence Vault</h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-titanium-400">
                  Der versiegelte Kern: jeder Befund wird gehasht, versioniert und auditfähig
                  abgelegt — die Quelle, aus der Risiken, Reports und Audit-Exporte gespeist werden.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-2">
                {['Hash-Anchoring', 'Versioniert', 'Export-ready'].map((t) => (
                  <span key={t} className="rounded-chip border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-titanium-300">
                    {t}
                  </span>
                ))}
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-petrol-300">
                  Öffnen <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </Reveal>

          {MODULES.map(({ Icon, label, to }, i) => (
            <Reveal key={label} delay={(i % 4) * 0.04}>
              <Link
                to={to}
                className="group relative flex h-full flex-col justify-between overflow-hidden rounded-panel border border-white/[0.08] bg-white/[0.02] p-5 transition-all hover:-translate-y-1 hover:border-petrol-500/50"
              >
                <span className="grid h-10 w-10 place-items-center rounded-card border border-white/10 bg-obsidian-900">
                  <Icon className="h-4 w-4 text-petrol-300" />
                </span>
                <div className="mt-5 flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-titanium-50">{label}</h3>
                  <ArrowRight className="h-3.5 w-3.5 text-titanium-600 transition-all group-hover:translate-x-0.5 group-hover:text-petrol-300" />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════
//  4 · Automation Skills
// ════════════════════════════════════════════════════════════════════

const SKILLS = [
  { Icon: ScanSearch, title: 'DSGVO Audit Skill', problem: 'Manuelle DSGVO-Prüfung kostet Tage.', auto: 'Scannt Website, klassifiziert Befunde nach DSGVO-Artikel.', result: 'Score + priorisierte Findings in Sekunden.' },
  { Icon: Scale, title: 'AI Act Skill', problem: 'KI-Systeme sind nicht klassifiziert.', auto: 'Erkennt AI-Endpoints und ordnet Risikoklassen zu.', result: 'AI-Usecase-Registry, audit-ready.' },
  { Icon: FileSearch, title: 'Dokumenten Skill', problem: 'Register & Nachweise fehlen.', auto: 'Generiert Register, DPIA-Templates und §13-Drafts.', result: 'Exportfähige Dokumente aus echten Befunden.' },
  { Icon: Camera, title: 'Screenshot Feedback Skill', problem: 'Support-Tickets ohne Kontext.', auto: 'Analysiert Screenshots und schlägt Maßnahmen vor.', result: 'Strukturierte Befunde statt Vermutungen.' },
  { Icon: CalendarClock, title: 'Meeting Governance Skill', problem: 'Entscheidungen versanden.', auto: 'Extrahiert Maßnahmen aus Notizen & Transkripten.', result: 'Nachverfolgbare Tasks im Prüfpfad.' },
  { Icon: Target, title: 'Lead Risk Skill', problem: 'Leads ohne Risikobild.', auto: 'Scannt Lead-Websites auf Compliance-Signale.', result: 'Risiko-Score je Lead, sofort.' },
];

function SkillsSection() {
  return (
    <section className="relative px-4 sm:px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Wählen · Aktivieren · Nutzen"
          title="Sofort nutzbare Automation Skills"
          intro="Spezialisierte Agents übernehmen wiederkehrende Governance-Aufgaben — ohne Setup."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKILLS.map(({ Icon, title, problem, auto, result }, i) => (
            <Reveal key={title} delay={(i % 3) * 0.05}>
              <SpotlightCard className="flex h-full flex-col p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-card bg-emerald-500/10 ring-1 ring-emerald-400/30">
                    <Icon className="h-5 w-5 text-emerald-300" />
                  </span>
                  <h3 className="font-display font-semibold text-titanium-50">{title}</h3>
                </div>
                <dl className="mt-5 space-y-3 text-sm">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">Problem</dt>
                    <dd className="mt-0.5 text-titanium-300">{problem}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">Automatisierung</dt>
                    <dd className="mt-0.5 text-titanium-300">{auto}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">Ergebnis</dt>
                    <dd className="mt-0.5 text-petrol-200">{result}</dd>
                  </div>
                </dl>
                <Link
                  to="/automations?source=governance-os-skills"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-chip border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-titanium-100 hover:border-emerald-400/50 hover:text-white transition-colors"
                >
                  Skill aktivieren <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════
//  5 · Evidence Chain
// ════════════════════════════════════════════════════════════════════

const CHAIN = [
  { Icon: Activity, label: 'Event' },
  { Icon: Hash, label: 'Hash' },
  { Icon: FileCheck2, label: 'Evidence' },
  { Icon: BarChart3, label: 'Report' },
  { Icon: ClipboardCheck, label: 'Audit' },
];

function EvidenceSection() {
  return (
    <section className="relative px-4 sm:px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          center
          eyebrow="Evidence Chain"
          title="Evidence statt Behauptungen"
          intro="Jeder Befund wird nachvollziehbar dokumentiert, mit Zeitstempel versehen und für Reports exportierbar gemacht."
        />
        <Reveal>
          <div className="rounded-panel border border-white/10 bg-white/[0.02] p-6 sm:p-10">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {CHAIN.map(({ Icon, label }, i) => (
                <div key={label} className="flex flex-1 items-center gap-3">
                  <div className="flex flex-1 flex-col items-center gap-2 rounded-card border border-white/10 bg-obsidian-900 px-4 py-6">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-petrol-500/10 ring-1 ring-petrol-400/30">
                      <Icon className="h-5 w-5 text-petrol-300" />
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-titanium-200">{label}</span>
                  </div>
                  {i < CHAIN.length - 1 && (
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-petrol-500/60 sm:block" />
                  )}
                </div>
              ))}
            </div>
            <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-wider text-titanium-500">
              Versiegelt · Versioniert · Exportierbar für Aufsicht & Audit
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════
//  6 · Enterprise Security
// ════════════════════════════════════════════════════════════════════

const TRUST = [
  { Icon: Globe, label: 'EU-Hosting' },
  { Icon: Building2, label: 'Tenant Isolation' },
  { Icon: Lock, label: 'Security Headers' },
  { Icon: ClipboardCheck, label: 'Audit Logs' },
  { Icon: KeyRound, label: 'Role-Based Access' },
  { Icon: FileCheck2, label: 'Evidence Export' },
  { Icon: ShieldCheck, label: 'DSGVO & AI Act Fokus' },
  { Icon: Gauge, label: 'Drift Detection' },
];

function SecuritySection() {
  return (
    <section className="relative px-4 sm:px-6 py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-petrol-500/30 to-transparent" />
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Enterprise Security"
          title="Enterprise Trust für Europa"
          intro="Souverän gehostet, mandantengetrennt und durchgehend protokolliert — Governance, der Aufsicht und Audit standhält."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TRUST.map(({ Icon, label }, i) => (
            <Reveal key={label} delay={(i % 4) * 0.04}>
              <div className="flex h-full items-center gap-3 rounded-panel border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-petrol-500/40">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-petrol-500/10 ring-1 ring-petrol-400/30">
                  <Icon className="h-4 w-4 text-petrol-300" />
                </span>
                <span className="text-sm font-medium text-titanium-100">{label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════
//  7 · Pricing (kanonische 4 Tarife aus runtimeVocab)
// ════════════════════════════════════════════════════════════════════

const PLAN_CTA: Record<string, { label: string; to: string }> = {
  free: { label: CTA.startFree, to: '/audit?source=governance-os-pricing&plan=free' },
  monitoring: { label: CTA.activateMonitoring, to: '/audit?source=governance-os-pricing&plan=monitoring' },
  governance: { label: CTA.startPlan, to: '/audit?source=governance-os-pricing&plan=governance' },
  scale: { label: CTA.enterprise, to: '/contact-sales?intent=scale' },
};

function PricingSection() {
  return (
    <section className="relative px-4 sm:px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          center
          eyebrow="Preise"
          title="Self-Service vom ersten Scan an"
          intro="Ohne Setup, ohne Kreditkarte starten — jederzeit self-serve upgraden."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => {
            const featured = plan.id === 'governance';
            const cta = PLAN_CTA[plan.id] ?? PLAN_CTA.free;
            return (
              <Reveal key={plan.id} delay={i * 0.05}>
                <div
                  className={`relative flex h-full flex-col rounded-panel border p-6 ${
                    featured
                      ? 'border-petrol-500/50 bg-petrol-500/[0.06] shadow-[0_0_60px_-20px_rgba(20,184,166,0.5)]'
                      : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-chip bg-petrol-500 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-obsidian-950">
                      <Sparkles className="h-3 w-3" /> Empfohlen
                    </span>
                  )}
                  <h3 className="font-display font-semibold text-titanium-50">{plan.name}</h3>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-titanium-500">{plan.tagline}</p>
                  <p className="mt-4 font-display text-3xl font-bold text-titanium-50">{plan.headline}</p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-titanium-300">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-petrol-300" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={cta.to}
                    className={`mt-6 inline-flex items-center justify-center gap-2 rounded-chip px-4 py-2.5 text-sm font-semibold transition-colors ${
                      featured
                        ? 'bg-petrol-500 text-obsidian-950 hover:bg-petrol-400'
                        : 'border border-white/15 bg-white/[0.03] text-titanium-100 hover:border-white/30'
                    }`}
                  >
                    {cta.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════
//  8 · Final CTA + Footer
// ════════════════════════════════════════════════════════════════════

function FinalCta() {
  return (
    <section className="relative px-4 sm:px-6 py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-petrol-500/10 blur-[140px]" />
      </div>
      <Reveal className="mx-auto max-w-3xl text-center">
        <div className="relative overflow-hidden rounded-panel border border-white/10 bg-white/[0.02] p-10 sm:p-14 backdrop-blur-md">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, #000 20%, transparent 80%)',
            }}
          />
          <ServerCog className="mx-auto h-8 w-8 text-petrol-300" />
          <h2 className="mt-6 text-balance font-display font-bold text-3xl sm:text-4xl tracking-tight text-titanium-50">
            Starten Sie Ihr Governance OS
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-titanium-400">
            Sofort einsatzbereit. Websites, KI-Systeme und Risiken überwachen —
            keine Kreditkarte, kein Setup.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/audit?source=governance-os-final"
              className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-500 px-6 py-3.5 text-sm font-semibold text-obsidian-950 hover:bg-petrol-400 transition-colors shadow-[0_0_40px_-8px_rgba(20,184,166,0.6)]"
            >
              {CTA.startFreeAudit}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/app"
              className="inline-flex items-center justify-center gap-2 rounded-chip border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-titanium-100 hover:border-white/30 transition-colors"
            >
              {CTA.openDashboard}
            </Link>
          </div>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-titanium-600">
            Keine Kreditkarte · EU-Hosting · DSGVO & EU AI Act
          </p>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 px-4 sm:px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-3">
          <Logo size={28} />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-titanium-600">
            Governance OS · EU-Frankfurt · Continuous Compliance
          </span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-titanium-500">
          <Link to="/impressum" className="hover:text-titanium-200">Impressum</Link>
          <Link to="/datenschutz" className="hover:text-titanium-200">Datenschutz</Link>
          <Link to="/agb" className="hover:text-titanium-200">AGB</Link>
          <span className="text-titanium-700">© {year}</span>
        </nav>
      </div>
    </footer>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Page
// ════════════════════════════════════════════════════════════════════

export function GovernanceOsHome() {
  return (
    <div className="relative min-h-screen bg-obsidian-950 text-titanium-100 antialiased selection:bg-petrol-500/30">
      <PageBackdrop />
      <Nav />
      <main>
        <Hero />
        <StatsBand />
        <MonitorSection />
        <ModuleSection />
        <SkillsSection />
        <EvidenceSection />
        <SecuritySection />
        <PricingSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

export default GovernanceOsHome;
