import { useState, type MouseEvent, type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  CircleGauge,
  Code2,
  Database,
  FileCheck2,
  Menu,
  Mic,
  PlayCircle,
  Send,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';
import { handleAnchorClick } from './scroll';
import { HERO_HEADLINE } from './hero-content';

type HeroSectionProps = { onStart?: () => void };
type NavItem = { label: string; href: string; fallback?: string };

const navItems: NavItem[] = [
  { label: 'Produkt', href: '#produkt' },
  { label: 'Automatisierung', href: '#platform', fallback: '#intro' },
  { label: 'Evidence', href: '#evidence', fallback: '#intro' },
  { label: 'AI Act', href: '#evidence', fallback: '#intro' },
  { label: 'Sicherheit', href: '#evidence', fallback: '#intro' },
  { label: 'Preise', href: '#intro', fallback: '#intro' },
];

const FONT_STACK = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function Logo() {
  return (
    <a
      href="#produkt"
      onClick={(e) => handleAnchorClick(e, '#produkt')}
      className="group flex items-center gap-2.5 rounded-md text-white"
      style={{ fontFamily: FONT_STACK }}
    >
      <svg viewBox="0 0 40 40" className="h-8 w-8 text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,.55)]" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M20 2v36M2 20h36M7 7l26 26M33 7L7 33" />
        </g>
        <circle cx="20" cy="20" r="3.1" fill="currentColor" />
      </svg>
      <span className="text-[17px] font-semibold tracking-[-.02em]">
        RealSync <span className="font-normal text-slate-400">Dynamics.AI</span>
      </span>
    </a>
  );
}

function GlassCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-[14px] border border-white/[0.13] bg-[#071522]/90 p-4 shadow-[0_22px_55px_-28px_rgba(0,0,0,.95),0_0_24px_rgba(34,211,238,.07)] backdrop-blur-xl ${className}`}
      style={{ fontFamily: FONT_STACK }}
    >
      {children}
    </div>
  );
}

function Signal({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[.12em] text-cyan-100/90">
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,.8)]" />
      {children}
    </span>
  );
}

function Stars() {
  const stars = Array.from({ length: 105 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    top: `${(i * 61) % 92}%`,
    size: i % 13 === 0 ? 2 : i % 3 === 0 ? 1.35 : 1,
    opacity: i % 7 === 0 ? 0.65 : 0.22,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stars.map((star, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.opacity }}
        />
      ))}
    </div>
  );
}

function EarthPanel() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute bottom-0 left-[24%] right-0 top-[10%] overflow-hidden rounded-tl-[18px] bg-[#02070d] shadow-[-28px_0_90px_rgba(0,0,0,.32)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_47%,rgba(18,157,215,.17),transparent_40%),linear-gradient(115deg,rgba(1,5,9,.96)_0%,rgba(2,10,18,.58)_39%,rgba(2,9,16,.04)_100%)]" />
        <img
          src="/europe-globe.webp"
          alt=""
          className="absolute -right-[12%] -top-[8%] h-[126%] w-[106%] object-contain drop-shadow-[0_0_95px_rgba(37,207,255,.28)]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_17%,rgba(255,255,255,.38),transparent_5%,transparent_18%),radial-gradient(circle_at_62%_54%,transparent_33%,rgba(0,0,0,.55)_80%)]" />
        <div className="absolute right-[4%] top-[4%] h-20 w-20 rounded-full bg-white/65 blur-[11px] shadow-[0_0_68px_26px_rgba(255,190,105,.27)]" />
      </div>
      <div className="absolute bottom-0 left-[24%] right-0 h-[27%] bg-gradient-to-t from-[#010409] via-[#010409]/55 to-transparent" />
    </div>
  );
}

function Connector({ className }: { className: string }) {
  return (
    <span
      className={`pointer-events-none absolute z-30 hidden h-px origin-left bg-gradient-to-r from-cyan-300/65 to-transparent shadow-[0_0_8px_rgba(34,211,238,.4)] lg:block ${className}`}
      aria-hidden="true"
    />
  );
}

function UserNode({ className }: { className: string }) {
  return (
    <span
      className={`pointer-events-none absolute z-40 hidden h-7 w-7 place-items-center rounded-full border border-cyan-200/35 bg-[#08202f]/80 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,.25)] backdrop-blur-sm lg:grid ${className}`}
    >
      <User className="h-3.5 w-3.5" />
    </span>
  );
}

function GovernanceCard({ className, children }: { className: string; children: ReactNode }) {
  return <GlassCard className={`absolute z-50 ${className}`}>{children}</GlassCard>;
}

function AssistantBar() {
  return (
    <div
      className="absolute bottom-6 left-[49%] z-[55] hidden h-11 w-[430px] -translate-x-1/2 items-center rounded-full border border-white/[0.14] bg-[#071522]/88 px-3 shadow-[0_18px_42px_rgba(0,0,0,.55)] backdrop-blur-xl xl:flex"
      style={{ fontFamily: FONT_STACK }}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-black/25 text-cyan-200">
        <CircleGauge className="h-3.5 w-3.5" />
      </span>
      <span className="ml-2.5 text-[12px] font-semibold text-white">Assistent</span>
      <span className="mx-3 h-5 w-px bg-white/10" />
      <span className="flex-1 truncate text-[12px] text-white/45">Wie prüfe ich EU AI Act Einhaltung?</span>
      <Mic className="mr-3 h-3.5 w-3.5 text-white/45" />
      <span className="grid h-7 w-7 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
        <Send className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

export default function GovernanceHero({ onStart }: HeroSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const start = () => (onStart ? onStart() : navigate('/unified-entry/scan'));

  const handleNav = (event: MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    const target = document.querySelector(item.href) ? item.href : item.fallback ?? '#intro';
    handleAnchorClick(event, target);
    setMenuOpen(false);
  };

  return (
    <section
      id="produkt"
      className="relative isolate min-h-[768px] overflow-hidden bg-[#02070d] text-white lg:h-[100vh] lg:min-h-[720px]"
      style={{ fontFamily: FONT_STACK }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(115deg,#02070d_0%,#03101a_50%,#06131e_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_48%,rgba(17,141,193,.14),transparent_38%),radial-gradient(ellipse_at_22%_72%,rgba(8,50,76,.18),transparent_38%)]" />
      <Stars />
      <EarthPanel />

      <header className="relative z-[80] mx-auto flex h-[76px] max-w-[1448px] items-center justify-between px-6 lg:px-[70px]">
        <Logo />
        <nav className="hidden items-center gap-[30px] text-[13px] font-medium text-slate-300 lg:flex" aria-label="Hauptnavigation">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="transition-colors hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-4 lg:flex">
          <a href="/welcome" className="px-2 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:text-white">Login</a>
          <Button onClick={start} variant="primary" size="md">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button>
        </div>
        <button
          type="button"
          aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-xl border border-white/10 bg-black/20 p-2.5 lg:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {menuOpen && (
        <div className="relative z-[90] mx-5 rounded-2xl border border-white/10 bg-[#061321]/95 p-4 shadow-2xl backdrop-blur-xl lg:hidden">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="rounded-xl px-3 py-3 text-sm text-slate-200 hover:bg-white/5">
                {item.label}
              </a>
            ))}
            <a href="/welcome" className="rounded-xl px-3 py-3 text-sm text-slate-200">Login</a>
            <Button onClick={() => { setMenuOpen(false); start(); }} variant="primary" size="md" className="mt-2 w-full justify-center">
              Kostenlos starten <ArrowRight className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      )}

      <div className="relative z-50 mx-auto max-w-[1448px] px-6 pt-[88px] lg:px-[70px] lg:pt-[96px]">
        <div className="max-w-[590px]">
          <a
            href="#intro"
            onClick={(e) => handleAnchorClick(e, '#intro')}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-[#0a2533]/65 px-3.5 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[.14em] text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,.07)]"
          >
            <span className="rounded-full bg-cyan-300 px-1.5 py-0.5 text-[8px] font-bold tracking-normal text-[#03202a]">NEU</span>
            CLAUDE CODE OPTIMIZER
            <ChevronRight className="h-3 w-3" />
          </a>

          <h1 className="max-w-[610px] text-balance text-[56px] font-semibold leading-[.98] tracking-[-.042em] sm:text-[64px] lg:text-[74px] xl:text-[78px]">
            {HERO_HEADLINE.map((line, lineIndex) => (
              <span
                key={lineIndex}
                className="block bg-gradient-to-b from-white 0% via-[#f8fafc] 52% to-[#b7c4ce] bg-clip-text text-transparent drop-shadow-[0_7px_18px_rgba(0,0,0,.5)]"
              >
                {line.map((segment) => segment.text).join('')}
              </span>
            ))}
          </h1>

          <p className="mt-6 max-w-[555px] text-[18px] font-medium leading-[1.42] tracking-[-.012em] text-slate-100 sm:text-[19px]">
            Das KI-Betriebssystem für <span className="text-cyan-300">DSGVO, EU AI Act &amp; Code-Compliance.</span>
          </p>
          <p className="mt-4 max-w-[570px] text-[14px] leading-[1.62] tracking-[-.005em] text-slate-400 sm:text-[15px]">
            Kontinuierliche Governance, Monitoring und beweisfähige Evidence für KI-Systeme, Daten und Code – in einer operativen Control Plane.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button onClick={start} variant="primary" size="lg">
              Kostenlos starten <ArrowRight className="h-4 w-4" />
            </Button>
            <a
              href="#intro"
              onClick={(e) => handleAnchorClick(e, '#intro')}
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/20 bg-white/[0.035] px-5 text-[13px] font-medium text-white transition hover:border-white/30 hover:bg-white/[0.07]"
            >
              <PlayCircle className="h-4 w-4 text-cyan-200" />
              Plattform ansehen
            </a>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {['DSGVO', 'Risk Score', 'Claude Code Audit', 'EU AI Act'].map((item) => (
              <span key={item} className="rounded-full border border-white/[0.14] bg-[#071522]/55 px-3.5 py-1.5 text-[10px] font-medium tracking-[.01em] text-slate-300">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
        <Connector className="left-[55%] top-[31%] w-[125px] rotate-[18deg]" />
        <Connector className="left-[68%] top-[40%] w-[105px] rotate-[-7deg]" />
        <Connector className="left-[61%] top-[66%] w-[110px] rotate-[7deg]" />
        <UserNode className="left-[61%] top-[27%]" />
        <UserNode className="left-[80%] top-[32%]" />
        <UserNode className="left-[65%] top-[70%]" />

        <GovernanceCard className="left-[46.2%] top-[31.5%] w-[160px] p-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-cyan-300" />
            <div>
              <div className="text-[13px] font-semibold tracking-[-.01em]">DSGVO</div>
              <div className="mt-0.5 text-[10px] text-slate-400">Compliant</div>
            </div>
            <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-cyan-300/10 text-cyan-300"><Check className="h-3 w-3" /></span>
          </div>
        </GovernanceCard>

        <GovernanceCard className="left-[72%] top-[30.5%] w-[168px] p-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-cyan-300" />
            <div>
              <div className="text-[12px] font-semibold">EU AI Act</div>
              <div className="mt-0.5 text-[10px] text-slate-400">Ready</div>
            </div>
          </div>
        </GovernanceCard>

        <GovernanceCard className="left-[46.2%] top-[47.7%] w-[310px] p-4">
          <div className="flex gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cyan-300/[0.08] text-cyan-200">
              <Code2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Signal>Claude Code Audit</Signal>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[30px] font-light tracking-[-.035em]">94.2%</span>
                <span className="text-[11px] text-slate-400">Code-Ready</span>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-2 text-[10px] text-slate-400">
                <span className="border-l-2 border-cyan-300/80 pl-2">2.1 Mio</span><span>Analysierte Codezeilen</span>
                <span className="border-l-2 border-amber-300/70 pl-2">11,350</span><span>Sicherheitslücken behoben</span>
              </div>
            </div>
          </div>
        </GovernanceCard>

        <GovernanceCard className="left-[72%] top-[46%] w-[260px] p-4">
          <Signal>Risk Score</Signal>
          <div className="mt-1 flex items-center gap-3">
            <div className="grid h-[72px] w-[72px] place-items-center rounded-full border-[4px] border-cyan-300/25 bg-cyan-300/[0.025] shadow-[inset_0_0_22px_rgba(34,211,238,.08)]">
              <span className="text-[15px] font-medium text-slate-200">Risk</span>
            </div>
            <div>
              <div className="text-[30px] font-light tracking-[-.03em]">87<span className="text-[14px] text-slate-500">/100</span></div>
              <div className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[87%] rounded-full bg-cyan-300" /></div>
            </div>
          </div>
        </GovernanceCard>

        <GovernanceCard className="left-[60.3%] top-[72.5%] w-[255px] p-3">
          <div className="flex items-center gap-3">
            <Activity className="h-9 w-9 text-cyan-300" />
            <div className="flex-1">
              <div className="h-9 overflow-hidden text-cyan-300">
                <svg viewBox="0 0 180 40" className="h-full w-full"><path d="M0 23h25l5-15 7 28 7-13h24l7-5 7 8 9-19 8 28 8-13h28l7-4 6 8 9-15 8 21 7-9h25" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
              </div>
            </div>
            <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-300">● Live</span>
          </div>
        </GovernanceCard>

        <GovernanceCard className="left-[82.5%] top-[72%] w-[190px] p-3">
          <Signal>Evidence</Signal>
          <div className="mt-2 flex items-end gap-2"><Database className="h-6 w-6 text-cyan-300" /><span className="text-[29px] font-light tracking-[-.03em]">1,248</span></div>
          <div className="text-[11px] text-slate-400">Nachweise</div>
          <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-500"><FileCheck2 className="h-3 w-3" /> Letztes Update: 17.06.2024</div>
        </GovernanceCard>
      </div>

      <AssistantBar />
      <div className="absolute bottom-0 left-0 right-0 z-30 h-[72px] bg-gradient-to-t from-[#010409] to-transparent" />
    </section>
  );
}
