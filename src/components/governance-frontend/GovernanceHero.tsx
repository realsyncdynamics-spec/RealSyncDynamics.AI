import { useState, type MouseEvent, type ReactNode } from 'react';
import { Activity, ArrowRight, Check, ChevronRight, Code2, Database, Menu, Play, ShieldCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';
import { handleAnchorClick } from './scroll';

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
      <svg viewBox="0 0 40 40" className="h-9 w-9 text-cyan-300" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 2v36M2 20h36M7 7l26 26M33 7L7 33" /></g>
        <circle cx="20" cy="20" r="3" fill="currentColor" />
      </svg>
      <span className="text-[18px] font-semibold tracking-[-0.035em]">RealSync <span className="font-normal text-slate-400">Dynamics.AI</span></span>
    </a>
  );
}

function Stars() {
  const stars = Array.from({ length: 90 }, (_, i) => ({
    left: `${(i * 47) % 100}%`, top: `${(i * 67) % 100}%`, size: i % 23 === 0 ? 2 : 1, opacity: i % 13 === 0 ? 0.6 : 0.22,
  }));
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">{stars.map((star, i) => <span key={i} className="absolute rounded-full bg-white" style={{ left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.opacity }} />)}</div>;
}

function EarthVisual() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_76%_52%,rgba(24,166,216,.18),transparent_36%),radial-gradient(ellipse_at_70%_20%,rgba(27,76,109,.14),transparent_30%)]" />
      <div className="absolute -right-[4%] top-[1%] h-[98%] w-[69%] rounded-[50%] border border-cyan-300/[0.08] rotate-[8deg]" />
      <div className="absolute right-0 top-[9%] h-[82%] w-[67%] rounded-[50%] border border-cyan-300/[0.12] -rotate-[12deg]" />
      <div className="absolute right-[2%] top-[16%] h-[67%] w-[61%] rounded-[50%] border border-cyan-300/[0.08] rotate-[24deg]" />
      <div className="absolute right-[-3%] top-[7%] h-[88%] w-[67%] xl:right-0 xl:w-[65%]">
        <div className="absolute inset-[-5%] rounded-full bg-cyan-200/[0.045] blur-3xl" />
        <img src="/europe-globe.webp" alt="Europa aus Satellitenperspektive" className="absolute inset-0 h-full w-full object-contain object-right drop-shadow-[0_0_95px_rgba(40,195,245,.28)]" />
      </div>
      <div className="absolute inset-y-0 left-0 w-[45%] bg-gradient-to-r from-[#01060b] via-[#01060b]/96 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-[#01060b] via-[#01060b]/70 to-transparent" />
    </div>
  );
}

function GlassCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[14px] border border-white/[0.14] bg-[#061522]/82 shadow-[0_22px_60px_-28px_rgba(0,0,0,.95)] backdrop-blur-xl ${className}`} style={{ fontFamily: FONT_STACK }}>{children}</div>;
}

function Signal({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_9px_rgba(103,232,249,.75)]" />{children}</span>;
}

function HeroCards() {
  return (
    <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
      <GlassCard className="absolute left-[57%] top-[20%] w-[150px] p-3.5"><div className="flex items-center gap-2.5"><ShieldCheck className="h-4 w-4 text-cyan-300" /><div><div className="text-[12px] font-semibold text-white">DSGVO</div><div className="text-[10px] text-slate-400">Compliance</div></div><Check className="ml-auto h-4 w-4 text-cyan-300" /></div></GlassCard>
      <GlassCard className="absolute right-[12%] top-[39%] w-[140px] p-3.5"><Signal>Risk Score</Signal><div className="mt-2 text-[27px] font-medium tracking-[-0.04em] text-white">87<span className="text-[11px] text-slate-500">/100</span></div></GlassCard>
      <GlassCard className="absolute right-[5%] top-[63%] w-[142px] p-3.5"><Signal>EU AI Act</Signal><div className="mt-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" /><span className="text-[12px] font-semibold text-cyan-200">READY</span></div></GlassCard>
      <GlassCard className="absolute left-[42%] top-[66%] w-[152px] p-3.5"><Signal>Evidence</Signal><div className="mt-2 flex items-center gap-2"><Database className="h-4 w-4 text-cyan-300" /><span className="text-[25px] font-medium tracking-[-0.04em] text-white">1,248</span></div><div className="text-[10px] text-slate-400">Nachweise</div></GlassCard>
      <GlassCard className="absolute right-[33%] bottom-[5%] w-[150px] p-3.5"><Signal>Monitoring</Signal><div className="mt-2 flex items-center gap-2"><Activity className="h-5 w-5 text-cyan-300" /><span className="text-[11px] text-emerald-300">Live</span></div></GlassCard>
      <GlassCard className="absolute left-[48%] top-[43%] w-[285px] p-4"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-300/[0.08] text-cyan-200"><Code2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><Signal>Claude Code Audit</Signal><div className="mt-1.5 flex items-end gap-2"><span className="text-[29px] font-medium tracking-[-0.045em] text-white">94.2%</span><span className="mb-1 text-[10px] text-slate-400">Code-Ready</span></div><div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-2 text-[9px] text-slate-400"><span><b className="block text-[11px] text-slate-200">2.1 Mio</b>Codezeilen</span><span><b className="block text-[11px] text-slate-200">11.350</b>Fixes</span></div></div></div></GlassCard>
    </div>
  );
}

export default function GovernanceHero({ onStart }: HeroSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const start = () => (onStart ? onStart() : navigate('/unified-entry/scan'));
  const handleNav = (event: MouseEvent<HTMLAnchorElement>, item: NavItem) => { const target = document.querySelector(item.href) ? item.href : item.fallback ?? '#intro'; handleAnchorClick(event, target); setMenuOpen(false); };

  return (
    <section id="produkt" className="relative isolate min-h-[760px] overflow-hidden bg-[#01060b] text-white lg:h-[100vh] lg:min-h-[800px]" style={{ fontFamily: FONT_STACK }}>
      <div className="absolute inset-0 bg-[#01060b]" /><Stars /><EarthVisual />
      <header className="relative z-[90] mx-auto flex h-[78px] max-w-[1540px] items-center justify-between px-8 lg:px-12 xl:px-16">
        <Logo />
        <nav className="hidden items-center gap-9 text-[14px] font-medium text-slate-300 lg:flex" aria-label="Hauptnavigation">{navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="transition-colors hover:text-white">{item.label}</a>)}</nav>
        <div className="hidden items-center gap-5 lg:flex"><a href="/welcome" className="px-1 py-2 text-[14px] font-medium text-slate-300 transition-colors hover:text-white">Login</a><Button onClick={start} variant="primary" size="md">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></div>
        <button type="button" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="rounded-xl border border-white/10 bg-black/20 p-2.5 lg:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </header>
      {menuOpen && <div className="relative z-[100] mx-5 rounded-2xl border border-white/10 bg-[#061321]/95 p-4 shadow-2xl backdrop-blur-xl lg:hidden"><nav className="flex flex-col gap-1">{navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item)} className="rounded-xl px-3 py-3 text-sm text-slate-200 hover:bg-white/5">{item.label}</a>)}<a href="/welcome" className="rounded-xl px-3 py-3 text-sm text-slate-200">Login</a><Button onClick={() => { setMenuOpen(false); start(); }} variant="primary" size="md" className="mt-2 w-full justify-center">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></nav></div>}
      <main className="relative z-50 mx-auto max-w-[1540px] px-8 pt-[82px] lg:px-12 lg:pt-[86px] xl:px-16 xl:pt-[92px]">
        <div className="max-w-[690px]">
          <a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-300/[0.05] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-cyan-100"><span className="rounded-full bg-cyan-300 px-1.5 py-0.5 text-[8px] font-bold tracking-normal text-[#03202a]">NEU</span>GOVERNANCE COMPLEXITY SCORE <ChevronRight className="h-3 w-3" /></a>
          <h1 className="max-w-[680px] text-[58px] font-medium leading-[1.02] tracking-[-0.045em] sm:text-[66px] xl:text-[72px]">Das KI-<br />Betriebssystem für<br /><span className="bg-gradient-to-r from-cyan-200 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">DSGVO &amp; EU AI Act</span></h1>
          <p className="mt-6 max-w-[560px] font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">AI GOVERNANCE OS FOR TRUST &amp; VALUE</p>
          <p className="mt-6 max-w-[570px] text-[16px] leading-[1.7] text-slate-300">RealSync Dynamics AI überwacht Websites, KI-Systeme, Risiken und Nachweise kontinuierlich — <span className="text-slate-100">DSGVO-konform, AI-Act-ready und auditierbar.</span></p>
          <div className="mt-7 grid max-w-[620px] grid-cols-3 border-y border-white/[0.09] py-5">
            <div className="pr-5"><ShieldCheck className="h-5 w-5 text-cyan-300" /><div className="mt-3 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-cyan-200">DSGVO-KONFORM</div><p className="mt-2 text-[11px] leading-[1.45] text-slate-400">Nachweise, Prozesse und Richtlinien automatisiert.</p></div>
            <div className="border-l border-white/[0.09] px-5"><div className="grid h-5 w-5 place-items-center rounded-full border border-cyan-300/60 text-[9px] text-cyan-300">AI</div><div className="mt-3 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-cyan-200">AI-ACT-READY</div><p className="mt-2 text-[11px] leading-[1.45] text-slate-400">Risikobewertung, Transparenz &amp; Dokumentation.</p></div>
            <div className="border-l border-white/[0.09] pl-5"><Activity className="h-5 w-5 text-cyan-300" /><div className="mt-3 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-cyan-200">KONTINUIERLICH</div><p className="mt-2 text-[11px] leading-[1.45] text-slate-400">Monitoring, Alerts &amp; Evidence in Echtzeit.</p></div>
          </div>
          <div className="mt-7 flex flex-wrap gap-3"><Button onClick={start} variant="primary" size="lg">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button><a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/[0.18] bg-white/[0.02] px-5 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.07]"><Play className="h-4 w-4" />Produkt-Tour ansehen</a></div>
        </div>
      </main>
      <HeroCards />
      <div className="pointer-events-none absolute inset-[12px] rounded-[28px] border border-cyan-300/[0.08]" aria-hidden="true" />
    </section>
  );
}
