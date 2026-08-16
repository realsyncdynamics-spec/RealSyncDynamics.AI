import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';
import { Activity, ArrowRight, BadgeCheck, Code2, Gauge, Menu, PlayCircle, ScrollText, ShieldCheck, Sparkles, X } from 'lucide-react';
import SpaceBackdrop from './SpaceBackdrop';
import Button from './Button';
import { handleAnchorClick } from './scroll';

const highlights = [
  { icon: ShieldCheck, title: 'DSGVO-konform', desc: 'Nachweise, Prozesse und Richtlinien automatisiert.' },
  { icon: ScrollText, title: 'AI-Act-ready', desc: 'Risikobewertung, Transparenz & Dokumentation.' },
  { icon: Activity, title: 'Kontinuierlich', desc: 'Monitoring, Alerts & Evidence in Echtzeit.' },
];

function Logo() {
  return (
    <a href="#produkt" onClick={(e) => handleAnchorClick(e, '#produkt')} className="flex items-center gap-2.5 rounded-md text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
      <svg viewBox="0 0 32 32" className="h-7 w-7 text-cyan-400" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M16 3v26M5.4 9.5l21.2 13M26.6 9.5L5.4 22.5" /></g><circle cx="16" cy="16" r="3.4" fill="currentColor" /></svg>
      <span className="text-[17px] font-semibold tracking-tight">RealSync <span className="font-normal text-slate-300">Dynamics.AI</span></span>
    </a>
  );
}

function CardShell({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-white/10 bg-[#071320]/80 p-3.5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur-md ${className}`}>{children}</div>;
}

function CardLabel({ children, tone = 'cyan' }: { children: ReactNode; tone?: 'cyan' | 'emerald' }) {
  return <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${tone === 'emerald' ? 'text-emerald-300' : 'text-cyan-300'}`}><span className={`h-1.5 w-1.5 rounded-full ${tone === 'emerald' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />{children}</div>;
}

type HeroSectionProps = { onStart?: () => void; backgroundImage?: string };
type NavItem = { label: string; href: string; fallback?: string };

export default function GovernanceHero({ onStart }: HeroSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const start = () => (onStart ? onStart() : navigate('/unified-entry/scan'));
  const navItems: NavItem[] = [
    { label: 'Produkt', href: '#produkt' },
    { label: 'Automatisierung', href: '#automatisierung', fallback: '#intro' },
    { label: 'Evidence', href: '#evidence', fallback: '#intro' },
    { label: 'AI Act', href: '#ai-act', fallback: '#intro' },
    { label: 'Sicherheit', href: '#sicherheit', fallback: '#intro' },
    { label: 'Preise', href: '#preise', fallback: '#intro' },
  ];
  const routes = { login: '/welcome', claudeCodeOptimizer: '#intro' } as const;
  const handleNav = (event: MouseEvent<HTMLAnchorElement>, href: string, fallback = '#intro') => {
    const target = document.querySelector(href);
    if (target) { handleAnchorClick(event, href); return; }
    handleAnchorClick(event, fallback);
  };

  return (
    <section id="produkt" className="relative isolate min-h-[780px] overflow-hidden bg-[#02050a] text-white">
      <SpaceBackdrop />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_35%,rgba(0,210,255,0.10),transparent_42%)]" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#02050a] to-transparent" aria-hidden="true" />

      <header className="relative z-40 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-slate-300 lg:flex" aria-label="Hauptnavigation">
          {navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => handleNav(e, item.href, item.fallback)} className="transition hover:text-white">{item.label}</a>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex"><a href={routes.login} className="rounded-lg px-4 py-2 text-sm text-slate-300 transition hover:text-white">Login</a><Button onClick={start} variant="primary" size="md">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></div>
        <button type="button" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="rounded-lg border border-white/10 p-2 text-slate-200 lg:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </header>

      {menuOpen && <div className="relative z-40 mx-5 rounded-xl border border-white/10 bg-[#071320]/95 p-4 backdrop-blur-xl lg:hidden"><nav className="flex flex-col gap-1" aria-label="Mobile Navigation">{navItems.map((item) => <a key={item.label} href={item.href} onClick={(e) => { handleNav(e, item.href, item.fallback); setMenuOpen(false); }} className="rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/5">{item.label}</a>)}<a href={routes.login} className="rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/5">Login</a><Button onClick={() => { setMenuOpen(false); start(); }} variant="primary" size="md" className="mt-2 w-full justify-center">Kostenlos starten <ArrowRight className="h-4 w-4" /></Button></nav></div>}

      <div className="relative z-20 mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-5 pb-24 pt-10 lg:grid-cols-[46%_54%] lg:px-8 lg:pt-8">
        <div className="relative z-30 max-w-2xl lg:pt-4">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/5 px-4 py-2 font-mono text-xs font-medium uppercase tracking-[0.14em] text-cyan-200"><Sparkles className="h-3.5 w-3.5" />NEW&nbsp;&nbsp; CLAUDE CODE OPTIMIZER <ArrowRight className="h-3.5 w-3.5" /></div>
          <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[64px] xl:text-[72px]">Das KI-Betriebssystem<br />für <span className="text-cyan-300">DSGVO, EU AI Act</span><br /><span className="text-cyan-300">&amp; Code-Compliance</span></h1>
          <div className="mt-7 font-mono text-xs uppercase tracking-[0.18em] text-slate-500">AI GOVERNANCE &amp; CODE OPTIMIZATION OS FOR TRUST &amp; VALUE</div>
          <p className="mt-5 max-w-xl text-base leading-6 text-slate-300 sm:text-lg">RealSync Dynamics AI überwacht Websites, KI-Systeme, Code und Nachweise kontinuierlich — DSGVO-konform, AI-Act-ready, Claude Code-geprüft und auditierbar.</p>
          <div className="mt-7 grid max-w-2xl grid-cols-3 divide-x divide-white/10">{highlights.map((item) => { const Icon = item.icon; return <div key={item.title} className="px-4 first:pl-0"><Icon className="h-5 w-5 text-cyan-300" /><div className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300">{item.title}</div><p className="mt-2 text-xs leading-5 text-slate-400">{item.desc}</p></div>; })}</div>
          <div className="mt-7 flex flex-wrap items-center gap-3"><Button onClick={start} variant="primary" size="lg">Kostenlos starten <ArrowRight className="h-5 w-5" /></Button><a href="#intro" onClick={(e) => handleAnchorClick(e, '#intro')} className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.02] px-5 text-sm font-medium text-slate-200 transition hover:border-white/25 hover:bg-white/5"><PlayCircle className="h-4 w-4" />Produkt-Tour ansehen</a></div>
        </div>

        <div className="relative hidden min-h-[650px] lg:block" aria-label="Governance Globe visual">
          <img src="/europe-globe.webp" alt="" aria-hidden="true" className="absolute left-[-8%] top-[-5%] h-[720px] w-[900px] max-w-none object-contain drop-shadow-[0_0_70px_rgba(34,211,238,0.25)]" />
          <CardShell className="absolute left-[5%] top-[8%] w-44"><CardLabel>DSGVO</CardLabel><div className="mt-2 text-sm font-medium text-slate-200">Compliant</div></CardShell>
          <CardShell className="absolute right-[2%] top-[30%] w-44"><CardLabel>Risk Score</CardLabel><div className="mt-1 flex items-end gap-1"><span className="text-3xl font-semibold">87</span><span className="pb-1 text-xs text-slate-400">/100</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[87%] rounded-full bg-cyan-400" /></div></CardShell>
          <CardShell className="absolute bottom-[20%] right-[4%] w-64"><CardLabel>Claude Code Audit</CardLabel><div className="mt-1 flex items-center justify-between"><div><span className="text-2xl font-semibold">94.2%</span><div className="text-[11px] text-slate-400">Code-Ready</div></div><Code2 className="h-7 w-7 text-cyan-300" /></div><div className="mt-2 text-[10px] text-slate-500">Analysierte Codezeilen: 2.1 Mio</div></CardShell>
          <CardShell className="absolute bottom-[9%] left-[10%] w-52"><CardLabel>Evidence</CardLabel><div className="mt-1 text-2xl font-semibold">1,248</div><div className="text-[11px] text-slate-400">Nachweise</div></CardShell>
          <CardShell className="absolute bottom-[3%] left-[36%] w-52"><CardLabel>Monitoring</CardLabel><div className="mt-1 text-sm font-medium text-slate-200">Live</div></CardShell>
          <CardShell className="absolute right-[0%] bottom-[23%] w-36"><CardLabel tone="emerald">EU AI Act</CardLabel><div className="mt-1 text-xs font-semibold text-emerald-300">READY</div></CardShell>
        </div>

        <div className="flex flex-col gap-4 lg:hidden"><div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2"><img src="/europe-globe.webp" alt="" aria-hidden="true" className="w-full object-contain" /></div><div className="grid grid-cols-2 gap-3">{highlights.map((item) => { const Icon = item.icon; return <CardShell key={item.title}><div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-cyan-300" />{item.title}</div></CardShell>; })}</div></div>
      </div>

      <div className="relative z-30 mx-auto flex max-w-7xl justify-center px-5 pb-8 lg:px-8"><a href={routes.claudeCodeOptimizer} onClick={(e: MouseEvent<HTMLAnchorElement>) => handleAnchorClick(e, routes.claudeCodeOptimizer)} className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-400 transition hover:border-cyan-400/30 hover:text-cyan-200"><Gauge className="h-3.5 w-3.5" />Governance Intelligence Layer<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></a></div>
    </section>
  );
}
