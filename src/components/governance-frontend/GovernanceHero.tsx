import { useState } from 'react';
import type { MouseEvent } from 'react';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Code2,
  Gauge,
  Menu,
  PlayCircle,
  ScrollText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import SpaceBackdrop from './SpaceBackdrop';
import GlobeVisual from './GlobeVisual';
import Button from './Button';
import { handleAnchorClick, resolveHref } from './scroll';
import { HERO_HEADLINE } from './hero-content';
import type { HeroHeadlineSegment } from './hero-content';

// Jeder Navigationspunkt zeigt auf ein Ziel, das es wirklich gibt (CLAUDE.md §14:
// keine Elemente vortaeuschen, die nichts tun). `hash` scrollt innerhalb der
// Landing (mit Header-Offset via handleAnchorClick), `to` wechselt die Route —
// Letzteres ueber <Link>, damit die SPA nicht neu laedt. Zielliste aus #1072.
const navItems: ReadonlyArray<{ label: string; hash?: string; to?: string }> = [
  { label: 'Produkt', hash: '#produkt' },
  { label: 'Automatisierung', hash: '#tools' },
  { label: 'Runtime', hash: '#intro' },
  { label: 'Evidence', hash: '#evidence' },
  { label: 'AI Act', to: '/ai-act' },
  { label: 'Sicherheit', to: '/sicherheit' },
  { label: 'Preise', to: '/pricing' },
  { label: 'Login', to: '/welcome' },
];

const highlights = [
  {
    icon: ShieldCheck,
    title: 'DSGVO-konform',
    desc: 'Nachweise, Prozesse und Richtlinien automatisiert.',
  },
  {
    icon: ScrollText,
    title: 'AI-Act-ready',
    desc: 'Risikobewertung, Transparenz & Dokumentation.',
  },
  {
    icon: Activity,
    title: 'Kontinuierlich',
    desc: 'Monitoring, Alerts & Evidence in Echtzeit.',
  },
] as const;

function Logo() {
  return (
    <a
      href="#produkt"
      onClick={(e) => handleAnchorClick(e, '#produkt')}
      className="flex items-center gap-2.5 rounded-md text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7 text-cyan-400" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M16 3v26M5.4 9.5l21.2 13M26.6 9.5L5.4 22.5" />
        </g>
        <circle cx="16" cy="16" r="3.4" fill="currentColor" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">
        RealSync <span className="font-normal text-slate-300">Dynamics.AI</span>
      </span>
    </a>
  );
}

function CardShell({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#071320]/80 p-3.5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

function CardLabel({ children, tone = 'cyan' }: { children: React.ReactNode; tone?: 'cyan' | 'emerald' }) {
  return (
    <div
      className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${
        tone === 'emerald' ? 'text-emerald-300' : 'text-cyan-300'
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          tone === 'emerald' ? 'bg-emerald-400' : 'bg-cyan-400'
        }`}
      />
      {children}
    </div>
  );
}

/**
 * Die schwebenden Status-Karten aus dem Referenzdesign (Upload 2026-08-16).
 *
 * Beispielwerte — bewusst KEINE Live-Daten. Ein anonymer Besucher hat keinen
 * Mandanten und damit keine belegbaren Kennzahlen; die Karten werden deshalb
 * als Beispielansicht ausgewiesen (Truth Layer, wie in #1072 etabliert).
 */
function StatusCards() {
  return (
    <>
      {/* Desktop: frei positioniert über dem Globus */}
      <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
        <span className="absolute right-[2%] top-[2%] rounded-full border border-white/20 bg-[#071320]/80 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50 backdrop-blur-md">
          Beispielansicht
        </span>

        <CardShell className="absolute left-[8%] top-[1%] w-[150px]">
          <CardLabel tone="emerald">DSGVO</CardLabel>
          <p className="mt-1 text-xs text-slate-300">Compliant</p>
        </CardShell>

        <CardShell className="absolute right-[2%] top-[21%] w-[150px]">
          <CardLabel>Risk Score</CardLabel>
          <p className="mt-1 text-2xl font-semibold text-white">
            87 <span className="text-sm font-normal text-slate-500">/100</span>
          </p>
        </CardShell>

        <CardShell className="absolute right-[24%] top-[42%] w-[232px]">
          <CardLabel>Claude Code Audit</CardLabel>
          <p className="mt-1 text-xl font-semibold text-white">
            94,2% <span className="text-sm font-normal text-slate-400">Code-Ready</span>
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
            Analysierte Codezeilen: 2,1 Mio
            <br />
            Sicherheitslücken behoben: 11.396
          </p>
        </CardShell>

        <CardShell className="absolute right-[0%] top-[46%] w-[128px]">
          <CardLabel tone="emerald">EU AI Act</CardLabel>
          <p className="mt-1 text-xs text-slate-300">Ready</p>
        </CardShell>

        <CardShell className="absolute left-[0%] top-[44%] w-[150px]">
          <CardLabel>Evidence</CardLabel>
          <p className="mt-1 text-2xl font-semibold text-white">1.248</p>
          <p className="text-[11px] text-slate-500">Nachweise</p>
        </CardShell>

        <CardShell className="absolute bottom-[4%] left-[10%] w-[272px] border-cyan-400/20 bg-[#08202e]/85">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">
            <Code2 size={12} />
            Claude Code Integration
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
            Automatisierte Code-Analyse und Code-Fixes für datenschutz- und regulierungskonforme
            Software-Entwicklung.
          </p>
        </CardShell>

        <CardShell className="absolute bottom-[1%] right-[10%] w-[140px]">
          <CardLabel tone="emerald">Monitoring</CardLabel>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
            <Gauge size={13} className="text-emerald-400" /> Live
          </p>
        </CardShell>
      </div>

      {/* Mobil/Tablet: als Raster unter dem Text */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <span className="col-span-2 justify-self-start rounded-full border border-white/20 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">
          Beispielansicht
        </span>
        <CardShell>
          <CardLabel>Risk Score</CardLabel>
          <p className="mt-1 text-2xl font-semibold text-white">
            87 <span className="text-sm font-normal text-slate-500">/100</span>
          </p>
        </CardShell>
        <CardShell>
          <CardLabel>Evidence</CardLabel>
          <p className="mt-1 text-2xl font-semibold text-white">1.248</p>
          <p className="text-[11px] text-slate-500">Nachweise</p>
        </CardShell>
        <CardShell>
          <CardLabel>Claude Code Audit</CardLabel>
          <p className="mt-1 text-xl font-semibold text-white">94,2%</p>
          <p className="text-[11px] text-slate-500">Code-Ready</p>
        </CardShell>
        <CardShell>
          <CardLabel tone="emerald">EU AI Act</CardLabel>
          <p className="mt-1 text-xl font-semibold text-white">Ready</p>
          <p className="text-[11px] text-slate-500">DSGVO compliant</p>
        </CardShell>
        <p className="col-span-2 text-[10px] leading-relaxed text-white/35">
          Beispielwerte zur Veranschaulichung. Ihre echten Kennzahlen entstehen erst mit dem ersten Audit.
        </p>
      </div>
    </>
  );
}

/**
 * Governance-AI-Hero der Startseite — Referenzdesign (Upload 2026-08-16)
 * kombiniert mit dem animierten Governance-Globus als rechtem Zentrum.
 *
 * ⚠ Die H1 wird von tests/e2e/public-routes.spec.ts (FE-001) geprüft.
 * Headline-Änderungen dort IMMER mitziehen — sonst ist main rot.
 */
export default function GovernanceHero({ onStart }: { onStart?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const start = () => (onStart ? onStart() : navigate('/unified-entry/scan'));

  return (
    <section
      id="produkt"
      aria-label="RealSync Dynamics.AI — KI-Betriebssystem für DSGVO, EU AI Act und Code-Compliance"
      className="relative isolate min-h-screen overflow-hidden bg-[#03070f] text-slate-200"
    >
      <SpaceBackdrop />

      {/* ---------- Navigation ---------- */}
      <header className="relative z-20 mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-6 lg:px-10">
        <Logo />

        <nav
          aria-label="Hauptnavigation"
          className="hidden items-center gap-7 text-sm text-slate-300 lg:flex"
        >
          {navItems.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-md transition-colors hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={resolveHref(item.hash ?? '#produkt')}
                onClick={(e) => handleAnchorClick(e, item.hash ?? '#produkt')}
                className="rounded-md transition-colors hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
              >
                {item.label}
              </a>
            )
          )}
        </nav>

        <div className="flex items-center gap-3">
          <Button onClick={start} iconRight={<ArrowRight size={15} />} className="hidden sm:inline-flex">
            Kostenlos starten
          </Button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
            aria-expanded={menuOpen}
            aria-controls="rs-mobile-nav"
            className="rounded-md border border-white/10 p-2 text-slate-300 transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 lg:hidden"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <nav
          id="rs-mobile-nav"
          aria-label="Hauptnavigation (mobil)"
          className="relative z-20 mx-6 mb-4 rounded-xl border border-white/10 bg-[#071320]/95 p-4 backdrop-blur lg:hidden"
        >
          <ul className="flex flex-col gap-3 text-sm text-slate-300">
            {navItems.map((item) => (
              <li key={item.label}>
                {item.to ? (
                  <Link to={item.to} onClick={() => setMenuOpen(false)} className="hover:text-cyan-300">
                    {item.label}
                  </Link>
                ) : (
                  <a
                    href={resolveHref(item.hash ?? '#produkt')}
                    onClick={(e) => {
                      handleAnchorClick(e, item.hash ?? '#produkt');
                      setMenuOpen(false);
                    }}
                    className="hover:text-cyan-300"
                  >
                    {item.label}
                  </a>
                )}
              </li>
            ))}
            <li className="pt-1">
              <Button
                fullWidth
                onClick={() => {
                  setMenuOpen(false);
                  start();
                }}
                iconRight={<ArrowRight size={15} />}
              >
                Kostenlos starten
              </Button>
            </li>
          </ul>
        </nav>
      )}

      {/* ---------- Inhalt ---------- */}
      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] items-center gap-10 px-6 pb-20 pt-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-8 lg:px-10 lg:pb-16 lg:pt-0">
        <div className="max-w-[46rem]">
          <a
            href={resolveHref('#intro')}
            onClick={(e: MouseEvent<HTMLAnchorElement>) => handleAnchorClick(e, '#intro')}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/5 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300 transition hover:border-cyan-300/70 hover:bg-cyan-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            <span className="rounded-full bg-cyan-400 px-1.5 py-0.5 text-[9px] font-semibold text-[#03212b]">
              Neu
            </span>
            Claude Code Optimizer
            <ArrowRight size={13} />
          </a>

          {/* Headline kommt aus hero-content.ts — dort auch die FE-001-Test-Erwartung. */}
          <h1 className="mt-6 text-[2.15rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-[2.9rem] lg:text-[3.2rem] xl:text-[3.65rem]">
            {HERO_HEADLINE.map((segments: readonly HeroHeadlineSegment[], lineIndex: number) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {segments.map((segment: HeroHeadlineSegment, segmentIndex: number) =>
                  segment.accent ? (
                    <span key={segmentIndex} className="text-cyan-400">
                      {segment.text}
                    </span>
                  ) : (
                    <span key={segmentIndex}>{segment.text}</span>
                  )
                )}
              </span>
            ))}
          </h1>

          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500 sm:text-xs">
            AI Governance &amp; Code Optimization OS for Trust &amp; Value
          </p>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-400">
            RealSync Dynamics AI überwacht Websites, KI-Systeme, Code und Nachweise kontinuierlich —
            DSGVO-konform, AI-Act-ready, Claude Code-geprüft und auditierbar.
          </p>

          <ul className="mt-9 grid gap-7 sm:grid-cols-3">
            {highlights.map(({ icon: Icon, title, desc }) => (
              <li key={title}>
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300">
                  <Icon size={14} />
                  {title}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{desc}</p>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button size="lg" onClick={start} iconRight={<ArrowRight size={16} />}>
              Kostenlos starten
            </Button>
            <Button
              variant="secondary"
              size="lg"
              href={resolveHref('#intro')}
              onClick={(e: MouseEvent<HTMLAnchorElement>) => handleAnchorClick(e, '#intro')}
              iconLeft={<PlayCircle size={17} className="text-cyan-300" />}
            >
              Einführung
            </Button>
          </div>

          <p className="mt-7 flex items-center gap-2 text-[12px] text-slate-500">
            <BadgeCheck size={14} className="text-emerald-400" />
            Hosting &amp; Verarbeitung in der EU · ISO-orientierte Prozesse
          </p>
        </div>

        {/* Rechte Seite: Governance-Globus mit schwebenden Status-Karten */}
        <div className="relative min-h-[420px] lg:min-h-[640px]">
          <GlobeVisual />
          <StatusCards />
        </div>
      </div>
    </section>
  );
}
