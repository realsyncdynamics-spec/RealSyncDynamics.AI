import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, BadgeCheck, Code2, FileCheck2, Menu, Play,
  Scale, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { Logo } from '../Logo';
import { EarthCore } from '../visual/EarthCore';

/**
 * AiOsHeroSection — Europa-Erde-Hero-Centerpiece (verbindliches Zielbild).
 *
 * GovTech-/Enterprise-Look: dunkler Space-/Galaxy-Hintergrund, Europa-zentrierte
 * 3D-Erde (EarthCore, mit SVG-/Mobile-Fallback), Orbit-Linien und schwebende
 * Glassmorphism-Runtime-Widgets. Text/Visual ≈ 45/55 zugunsten der Erde.
 *
 * Bewegung läuft über CSS-Klassen (hero-float etc.) und wird durch die globale
 * prefers-reduced-motion-Regel in index.css eingefroren. Widgets erscheinen
 * erst ab lg, um Mobile nicht zu überladen.
 *
 * Copy ist bewusst englisch gemäß Zielbild (internationaler GovTech-Auftritt).
 */

const NAV_ITEMS = [
  { label: 'Product', to: '/runtime' },
  { label: 'Automation', to: '/automations' },
  { label: 'Evidence', to: '/evidence' },
  { label: 'AI Act', to: '/ai-act' },
  { label: 'Security', to: '/security' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Login', to: '/welcome' },
] as const;

const FEATURES = [
  { icon: ShieldCheck, title: 'GDPR-Compliant', body: 'Evidence, processes, and policies automated.' },
  { icon: Scale, title: 'AI-Act-Ready', body: 'Risk assessment, transparency & documentation.' },
  { icon: Activity, title: 'Continuous', body: 'Monitoring, alerts & evidence in real time.' },
] as const;

function GlassCard({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={
        'rounded-card border border-cyan-300/15 bg-white/[0.06] backdrop-blur-md ' +
        'shadow-[0_8px_40px_rgba(0,190,210,0.10)] ' +
        className
      }
    >
      {children}
    </div>
  );
}

function WidgetLabel({ icon: Icon, children, dot }: { icon?: typeof Activity; children: React.ReactNode; dot?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-titanium-300">
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {Icon && <Icon className="h-3 w-3 text-cyan-300" />}
      {children}
    </div>
  );
}

export function AiOsHeroSection() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section className="relative overflow-hidden bg-obsidian-950 text-titanium-50">
      {/* ── Hintergrund: Space-Tiefe ───────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(125%_120%_at_72%_8%,#0c1738_0%,#070b1a_46%,#04060d_100%)]" />
        <div className="absolute inset-0 hero-starfield opacity-70" />
        {/* Nebel */}
        <div className="hero-nebula absolute -top-24 right-1/4 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(20,130,150,0.22),transparent_60%)] blur-3xl" />
        <div className="absolute bottom-0 left-6 h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle,rgba(40,80,170,0.16),transparent_60%)] blur-3xl" />
        {/* Galaxie oben rechts */}
        <div className="absolute right-8 top-6 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(225,205,255,0.45),rgba(120,90,200,0.14)_45%,transparent_72%)] opacity-60 blur-2xl" />
        {/* ferner Ringplanet */}
        <div className="absolute left-1/2 top-14 h-12 w-12 rounded-full bg-[radial-gradient(circle_at_35%_30%,#caa46a,#6b4f2a_70%,#2a1d0f)] opacity-70" />
        {/* Mond unten rechts */}
        <div className="absolute bottom-24 right-16 h-16 w-16 rounded-full bg-[radial-gradient(circle_at_38%_32%,#cdd2dc,#7d828d_70%,#3a3d45)] opacity-50 blur-[1px]" />
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2.5 select-none hover:opacity-90">
          <Logo size={26} iconOnly />
          <span className="font-display text-base font-bold tracking-tight">
            <span className="text-white">RealSync</span>
            <span className="ml-0.5 font-medium text-titanium-400">Dynamics.AI</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm font-medium text-titanium-300 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/audit?source=hero-nav"
            className="group inline-flex items-center gap-1.5 rounded-chip bg-teal-400 px-4 py-2 text-sm font-semibold text-obsidian-950 transition-colors hover:bg-teal-300"
          >
            Start for Free
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="text-titanium-200 hover:text-white lg:hidden"
          aria-label="Menü öffnen"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {menuOpen && (
        <div className="relative z-20 border-y border-white/10 bg-obsidian-950/95 backdrop-blur-md lg:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="block px-2 py-2.5 text-base font-medium text-titanium-200 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/audit?source=hero-nav-mobile"
              onClick={() => setMenuOpen(false)}
              className="mt-2 flex items-center justify-between rounded-chip bg-teal-400 px-3 py-3 text-base font-semibold text-obsidian-950"
            >
              Start for Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ── Inhalt ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:grid lg:grid-cols-[45%_55%] lg:gap-6 lg:px-8 lg:pb-24 lg:pt-10">
        {/* LINKS: Copy */}
        <div className="max-w-xl">
          <Link
            to="/ai-act"
            className="group inline-flex items-center gap-2 rounded-chip border border-teal-300/30 bg-teal-400/10 px-3 py-1.5"
          >
            <span className="rounded-chip bg-teal-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-obsidian-950">
              New
            </span>
            <span className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.18em] text-teal-200">
              <Sparkles className="h-3 w-3" /> Claude Code Optimizer
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-teal-200 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
            The AI Operating System for{' '}
            <span className="text-teal-300">GDPR, EU AI Act &amp; Code-Compliance</span>
          </h1>

          <p className="mt-5 font-mono text-xs uppercase tracking-[0.22em] text-titanium-400">
            AI Governance &amp; Code Optimization OS for Trust &amp; Value
          </p>

          <p className="mt-4 max-w-lg text-lg leading-relaxed text-titanium-300">
            RealSync Dynamics AI continuously monitors websites, AI systems, code, and
            evidence — GDPR-compliant, AI-Act-ready, Claude Code-audited, and auditable.
          </p>

          {/* Feature-Trio */}
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-chip border border-teal-300/25 bg-teal-400/10">
                    <Icon className="h-3.5 w-3.5 text-teal-300" />
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white">{title}</span>
                </div>
                <p className="mt-2 text-sm leading-snug text-titanium-400">{body}</p>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/audit?source=hero"
              className="group inline-flex items-center justify-center gap-2 rounded-chip bg-teal-400 px-6 py-3 font-semibold text-obsidian-950 transition-colors hover:bg-teal-300"
            >
              Start for Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/app"
              className="inline-flex items-center justify-center gap-2 rounded-chip border border-white/20 px-6 py-3 font-medium text-titanium-100 transition-colors hover:bg-white/5"
            >
              <Play className="h-4 w-4 text-teal-300" />
              View Product Tour
            </Link>
          </div>
        </div>

        {/* RECHTS: Erde + schwebende Widgets */}
        <div className="relative mt-12 flex items-center justify-center lg:mt-0 lg:min-h-[600px]">
          {/* Orbit-Linien */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden items-center justify-center lg:flex">
            <svg viewBox="0 0 600 600" className="hero-orbit-spin h-[680px] w-[680px] opacity-30">
              <ellipse cx="300" cy="300" rx="280" ry="150" fill="none" stroke="rgba(120,200,220,0.30)" strokeWidth="1" transform="rotate(-18 300 300)" />
              <ellipse cx="300" cy="300" rx="240" ry="240" fill="none" stroke="rgba(120,200,220,0.16)" strokeWidth="1" />
              <ellipse cx="300" cy="300" rx="290" ry="200" fill="none" stroke="rgba(120,200,220,0.12)" strokeWidth="1" transform="rotate(24 300 300)" />
            </svg>
          </div>

          {/* Erde */}
          <div className="relative w-full max-w-[560px]">
            <EarthCore size={560} className="mx-auto" />
          </div>

          {/* Widgets — nur ab lg, um Mobile nicht zu überladen */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
            {/* GDPR (sekundär) */}
            <GlassCard className="hero-float-slow absolute left-[34%] top-[2%] px-3 py-2">
              <WidgetLabel dot="bg-emerald-400">GDPR</WidgetLabel>
              <div className="mt-0.5 text-xs text-titanium-200">Compliant</div>
            </GlassCard>

            {/* Risk Score (primär) */}
            <GlassCard className="hero-float absolute right-[1%] top-[22%] w-40 px-4 py-3">
              <WidgetLabel icon={Activity}>Risk Score</WidgetLabel>
              <div className="mt-1 font-display text-3xl font-bold text-white">
                87<span className="text-sm font-normal text-titanium-400"> /100</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[87%] rounded-full bg-teal-400" />
              </div>
            </GlassCard>

            {/* EU AI Act (sekundär) */}
            <GlassCard className="hero-float-fast absolute right-[0%] top-[46%] px-3 py-2">
              <WidgetLabel icon={BadgeCheck}>EU AI Act</WidgetLabel>
              <div className="mt-0.5 text-xs text-titanium-200">Ready</div>
            </GlassCard>

            {/* Claude Code Audit (sekundär, medium) */}
            <GlassCard className="hero-float absolute right-[6%] top-[62%] w-52 px-4 py-3">
              <WidgetLabel icon={Code2}>Claude Code Audit</WidgetLabel>
              <div className="mt-1 font-display text-2xl font-bold text-white">
                94.2%<span className="ml-1 text-xs font-normal text-titanium-400">Code-Ready</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-titanium-400">
                Analyzed code lines: <span className="text-titanium-200">2.1M</span><br />
                Security vulnerabilities fixed: <span className="text-titanium-200">11,350</span>
              </p>
            </GlassCard>

            {/* Evidence (primär) */}
            <GlassCard className="hero-float-slow absolute left-[-2%] top-[48%] w-36 px-4 py-3">
              <WidgetLabel icon={FileCheck2} dot="bg-teal-400">Evidence</WidgetLabel>
              <div className="mt-1 font-display text-2xl font-bold text-white">1,248</div>
              <div className="text-[11px] text-titanium-400">Evidence items</div>
            </GlassCard>

            {/* Claude Code Integration (sekundär, beschreibend) */}
            <GlassCard className="hero-float-fast absolute bottom-[2%] left-[14%] w-60 px-4 py-3">
              <WidgetLabel icon={Code2}>Claude Code Integration</WidgetLabel>
              <p className="mt-1.5 text-[11px] leading-snug text-titanium-300">
                Automated code analysis &amp; fixes for privacy- and regulation-compliant
                software development.
              </p>
            </GlassCard>

            {/* Monitoring (primär) */}
            <GlassCard className="hero-float absolute bottom-[7%] right-[24%] w-40 px-4 py-3">
              <WidgetLabel icon={Activity} dot="bg-teal-400">Monitoring</WidgetLabel>
              <div className="mt-1.5 flex items-center gap-2">
                <svg viewBox="0 0 80 20" className="h-5 w-20 text-teal-300">
                  <polyline
                    points="0,12 10,12 16,4 22,16 30,8 38,14 46,6 54,12 64,12 80,12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
                <span className="text-xs text-titanium-200">Live</span>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </section>
  );
}
