/**
 * GovernanceOsHome — „Governance OS 2050" Enterprise-Homepage.
 *
 * Dunkles Premium-Design mit interaktiver 3D-Europa-Weltkugel, Glasflächen,
 * Datenströmen und Petrol/Smaragd-Akzenten. Positionierung: AI-Betriebssystem
 * für europäische Governance (DSGVO · EU AI Act · Continuous Compliance).
 *
 * Eigene dunkle Navigation (kein weißer LandingNavbar — bewusster Kontrast
 * zum Light-Theme der Marketing-Landings). Self-Service-Sprache: keine
 * Beratungs-/Call-/„Wir-melden-uns"-Logik. CTA-Vokabular aus runtimeVocab.
 *
 * Performance: die 3D-Kugel (Three.js/R3F) wird code-split lazy geladen,
 * respektiert `prefers-reduced-motion` (statischer CSS-Globe als Fallback)
 * und ist von einer ErrorBoundary umschlossen (Fallback bei fehlendem WebGL).
 *
 * Route: /governance-os  (siehe App.tsx)
 */
import {
  Component, Suspense, lazy, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight, Menu, X,
  Globe, Cpu, AlertTriangle, Archive, Activity, Network, FileText, BarChart3, Workflow,
  ShieldCheck, Scale, Lock, KeyRound, FileCheck2, ClipboardCheck,
  ScanSearch, Camera, CalendarClock, Target, FileSearch,
  Hash, ServerCog, Sparkles, Building2,
} from 'lucide-react';
import { CTA, PLANS } from '../content/runtimeVocab';

const GovernanceGlobe = lazy(() => import('../components/globe/GovernanceGlobe'));

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
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── Section-Heading ──────────────────────────────────────────────────

function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <Reveal className="max-w-2xl mb-12">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-petrol-300 mb-4">{eyebrow}</p>
      <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-titanium-50 leading-[1.1]">
        {title}
      </h2>
      {intro && <p className="mt-5 text-base text-titanium-400 leading-relaxed">{intro}</p>}
    </Reveal>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Globe-Mount (lazy + reduced-motion + ErrorBoundary)
// ════════════════════════════════════════════════════════════════════

class GlobeErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Statischer CSS/SVG-Globe — Fallback bei reduced-motion oder ohne WebGL. */
function GlobeFallback() {
  return (
    <div className="relative aspect-square w-full max-w-[560px] mx-auto">
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#0d3b38_0%,#070709_70%)] shadow-[0_0_120px_-20px_rgba(20,184,166,0.55)]" />
      <div className="absolute inset-[12%] rounded-full border border-petrol-500/30" />
      <div className="absolute inset-[4%] rounded-full border border-petrol-500/10" />
      <svg viewBox="0 0 100 100" className="absolute inset-[12%] h-auto w-auto opacity-70">
        <defs>
          <radialGradient id="g" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#g)" />
        {[...Array(7)].map((_, i) => (
          <ellipse key={i} cx="50" cy="50" rx={48 - i * 0} ry={6 + i * 7} fill="none" stroke="#2a3a4a" strokeWidth="0.3" />
        ))}
        {[[46, 38], [52, 34], [44, 44], [55, 42], [48, 30], [58, 48]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.1" fill="#5fe5d1" />
        ))}
      </svg>
    </div>
  );
}

function GlobeStage() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Nur auf hinreichend breiten Viewports & bei erlaubter Motion 3D mounten.
    if (!reduce && typeof window !== 'undefined' && window.innerWidth >= 768) {
      setShow(true);
    }
  }, [reduce]);

  return (
    <div className="relative aspect-square w-full max-w-[620px] mx-auto">
      {/* Glow-Backdrop */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-petrol-500/10 blur-[100px]" />
      {show ? (
        <GlobeErrorBoundary fallback={<GlobeFallback />}>
          <Suspense fallback={<GlobeFallback />}>
            <div className="absolute inset-0">
              <GovernanceGlobe />
            </div>
          </Suspense>
        </GlobeErrorBoundary>
      ) : (
        <GlobeFallback />
      )}
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
        scrolled ? 'bg-obsidian-950/80 backdrop-blur-xl border-b border-white/10' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 select-none">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-petrol-500/15 ring-1 ring-petrol-400/40">
              <Globe className="h-4 w-4 text-petrol-300" />
            </span>
            <span className="font-display font-bold tracking-tight text-titanium-50">
              RealSync<span className="text-petrol-300">Dynamics</span>
            </span>
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

const HERO_LABELS = [
  { label: 'DSGVO', top: '6%', left: '8%' },
  { label: 'EU AI Act', top: '20%', left: '72%' },
  { label: 'Evidence', top: '48%', left: '2%' },
  { label: 'Monitoring', top: '70%', left: '14%' },
  { label: 'Risk Score', top: '12%', left: '44%' },
  { label: 'Audit Ready', top: '82%', left: '64%' },
  { label: 'AI Governance', top: '54%', left: '82%' },
] as const;

function FloatingLabels() {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block">
      {HERO_LABELS.map((l, i) => (
        <motion.span
          key={l.label}
          className="absolute inline-flex items-center gap-1.5 rounded-chip border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-titanium-200 backdrop-blur-md"
          style={{ top: l.top, left: l.left }}
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={reduce ? undefined : { duration: 4 + i * 0.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-petrol-300" />
          {l.label}
        </motion.span>
      ))}
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-4 sm:px-6 pt-28 pb-20 sm:pt-36 sm:pb-28">
      {/* Hintergrund-Gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-petrol-500/10 blur-[140px]" />
        <div className="absolute right-0 top-40 h-[400px] w-[400px] rounded-full bg-security-500/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, #000 40%, transparent 100%)',
          }}
        />
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-8">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-chip border border-petrol-500/30 bg-petrol-500/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-petrol-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Governance OS · Continuous Compliance
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="mt-6 font-display font-bold tracking-tight text-titanium-50 text-4xl sm:text-6xl leading-[1.05]">
              Das AI-Betriebssystem für{' '}
              <span className="bg-gradient-to-r from-petrol-300 via-ai-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                europäische Governance
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl text-lg text-titanium-300 leading-relaxed">
              RealSync Dynamics AI überwacht Websites, KI-Systeme, Risiken und Nachweise
              kontinuierlich — DSGVO-konform, AI-Act-ready und auditierbar.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/audit?source=governance-os-hero"
                className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-500 px-6 py-3.5 text-sm font-semibold text-obsidian-950 hover:bg-petrol-400 transition-colors shadow-[0_0_40px_-8px_rgba(20,184,166,0.6)]"
              >
                {CTA.startFreeAudit}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#module"
                className="inline-flex items-center justify-center gap-2 rounded-chip border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-titanium-100 hover:border-white/30 hover:bg-white/[0.06] transition-colors backdrop-blur-md"
              >
                Governance OS ansehen
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-8 flex flex-wrap gap-2">
              {['EU-Hosting', 'Tenant Isolation', 'Auditierbare Evidence', 'Keine Kreditkarte'].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-chip border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-titanium-400"
                >
                  <ShieldCheck className="h-3 w-3 text-petrol-300" /> {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="relative">
          <GlobeStage />
          <FloatingLabels />
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
            <Reveal key={title} delay={i * 0.05}>
              <div className="group h-full rounded-panel border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-petrol-500/40 hover:bg-white/[0.04]">
                <span className="grid h-11 w-11 place-items-center rounded-card bg-petrol-500/10 ring-1 ring-petrol-400/30">
                  <Icon className="h-5 w-5 text-petrol-300" />
                </span>
                <h3 className="mt-5 font-display font-semibold text-titanium-50">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-titanium-400">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════
//  3 · Governance OS Module
// ════════════════════════════════════════════════════════════════════

const MODULES = [
  { Icon: Globe, label: 'Websites', to: '/app/websites' },
  { Icon: Cpu, label: 'KI-Systeme', to: '/app/ai-systems' },
  { Icon: AlertTriangle, label: 'Risiken', to: '/app/risks' },
  { Icon: Archive, label: 'Evidence Vault', to: '/app/evidence' },
  { Icon: Activity, label: 'Monitoring', to: '/app/monitoring' },
  { Icon: Network, label: 'Vendors', to: '/app/vendors' },
  { Icon: FileText, label: 'Dokumente', to: '/app/documents' },
  { Icon: BarChart3, label: 'Reports', to: '/app/reports' },
  { Icon: Workflow, label: 'Automation Skills', to: '/automations' },
];

function ModuleSection() {
  return (
    <section id="module" className="relative px-4 sm:px-6 py-20 sm:py-28">
      {/* Trennlinie oben */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-petrol-500/30 to-transparent" />
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Governance OS Module"
          title="Ein Betriebssystem — neun Module, ein Prüfpfad"
          intro="Jedes Modul greift auf dieselbe Evidence-Chain zu. Ein Befund aus Websites wird zur Evidence, die Evidence speist Risiken, Monitoring und Reports."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {MODULES.map(({ Icon, label, to }, i) => (
            <Reveal key={label} delay={(i % 3) * 0.05}>
              <Link
                to={to}
                className="group relative block h-full overflow-hidden rounded-panel border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-6 transition-all hover:border-petrol-500/50 hover:-translate-y-1"
              >
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-petrol-500/10 blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="grid h-12 w-12 place-items-center rounded-card border border-white/10 bg-obsidian-900">
                  <Icon className="h-5 w-5 text-petrol-300" />
                </span>
                <h3 className="mt-6 font-display font-semibold text-titanium-50">{label}</h3>
                <span className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-titanium-500 group-hover:text-petrol-300 transition-colors">
                  Öffnen <ArrowRight className="h-3 w-3" />
                </span>
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
              <div className="flex h-full flex-col rounded-panel border border-white/10 bg-white/[0.02] p-6">
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
              </div>
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
                        <FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-petrol-300" />
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
        <div className="rounded-panel border border-white/10 bg-white/[0.02] p-10 sm:p-14 backdrop-blur-md">
          <ServerCog className="mx-auto h-8 w-8 text-petrol-300" />
          <h2 className="mt-6 font-display font-bold text-3xl sm:text-4xl tracking-tight text-titanium-50">
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
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-petrol-500/15 ring-1 ring-petrol-400/40">
            <Globe className="h-4 w-4 text-petrol-300" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-titanium-500">
            Governance OS · RealSyncDynamics.AI · EU-Frankfurt
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
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 antialiased selection:bg-petrol-500/30">
      <Nav />
      <main>
        <Hero />
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
