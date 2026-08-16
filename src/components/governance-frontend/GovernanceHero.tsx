import { useState, type MouseEvent, type ReactNode } from 'react';
import { Activity, ArrowRight, Check, ChevronRight, Code2, Database, FileCheck2, Menu, Play, ShieldCheck, X } from 'lucide-react';
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
    <a href="#produkt" onClick={(e) => handleAnchorClick(e, '#produkt')} className="flex items-center gap-3 text-white" style={{ fontFamily: FONT_STACK }}>
      <svg viewBox="0 0 40 40" className="h-8 w-8 text-cyan-300" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M20 2v36M2 20h36M7 7l26 26M33 7L7 33" /></g>
        <circle cx="20" cy="20" r="3" fill="currentColor" />
      </svg>
      <span className="text-[17px] font-semibold tracking-[-0.025em]">RealSync <span className="font-normal text-slate-400">Dynamics.AI</span></span>
    </a>
  );
}

function Stars() {
  const stars = Array.from({ length: 72 }, (_, i) => ({ left: `${(i * 47) % 100}%`, top: `${(i * 67) % 96}%`, size: i % 19 === 0 ? 2 : 1, opacity: i % 11 === 0 ? 0.5 : 0.16 }));
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">{stars.map((star, i) => <span key={i} className="absolute rounded-full bg-white" style={{ left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.opacity }} />)}</div>;
}

function EarthVisual() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_46%,rgba(20,146,197,.16),transparent_31%),radial-gradient(ellipse_at_60%_70%,rgba(6,59,88,.12),transparent_40%)]" />
      <div className="absolute right-[-9%] top-[5%] h-[91%] w-[72%] xl:right-[-5%] xl:w-[68%]">
        <div className="absolute inset-0 rounded-full bg-cyan-300/[0.025] blur-3xl" />
        <img src="/europe-globe.webp" alt="" className="absolute inset-0 h-full w-full object-contain object-right drop-shadow-[0_0_85px_rgba(26,190,241,.22)]" />
      </div>
      <div className="absolute inset-y-0 left-0 w-[53%] bg-gradient-to-r from-[#02070d] via-[#02070d]/94 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-[#02070d] via-[#02070d]/80 to-transparent" />
      <div className="absolute right-[10%] top-[10%] h-24 w-24 rounded-full bg-white/30 blur-2xl" />
    </div>
  );
}

function GlassCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[16px] border border-white/[0.12] bg-[#071522]/88 shadow-[0_20px_55px_-30px_rgba(0,0,0,.95)] backdrop-blur-xl ${className}`} style={{ fontFamily: FONT_STACK }}>{children}</div>;
}

function Signal({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />{children}</span>;
}

function Connector({ className }: { className: string }) {
  return <span className={`pointer-events-none absolute hidden h-px origin-left bg-gradient-to-r from-cyan-300/45 to-transparent lg:block ${className}`} aria-hidden="true" />;
}

function HeroCards() {
  return (
    <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
      <Connector className="left-[53%] top-[34%] w-28 rotate-[18deg]" />
      <Connector className="left-[68%] top-[37%] w-24 rotate-[-10deg]" />
      <Connector className="left-[63%] top-[66%] w-24 rotate-[7deg]" />

      <GlassCard className="absolute left-[45%] top-[31%] w-[178px] p-4">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.07] text-cyan-300"><ShieldCheck className="h-5 w-5" /></span><div><div className="text-[13px] font-semibold text-white">DSGVO</div><div className="mt-0.5 text-[10px] text-slate-400">Compliant</div></div><span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-cyan-300/10 text-cyan-300"><Check className="h-3 w-3" /></span></div>
      </GlassCard>

      <GlassCard className="absolute left-[72%] top-[29%] w-[170px] p-4"><Signal>EU AI Act</Signal><div className="mt-3 flex items-center gap-2.5"><ShieldCheck className="h-5 w-5 text-cyan-300" /><span className="text-[13px] font-medium text-white">Ready</span></div></GlassCard>

      <GlassCard className="absolute left-[45%] top-[47%] w-[330px] p-5">
        <div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.06] text-cyan-200"><Code2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><Signal>Claude Code Audit</Signal><div className="mt-2 flex items-end gap-2"><span className="text-[34px] font-medium tracking-[-0.045em] text-white">94.2%</span><span className="mb-1 text-[11px] text-slate-400">Code-Ready</span></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3 text-[10px] text-slate-400"><div><span className="block text-[12px] font-medium text-slate-200">2.1 Mio</span>analysierte Codezeilen</div><div><span className="block text-[12px] font-medium text-slate-200">11.350</span>Sicherheitslücken behoben</div></div></div></div>
      </GlassCard>

      <GlassCard className="absolute left-[72%] top-[46%] w-[264px] p-5"><Signal>Risk Score</Signal><div className="mt-3 flex items-center gap-4"><div className="grid h-[70px] w-[70px] place-items-center rounded-full border-[3px] border-cyan-300/25 bg-[#081925]"><span className="text-[13px] font-medium text-slate-300">Risk</span></div><div><div className="text-[32px] font-medium tracking-[-0.04em] text-white">87<span className="text-[14px] font-normal text-slate-500">/100</span></div><div className="mt-2 h-1 w-28 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[87%] rounded-full bg-cyan-300" /></div></div></div></GlassCard>

      <GlassCard className="absolute left-[61%] top-[71%] w-[248px] p-4"><div className="flex items-center gap-3"><Activity className="h-8 w-8 text-cyan-300" /><div className="flex-1"><div className="h-8 text-cyan-300"><svg viewBox="0 0 180 40" className="h-full w-full"><path d="M0 22h22l5-13 8 25 7-12h24l7-5 8 8 9-18 8 25 8-11h28l7-5 6 8 9-14 8 19 7-8h24" fill="none" stroke="currentColor" strokeWidth="2" /></svg></div></div><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-300">Live</span></div></GlassCard>

      <GlassCard className="absolute left-[82%] top-[71%] w-[190px] p-4"><Signal>Evidence</Signal><div className="mt-3 flex items-center gap-2"><Database className="h-5 w-5 text-cyan-300" /><span className="text-[30px] font-medium tracking-[-0.04em] text-white">1,248</span></div><div className="mt-0.5 text-[11px] text-slate-400">Nachweise</div><div className="mt-3 flex items-center gap-1.5 border-t border-white/[0.07] pt-2 text-[9px] text-slate-500"><FileCheck2 className="h-3 w-3" /> Governance Evidence</div></GlassCard>
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
    <section id="produkt" className="relative isolate min-h-[760px] overflow-hidden bg-[#02070d] text-white lg:h-[100vh] lg:min-h-[760px]" style={{ fontFamily: FONT_STACK }}>
      <div className="absolute inset-0 bg-[#02070d]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_58%,rgba(8,49,74,.17),transparent_34%),radial-gradient(ellipse_at_82%_46%,rgba(16,124,169,.10),transparent_34%)]" />
      <Stars />
      <EarthVisual />

      <header className="relative z-[90] mx-auto flex h-[76px] max-w-[1365px] items-center justify-between px-6 lg:px-12 xl:px-16">
        <Logo />
        <nav className="hidden items-center gap-8 text-[13px] font-medium text-slate-300 lg:flex" aria-label="Hauptnavigation">{navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="transition-colors hover:text-white">{item.label}</a>)}</nav>
        <div className="hidden items-center gap-4 lg:flex"><a href="/welcome" className="px-2 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:text-white">Login</a><Button onClick={start} variant="primary" size="md">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></div>
        <button type="button" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="rounded-xl border border-white/10 bg-black/20 p-2.5 lg:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </header>

      {menuOpen && <div className="relative z-[100] mx-5 rounded-2xl border border-white/10 bg-[#061321]/95 p-4 shadow-2xl backdrop-blur-xl lg:hidden"><nav className="flex flex-col gap-1">{navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="rounded-xl px-3 py-3 text-sm text-slate-200 hover:bg-white/5">{item.label}</a>)}<a href="/welcome" className="rounded-xl px-3 py-3 text-sm text-slate-200">Login</a><Button onClick={() => { setMenuOpen(false); start(); }} variant="primary" size="md" className="mt-2 w-full justify-center">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></nav></div>}

      <main className="relative z-50 mx-auto max-w-[1365px] px-6 pt-[92px] lg:px-12 lg:pt-[94px] xl:px-16 xl:pt-[104px]">
        <div className="max-w-[600px]">
          <a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.045] px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-100"><span className="rounded-full bg-cyan-300 px-1.5 py-0.5 text-[8px] font-bold tracking-normal text-[#03202a]">NEU</span>CLAUDE CODE OPTIMIZER <ChevronRight className="h-3 w-3" /></a>
          <h1 className="max-w-[630px] text-balance text-[60px] font-semibold leading-[0.97] tracking-[-0.05em] sm:text-[68px] xl:text-[76px]">{HERO_HEADLINE.map((line, lineIndex) => <span key={lineIndex} className="block bg-gradient-to-b from-white via-white to-[#b9c5cf] bg-clip-text text-transparent">{line.map((segment) => segment.text).join('')}</span>)}</h1>
          <p className="mt-6 max-w-[560px] text-[18px] font-medium leading-[1.42] tracking-[-0.012em] text-slate-100 sm:text-[19px]">Das KI-Betriebssystem für <span className="text-cyan-300">DSGVO, EU AI Act &amp; Code-Compliance.</span></p>
          <p className="mt-4 max-w-[565px] text-[14px] leading-[1.65] text-slate-400 sm:text-[15px]">Kontinuierliche Governance, Monitoring und beweisfähige Evidence für KI-Systeme, Daten und Code – in einer operativen Control Plane.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Button onClick={start} variant="primary" size="lg">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button><a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/[0.16] bg-white/[0.025] px-5 text-[13px] font-medium text-white transition hover:border-white/25 hover:bg-white/[0.055]"><Play className="h-4 w-4 text-cyan-200" /> Plattform ansehen</a></div>
          <div className="mt-5 flex flex-wrap gap-2">{['DSGVO', 'Risk Score', 'Claude Code Audit', 'EU AI Act'].map((item) => <span key={item} className="rounded-full border border-white/[0.11] bg-white/[0.02] px-3.5 py-1.5 text-[10px] font-medium text-slate-400">{item}</span>)}</div>
        </div>
      </main>

      <HeroCards />
      <div className="absolute inset-x-0 bottom-0 z-30 h-24 bg-gradient-to-t from-[#02070d] to-transparent" />
    </section>
  );
}
